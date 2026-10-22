from datetime import datetime
from fastapi import APIRouter,Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_session
from app.core.security import require_user,lock_user
from app.core.errors import fail
from app.models import User,Event,Plan,Reminder
from app.events.time import utcnow
from app.reminders.service import validate_reminder_time,cancel_pending_reminder
from app.plans.service import reminder_dto
router=APIRouter(prefix='/api/me/plans')
class ReminderInput(BaseModel):
    remind_at:datetime

@router.put('/{event_id}/reminder')
def set_reminder(event_id:str,body:ReminderInput,user:User=Depends(require_user),db:Session=Depends(get_session)):
    lock_user(db,user.id)
    event=db.scalar(select(Event).where(Event.id==event_id).with_for_update())
    plan=db.scalar(select(Plan).where(Plan.user_id==user.id,Plan.event_id==event_id))
    if not user.verified: fail('email_unverified','Verify your email before setting reminders.',403)
    if not event or not plan or plan.status!='going': fail('not_going','Move this event to Going first.')
    if event.status=='cancelled': fail('event_cancelled','This event was cancelled.')
    try: validate_reminder_time(body.remind_at,event.starts_at,utcnow())
    except ValueError as exc: fail('invalid_reminder_time',str(exc))
    reminder=db.scalar(select(Reminder).where(Reminder.user_id==user.id,Reminder.event_id==event_id).with_for_update())
    if reminder and (reminder.sent_at or reminder.status in ('submitting','unknown')):
        fail('reminder_already_sent','A reminder was already sent or delivery is being confirmed.',409)
    if reminder:
        reminder.remind_at=body.remind_at;reminder.event_version=event.version;reminder.status='pending'
        reminder.revision+=1;reminder.attempts=0;reminder.first_attempt_at=None;reminder.next_attempt_at=None
        reminder.delivery_payload=None;reminder.error=None
    else:
        reminder=Reminder(user_id=user.id,event_id=event_id,remind_at=body.remind_at,event_version=event.version)
        db.add(reminder)
    plan.notice=None
    db.flush()
    return reminder_dto(reminder)

@router.get('/{event_id}/reminder')
def get_reminder(event_id:str,user:User=Depends(require_user),db:Session=Depends(get_session)):
    reminder=db.scalar(select(Reminder).where(Reminder.user_id==user.id,Reminder.event_id==event_id))
    return reminder_dto(reminder) if reminder else None

@router.delete('/{event_id}/reminder')
def cancel(event_id:str,user:User=Depends(require_user),db:Session=Depends(get_session)):
    lock_user(db,user.id)
    cancel_pending_reminder(db,user.id,event_id,'Cancelled by you')
    return {'ok':True}
