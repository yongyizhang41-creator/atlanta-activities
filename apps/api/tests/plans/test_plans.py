from datetime import timedelta
from app.events.time import utcnow
from app.models import Event,User,Reminder
from sqlalchemy import select

def event(db,title='Game',start=None,end=None):
    start=start or utcnow()+timedelta(hours=2)
    e=Event(title=title,starts_at=start,ends_at=end or start+timedelta(hours=2),venue='Stadium',latitude=33.755,longitude=-84.4,location='SRID=4326;POINT(-84.4 33.755)',categories=['Football'],source_urls=['https://example.org'])
    db.add(e);db.flush();return e

def test_overlap_requires_confirmation_and_stale_token_rejected(signed_in,db):
    a,b=event(db),event(db,title='Concert')
    assert signed_in.put(f'/api/me/plans/{a.id}',json={'status':'going'}).status_code==200
    r=signed_in.put(f'/api/me/plans/{b.id}',json={'status':'going'})
    assert r.status_code==409
    details=r.json()['details'];assert len(details['conflicts'])==1
    token=details['token']
    assert signed_in.put(f'/api/me/plans/{b.id}',json={'status':'going','confirmation_token':token}).status_code==200
    plans=signed_in.get('/api/me/plans').json()['items']
    assert all(len(p['conflicts'])==1 for p in plans)
    assert signed_in.put(f'/api/me/plans/{a.id}',json={'status':'maybe','expected_version':1}).status_code==200
    assert signed_in.put(f'/api/me/plans/{b.id}',json={'status':'maybe','expected_version':999}).status_code==409

def test_unknown_end_requires_acknowledgment(signed_in,db):
    a=event(db);a.ends_at=None;db.flush()
    r=signed_in.put(f'/api/me/plans/{a.id}',json={'status':'going'})
    assert r.status_code==409
    assert r.json()['details']['unknown_end_events'][0]['id']==a.id

def test_maybe_cancels_reminder_and_sent_history_survives(signed_in,db):
    a=event(db)
    user=db.scalar(select(User).where(User.email=='person@example.com'));user.verified=True;db.flush()
    assert signed_in.put(f'/api/me/plans/{a.id}',json={'status':'going'}).status_code==200
    r=signed_in.put(f'/api/me/plans/{a.id}/reminder',json={'remind_at':(a.starts_at-timedelta(hours=1)).isoformat()})
    assert r.status_code==200,r.text
    assert signed_in.put(f'/api/me/plans/{a.id}',json={'status':'maybe','expected_version':1}).status_code==200
    reminder=db.scalar(select(Reminder).where(Reminder.event_id==a.id));db.refresh(reminder)
    assert reminder.status=='cancelled'
    reminder.status='sent';reminder.sent_at=utcnow();db.flush()
    assert signed_in.delete(f'/api/me/plans/{a.id}').status_code==200
    assert signed_in.put(f'/api/me/plans/{a.id}',json={'status':'going'}).status_code==200
    assert signed_in.put(f'/api/me/plans/{a.id}/reminder',json={'remind_at':(a.starts_at-timedelta(hours=1)).isoformat()}).status_code==409
