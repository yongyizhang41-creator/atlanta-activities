from datetime import timedelta
from html import escape
import httpx
from sqlalchemy import select
from app.core.config import settings
from app.core.security import lock_user
from app.events.time import utcnow,NY
from app.models import Reminder,Event,Plan,User,MailJob
from app.reminders.email import gateway,EmailUnavailable

# Resend keeps idempotency keys for 24h; retry only within 23h with an identical payload.
SAFE_RETRY=timedelta(hours=23)

def deliver_one(db,reminder_id,mail=gateway):
    now=utcnow();candidate=db.get(Reminder,reminder_id)
    if not candidate:return 'ignored'
    lock_user(db,candidate.user_id)
    event=db.scalar(select(Event).where(Event.id==candidate.event_id).with_for_update())
    r=db.scalar(select(Reminder).where(Reminder.id==reminder_id).with_for_update())
    if r.status not in ('pending','retry','unknown','submitting') or r.sent_at or r.remind_at>now:
        return 'ignored'
    if r.next_attempt_at and r.next_attempt_at>now:return 'ignored'
    if r.first_attempt_at and now-r.first_attempt_at>=SAFE_RETRY:
        r.status='failed';r.error='Delivery could not be confirmed safely. Automatic retries stopped.';db.commit();return 'failed'
    plan=db.scalar(select(Plan).where(Plan.user_id==r.user_id,Plan.event_id==r.event_id))
    user=db.get(User,r.user_id)
    if not user or not user.verified or not plan or plan.status!='going' or event.status=='cancelled' or event.version!=r.event_version or event.starts_at<=now:
        r.status='cancelled';r.error='Plan or event changed, or the event has started.';db.commit();return 'cancelled'
    if not r.delivery_payload:
        when=event.starts_at.astimezone(NY).strftime('%A, %B %d at %I:%M %p %Z')
        r.delivery_payload={'from':settings.mail_from,'to':[user.email], 'subject':f'Your plan: {event.title}',
            'html':f'<h2>{escape(event.title)}</h2><p>{escape(when)}</p><p>{escape(event.venue)}</p><p><a href="{escape(settings.app_origin,quote=True)}/my-plans">View your plans</a></p>'}
    r.first_attempt_at=r.first_attempt_at or now;r.attempts+=1;r.status='submitting'
    payload=r.delivery_payload;key=f'reminder/{r.id}/{r.revision}'
    # This committed transition is the dispatch boundary. A later cancellation cannot retract submitted mail.
    db.commit()
    try:
        provider_id=mail.send(payload,key)
    except EmailUnavailable:
        r.status='retry';r.error='Email delivery is not configured.';r.next_attempt_at=now+timedelta(minutes=5)
    except (httpx.TimeoutException,httpx.NetworkError):
        r.status='unknown';r.error='Provider response pending; retrying with the same delivery key.';r.next_attempt_at=now+timedelta(minutes=2)
    except httpx.HTTPStatusError as exc:
        temporary=exc.response.status_code in (408,409,429) or exc.response.status_code>=500
        r.status='retry' if temporary and r.attempts<5 else 'failed'
        r.error='Email provider rejected this message.';r.next_attempt_at=now+timedelta(minutes=min(60,2**r.attempts))
    else:
        r.status='sent';r.sent_at=utcnow();r.provider_id=provider_id;r.error=None
    db.commit();return r.status

def deliver_due_reminders(batch_size=100):
    from app.core.database import SessionLocal
    with SessionLocal() as db:
        ids=db.scalars(select(Reminder.id).where(Reminder.status.in_(['pending','retry','unknown','submitting']),Reminder.remind_at<=utcnow()).order_by(Reminder.remind_at).limit(batch_size)).all()
    count=0
    for rid in ids:
        with SessionLocal() as db:
            # Session advisory lock excludes another worker through provider call and result commit.
            locked=db.scalar(__import__('sqlalchemy').text('SELECT pg_try_advisory_lock(hashtextextended(:key,0))'),{'key':rid})
            if not locked:continue
            try:
                if deliver_one(db,rid)=='sent':count+=1
            finally:
                db.execute(__import__('sqlalchemy').text('SELECT pg_advisory_unlock(hashtextextended(:key,0))'),{'key':rid});db.commit()
    return count

def deliver_auth_mail():
    from app.core.database import SessionLocal
    with SessionLocal() as db:
        jobs=db.scalars(select(MailJob).where(MailJob.status=='pending',MailJob.attempts<5).with_for_update(skip_locked=True).limit(10)).all()
        for job in jobs:
            if utcnow()-job.created_at>timedelta(minutes=60):job.status='expired';continue
            try:gateway.send(job.payload,'auth/'+job.id)
            except (httpx.HTTPError,EmailUnavailable):job.attempts+=1;job.error='Email provider unavailable'
            else:job.status='sent'
        db.commit()
