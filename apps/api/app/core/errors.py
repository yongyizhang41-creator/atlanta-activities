from fastapi import HTTPException

def fail(code: str, message: str, status: int=400, **details):
    raise HTTPException(status, {'code':code,'message':message,'details':details})
