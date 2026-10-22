"""Local browser-test fixture. Never run against production; data is clearly marked."""
import json
from pathlib import Path
from datetime import timedelta
from sqlalchemy import select,delete
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hasher
from app.models import User,Event,Plan,Reminder,EventSource,Chat
from app.events.time import utcnow
if settings.environment=='production':raise SystemExit('Refusing to seed production')
with SessionLocal() as db:
    email='e2e-local@example.com';password='local-e2e-test-password'
    u=db.scalar(select(User).where(User.email==email))
    if u:db.delete(u);db.flush()
    for e in db.scalars(select(Event).where(Event.title.like('[E2E] %'))):
        db.execute(delete(Plan).where(Plan.event_id==e.id));db.execute(delete(Reminder).where(Reminder.event_id==e.id));db.execute(delete(Chat).where(Chat.event_id==e.id));db.delete(e)
    u=User(email=email,password_hash=hasher.hash(password),verified=True);db.add(u)
    start=utcnow()+timedelta(hours=3)
    titles=['[E2E] Campus football evening','[E2E] Midtown live music','[E2E] Later neighborhood gathering']
    for title,cat in zip(titles,['Football','Music','Community']):
        db.add(Event(title=title,description='Clearly labelled browser test fixture; not a real activity.',starts_at=start+(timedelta(hours=4) if cat=='Community' else timedelta()),ends_at=start+(timedelta(hours=6) if cat=='Community' else timedelta(hours=2)),venue='E2E test venue',latitude=33.7756,longitude=-84.3963,location='SRID=4326;POINT(-84.3963 33.7756)',categories=[cat],eligibility='Test fixture only',source_urls=['https://example.org/e2e']))
    db.commit()
root=Path(__file__).resolve().parents[1];(root/'.local').mkdir(exist_ok=True)
(root/'.local/e2e.json').write_text(json.dumps({'email':email,'password':password,'titles':titles}))
