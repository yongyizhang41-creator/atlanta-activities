from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy import text
from app.core.database import engine

app = FastAPI(title='Atlanta Activities', version='0.1.0')

@app.get('/api/health')
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text('SELECT PostGIS_Version()'))
        return {'status': 'ok'}
    except Exception:
        return JSONResponse({'status': 'unavailable'}, status_code=503)

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from starlette.middleware.sessions import SessionMiddleware
from app.core.config import settings
from app.auth.router import router as auth_router

app.add_middleware(SessionMiddleware,secret_key=settings.secret_key,session_cookie='atl_oauth',https_only=settings.environment=='production',same_site='lax')

@app.exception_handler(HTTPException)
async def http_error(request:Request,exc:HTTPException):
    body=exc.detail if isinstance(exc.detail,dict) else {'code':'request_failed','message':str(exc.detail),'details':{}}
    return JSONResponse(jsonable_encoder(body),status_code=exc.status_code)

@app.exception_handler(RequestValidationError)
async def validation_error(request:Request,exc:RequestValidationError):
    return JSONResponse({'code':'validation_error','message':'Check the highlighted input and try again.','details':{'fields':[{'field':'.'.join(map(str,e['loc'])),'message':e['msg']} for e in exc.errors()]}},status_code=422)

app.include_router(auth_router)
from app.events.router import router as events_router
app.include_router(events_router)
from app.plans.router import router as plans_router
from app.reminders.router import router as reminders_router
app.include_router(plans_router)
app.include_router(reminders_router)
from app.chat.router import router as chat_router
app.include_router(chat_router)
