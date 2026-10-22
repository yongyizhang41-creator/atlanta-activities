from datetime import timedelta
from sqlalchemy import select
from app.events.time import utcnow
from app.models import User,Event,Plan,Reminder

def setup_reminder(db):
    now=utcnow();u=User(email='delivery@example.com',verified=True);db.add(u);db.flush()
    e=Event(title='Concert',venue='Arena',starts_at=now+timedelta(hours=1),ends_at=now+timedelta(hours=3),latitude=33.76,longitude=-84.4,location='SRID=4326;POINT(-84.4 33.76)',source_urls=['https://example.org']);db.add(e);db.flush()
    db.add(Plan(user_id=u.id,event_id=e.id,status='going'))
    r=Reminder(user_id=u.id,event_id=e.id,event_version=1,remind_at=now-timedelta(seconds=1));db.add(r);db.flush()
    return r,e

class MailSink:
    def __init__(self):self.messages=[]
    def send(self,payload,key):self.messages.append(payload);return 'provider-fixture'

def test_due_reminder_sends_once(db):
    from app.reminders.delivery import deliver_one
    r,e=setup_reminder(db);sink=MailSink()
    assert deliver_one(db,r.id,sink)=='sent'
    assert deliver_one(db,r.id,sink)=='ignored'
    assert r.sent_at is not None
    assert sink.messages[0]['to']==['delivery@example.com']
    assert 'Concert' in sink.messages[0]['subject']
    assert len(sink.messages)==1

def test_cancelled_or_late_never_sends(db):
    from app.reminders.delivery import deliver_one
    r,e=setup_reminder(db);sink=MailSink();e.status='cancelled';db.flush()
    assert deliver_one(db,r.id,sink)=='cancelled'
    assert not sink.messages

def test_unknown_outside_provider_window_is_not_retried(db):
    from app.reminders.delivery import deliver_one
    r,e=setup_reminder(db);sink=MailSink()
    r.status='unknown';r.first_attempt_at=utcnow()-timedelta(hours=24);r.delivery_payload={'x':1};db.flush()
    assert deliver_one(db,r.id,sink)=='failed'
    assert not sink.messages
