import secrets
from datetime import timedelta
from html import escape
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
from app.core.config import settings
from app.core.database import get_session
from app.core.security import digest, hasher, verify_password, require_user, issue_session, rate_limit, lock_user
from app.core.errors import fail
from app.models import User, Identity, LoginSession, AuthToken, MailJob
from app.events.time import utcnow

router=APIRouter(prefix='/api')
oauth=OAuth()
oauth.register(name='google',client_id=settings.google_client_id,client_secret=settings.google_client_secret,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope':'openid email profile','code_challenge_method':'S256'})

class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1,max_length=256)
class EmailInput(BaseModel):
    email: EmailStr
class TokenInput(BaseModel):
    token: str = Field(min_length=1,max_length=256)
class ResetInput(TokenInput):
    password: str = Field(min_length=12,max_length=256)

def user_dto(db,user):
    return {'id':user.id,'email':user.email,'verified':user.verified,
        'has_password':bool(user.password_hash),'has_google':bool(db.scalar(select(Identity).where(Identity.user_id==user.id)))}

def auth_rate(db,request,email=''):
    rate_limit(db,f'auth-ip:{request.client.host}',30,60)
    if email: rate_limit(db,f'auth-email:{email.lower()}',10,60)

def queue_token(db,user,kind):
    token=secrets.token_urlsafe(40)
    # Rotate earlier tokens of the same kind.
    db.execute(delete(AuthToken).where(AuthToken.user_id==user.id,AuthToken.kind==kind))
    db.add(AuthToken(token_hash=digest(token),user_id=user.id,kind=kind,expires_at=utcnow()+timedelta(minutes=60)))
    route='verify' if kind=='verify' else 'reset'
    link=f'{settings.app_origin}/{route}#token={token}'
    db.add(MailJob(user_id=user.id,payload={'from':settings.mail_from,'to':[user.email],
        'subject':'Verify your ATL / Out email' if kind=='verify' else 'Reset your ATL / Out password',
        'html':f'<p><a href="{escape(link,quote=True)}">{ "Verify email" if kind=="verify" else "Reset password" }</a></p><p>This link expires in one hour.</p>'}))

@router.post('/auth/register')
def register(body: Credentials,request: Request,response: Response,db:Session=Depends(get_session)):
    email=str(body.email).lower()
    auth_rate(db,request,email)
    if len(body.password)<12: fail('weak_password','Use at least 12 characters for your password.')
    # Serialize same-email registrations to avoid duplicate-key races.
    from sqlalchemy import text
    db.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))'),{'key':email})
    if db.scalar(select(User).where(User.email==email)):
        fail('registration_unavailable','Unable to register. Try signing in or resetting your password.')
    user=User(email=email,password_hash=hasher.hash(body.password))
    db.add(user); db.flush()
    queue_token(db,user,'verify')
    csrf=issue_session(db,user,response)
    return {'user':user_dto(db,user),'csrf':csrf}

@router.post('/auth/login')
def login(body:Credentials,request:Request,response:Response,db:Session=Depends(get_session)):
    auth_rate(db,request,str(body.email))
    user=db.scalar(select(User).where(User.email==str(body.email).lower()))
    if not verify_password(user.password_hash if user else None,body.password):
        fail('invalid_credentials','Email or password is incorrect.',401)
    csrf=issue_session(db,user,response)
    return {'user':user_dto(db,user),'csrf':csrf}

@router.get('/auth/session')
def session_info(request:Request,user:User=Depends(require_user),db:Session=Depends(get_session)):
    return {'user':user_dto(db,user),'csrf':request.state.login.csrf}

@router.post('/auth/logout')
def logout(request:Request,response:Response,user:User=Depends(require_user),db:Session=Depends(get_session)):
    db.delete(request.state.login)
    response.delete_cookie('atl_session',path='/')
    return {'ok':True}

@router.post('/auth/forgot-password')
def forgot(body:EmailInput,request:Request,db:Session=Depends(get_session)):
    auth_rate(db,request,str(body.email))
    user=db.scalar(select(User).where(User.email==str(body.email).lower()))
    if user and user.password_hash: queue_token(db,user,'reset')
    return {'message':'If the account is eligible, a reset link will arrive by email.'}

@router.post('/auth/resend-verification')
def resend(request:Request,user:User=Depends(require_user),db:Session=Depends(get_session)):
    auth_rate(db,request,user.email)
    if not user.verified: queue_token(db,user,'verify')
    return {'message':'A verification link has been queued for your email.'}

def take_token(db,value,kind):
    token=db.scalar(select(AuthToken).where(AuthToken.token_hash==digest(value)).with_for_update())
    if not token or token.kind!=kind or token.expires_at<=utcnow():
        fail('invalid_token','This link is invalid or expired. Request a new one.')
    user=db.get(User,token.user_id)
    db.delete(token)
    return user

@router.post('/auth/verify')
def verify(body:TokenInput,request:Request,db:Session=Depends(get_session)):
    auth_rate(db,request)
    user=take_token(db,body.token,'verify'); user.verified=True
    return {'message':'Email verified. You can now set reminders.'}

@router.post('/auth/reset-password')
def reset(body:ResetInput,request:Request,db:Session=Depends(get_session)):
    auth_rate(db,request)
    user=take_token(db,body.token,'reset'); user.password_hash=hasher.hash(body.password)
    db.execute(delete(LoginSession).where(LoginSession.user_id==user.id))
    return {'message':'Password reset. Sign in with your new password.'}

@router.get('/auth/google/start')
async def google_start(request:Request,db:Session=Depends(get_session)):
    if not settings.google_client_id or not settings.google_client_secret:
        fail('google_unavailable','Google sign-in is not configured yet. Use email to sign in.',503)
    request.session['link_user']=None
    return await oauth.google.authorize_redirect(request,settings.app_origin+'/api/auth/google/callback')

@router.post('/auth/google/link')
async def google_link(request:Request,user:User=Depends(require_user)):
    if not settings.google_client_id: fail('google_unavailable','Google sign-in is not configured yet.',503)
    request.session['link_user']=user.id
    # Return authorization URL rather than fetching a cross-origin redirect from JS.
    result=await oauth.google.authorize_redirect(request,settings.app_origin+'/api/auth/google/callback')
    return {'url':result.headers['location']}

@router.get('/auth/google/callback')
async def google_callback(request:Request,db:Session=Depends(get_session)):
    try:
        token=await oauth.google.authorize_access_token(request)
        info=token.get('userinfo')
        if not info or not info.get('sub') or not info.get('email') or not info.get('email_verified'):
            raise ValueError('Google email must be verified')
    except Exception:
        return RedirectResponse(settings.app_origin+'/login?error=google_failed',303)
    identity=db.scalar(select(Identity).where(Identity.subject==info['sub']))
    linking=request.session.pop('link_user',None)
    if linking:
        raw=request.cookies.get('atl_session','')
        session=db.get(LoginSession,digest(raw)) if raw else None
        if not session or session.user_id!=linking or session.expires_at<=utcnow():
            return RedirectResponse(settings.app_origin+'/login?error=link_expired',303)
        if identity and identity.user_id!=linking:
            return RedirectResponse(settings.app_origin+'/settings?error=google_already_linked',303)
        if not identity: db.add(Identity(user_id=linking,subject=info['sub']))
        return RedirectResponse(settings.app_origin+'/settings',303)
    if identity:
        user=db.get(User,identity.user_id)
    else:
        email=info['email'].lower()
        from sqlalchemy import text
        db.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:key,0))'),{'key':email})
        if db.scalar(select(User).where(User.email==email)):
            return RedirectResponse(settings.app_origin+'/login?error=link_existing_account',303)
        user=User(email=email,verified=True)
        db.add(user);db.flush();db.add(Identity(user_id=user.id,subject=info['sub']))
    response=RedirectResponse(settings.app_origin+'/explore',303)
    issue_session(db,user,response)
    return response

@router.delete('/me/identities/google')
def unlink(user:User=Depends(require_user),db:Session=Depends(get_session)):
    lock_user(db,user.id)
    if not user.password_hash: fail('last_identity','Set a password before disconnecting your only sign-in method.')
    db.execute(delete(Identity).where(Identity.user_id==user.id))
    return {'ok':True}

@router.delete('/me/account')
def delete_account(response:Response,user:User=Depends(require_user),db:Session=Depends(get_session)):
    lock_user(db,user.id);db.delete(user)
    response.delete_cookie('atl_session',path='/')
    return {'ok':True}
