import httpx
from app.core.config import settings

class EmailUnavailable(Exception):
    pass

class EmailGateway:
    def send(self, payload: dict, idempotency_key: str):
        if not settings.resend_api_key or not settings.mail_from:
            raise EmailUnavailable('Email delivery is not configured')
        with httpx.Client(timeout=15) as client:
            response=client.post('https://api.resend.com/emails',json=payload,headers={
                'Authorization':f'Bearer {settings.resend_api_key}', 'Idempotency-Key':idempotency_key})
            response.raise_for_status()
            return response.json()['id']

gateway=EmailGateway()
