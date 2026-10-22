import hashlib
import secrets
from datetime import timedelta
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from app.core.database import get_session
from app.core.errors import fail
from app.core.config import settings
from app.events.time import utcnow
from app.models import User, LoginSession, RateBucket

hasher = PasswordHasher()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))

def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()

def verify_password(encoded, password):
    try:
        return hasher.verify(encoded or DUMMY_HASH, password)
    except (VerificationError, ValueError):
        return False

def rate_limit(db: Session, key: str, limit: int, seconds: int):
    # Atomic shared counter; stored hashed so email/IP values do not enter logs or keys.
    now = utcnow()
    bucket = f'{digest(key)}:{int(now.timestamp())//seconds}'
    statement = insert(RateBucket).values(key=bucket,count=1,expires_at=now+timedelta(seconds=seconds))
    statement = statement.on_conflict_do_update(index_elements=['key'],set_={'count':RateBucket.count+1}).returning(RateBucket.count)
    count = db.scalar(statement)
    # Persist rate limiting even if the caller subsequently raises a validation error.
    db.commit()
    if count > limit:
        fail('rate_limited','Too many requests. Try again later.',429)

def require_user(request: Request, db: Session=Depends(get_session)) -> User:
    token = request.cookies.get('atl_session','')
    login = db.get(LoginSession, digest(token)) if token else None
    if not login or login.expires_at <= utcnow():
        fail('authentication_required','Sign in to continue.',401)
    if request.method not in ('GET','HEAD','OPTIONS'):
        if not secrets.compare_digest(request.headers.get('x-csrf-token',''), login.csrf):
            fail('csrf_failed','Refresh the page and try again.',403)
        if request.headers.get('origin') not in (None, settings.app_origin):
            fail('origin_rejected','This request origin is not allowed.',403)
    request.state.login = login
    user = db.get(User,login.user_id)
    if not user:
        fail('authentication_required','Sign in to continue.',401)
    return user

def lock_user(db, user_id):
    return db.scalar(select(User).where(User.id==user_id).with_for_update())

def issue_session(db, user, response):
    token=secrets.token_urlsafe(40)
    csrf=secrets.token_urlsafe(32)
    db.add(LoginSession(token_hash=digest(token),user_id=user.id,csrf=csrf,expires_at=utcnow()+timedelta(days=14)))
    response.set_cookie('atl_session',token,httponly=True,secure=settings.environment=='production',samesite='lax',max_age=14*86400,path='/')
    return csrf
