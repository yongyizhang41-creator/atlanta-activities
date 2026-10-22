from pathlib import Path
from datetime import timedelta
from sqlalchemy import select
from app.events.time import utcnow

def test_campus_eligibility_and_time_are_preserved():
    from app.ingestion.parse import parse_gatech
    e=parse_gatech((Path(__file__).parents[1]/'fixtures/sources/gatech-event.html').read_text(),'https://calendar.gatech.edu/event/2026/10/22/diy-candle-making-event')
    assert e['title']=='DIY Candle Making Event'
    assert e['starts_at'].isoformat()=='2026-10-22T21:30:00+00:00'
    assert e['ends_at'].isoformat()=='2026-10-22T23:30:00+00:00'
    assert 'Graduate students' in e['eligibility']

def test_repeat_ingestion_is_idempotent_and_reschedule_cancels(db):
    from app.ingestion.service import upsert_event
    from app.models import Event,Reminder,User
    start=utcnow()+timedelta(days=1)
    data={'title':'A real-shaped test event','starts_at':start,'ends_at':start+timedelta(hours=1),'venue':'Test venue','latitude':33.7756,'longitude':-84.3963,'source_urls':['https://example.org/event'],'categories':['Community']}
    first=upsert_event(db,'test:1',data)
    second=upsert_event(db,'test:1',data)
    assert first.id==second.id
    assert len(db.scalars(select(Event)).all())==1
    user=User(email='ingestion@example.com',verified=True);db.add(user);db.flush()
    reminder=Reminder(user_id=user.id,event_id=first.id,event_version=1,remind_at=start-timedelta(hours=1));db.add(reminder);db.flush()
    upsert_event(db,'test:1',{**data,'starts_at':start+timedelta(hours=2),'ends_at':start+timedelta(hours=3)})
    db.refresh(reminder)
    assert first.version==2
    assert reminder.status=='cancelled'
