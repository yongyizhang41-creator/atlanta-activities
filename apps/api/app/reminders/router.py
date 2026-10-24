from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.errors import fail
from app.core.security import lock_user, require_user
from app.events.time import utcnow
from app.models import Event, Plan, Reminder, User
from app.plans.service import reminder_dto
from app.reminders.service import cancel_pending_reminder, validate_reminder_time

router = APIRouter(prefix="/api/me/plans")


class ReminderInput(BaseModel):
    remind_at: datetime


@router.put("/{event_id}/reminder")
def set_reminder(
    event_id: str, body: ReminderInput, user: User = Depends(require_user), db: Session = Depends(get_session)
):
    return add_reminder(event_id, body, user, db)


@router.get("/{event_id}/reminder")
def get_reminder(event_id: str, user: User = Depends(require_user), db: Session = Depends(get_session)):
    reminder = db.scalar(
        select(Reminder)
        .where(
            Reminder.user_id == user.id,
            Reminder.event_id == event_id,
            Reminder.status.not_in(["sent", "cancelled"]),
        )
        .order_by(Reminder.remind_at)
    )
    return reminder_dto(reminder) if reminder else None


@router.delete("/{event_id}/reminder")
def cancel(event_id: str, user: User = Depends(require_user), db: Session = Depends(get_session)):
    lock_user(db, user.id)
    cancel_pending_reminder(db, user.id, event_id, "Cancelled by you")
    return {"ok": True}


# All save endpoints share one current schedule per user/event.
def going_event(db, user, event_id):
    lock_user(db, user.id)
    event = db.scalar(select(Event).where(Event.id == event_id).with_for_update())
    plan = db.scalar(select(Plan).where(Plan.user_id == user.id, Plan.event_id == event_id))
    if not user.verified:
        fail("email_unverified", "Verify your email before setting reminders.", 403)
    if not event or not plan or plan.status != "going":
        fail("not_going", "Move this event to Going first.")
    if event.status == "cancelled":
        fail("event_cancelled", "This event was cancelled.")
    return event, plan


def check_time(event, body):
    try:
        validate_reminder_time(body.remind_at, event.starts_at, utcnow())
    except ValueError as exc:
        fail("invalid_reminder_time", str(exc))


@router.get("/{event_id}/reminders")
def list_reminders(event_id: str, user: User = Depends(require_user), db: Session = Depends(get_session)):
    return [
        reminder_dto(r)
        for r in db.scalars(
            select(Reminder)
            .where(Reminder.user_id == user.id, Reminder.event_id == event_id)
            .order_by(Reminder.remind_at)
        )
    ]


@router.post("/{event_id}/reminders")
def add_reminder(
    event_id: str, body: ReminderInput, user: User = Depends(require_user), db: Session = Depends(get_session)
):
    event, plan = going_event(db, user, event_id)
    return save_current_reminder(db, user, event, plan, body)


def save_current_reminder(db, user, event, plan, body, selected=None):
    check_time(event, body)
    reminders = db.scalars(
        select(Reminder)
        .where(Reminder.user_id == user.id, Reminder.event_id == event.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).all()
    # Dispatch uses the same user/event lock. Once submitted, a delivery cannot
    # be recalled or safely replaced while provider acknowledgement is unknown.
    if any(r.status not in ("sent", "cancelled") and not reminder_dto(r)["editable"] for r in reminders):
        fail(
            "reminder_submitted",
            "Delivery is already submitted or awaiting confirmation. Its time cannot be changed.",
            409,
        )
    editable = [r for r in reminders if reminder_dto(r)["editable"]]
    reminder = selected or next(iter(editable), None)
    for old in editable:
        if old is not reminder:
            old.status = "cancelled"
            old.error = "Replaced by your latest reminder"
    if reminder is None:
        reminder = Reminder(
            user_id=user.id, event_id=event.id, event_version=event.version, remind_at=body.remind_at
        )
        db.add(reminder)
    else:
        reminder.remind_at = body.remind_at
        reminder.event_version = event.version
        reminder.status = "pending"
        reminder.revision += 1
        reminder.attempts = 0
        reminder.first_attempt_at = None
        reminder.next_attempt_at = None
        reminder.delivery_payload = None
        reminder.error = None
    plan.notice = None
    db.flush()
    return reminder_dto(reminder)


def owned_editable(db, user, event_id, reminder_id):
    reminder = db.scalar(
        select(Reminder)
        .where(Reminder.id == reminder_id, Reminder.user_id == user.id, Reminder.event_id == event_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not reminder:
        fail("not_found", "Reminder not found.", 404)
    if not reminder_dto(reminder)["editable"]:
        fail(
            "reminder_submitted", "This email was already submitted or sent. Add a new reminder instead.", 409
        )
    return reminder


@router.patch("/{event_id}/reminders/{reminder_id}")
def edit_reminder(
    event_id: str,
    reminder_id: str,
    body: ReminderInput,
    user: User = Depends(require_user),
    db: Session = Depends(get_session),
):
    event, plan = going_event(db, user, event_id)
    reminder = owned_editable(db, user, event_id, reminder_id)
    return save_current_reminder(db, user, event, plan, body, selected=reminder)


@router.delete("/{event_id}/reminders/{reminder_id}")
def delete_reminder(
    event_id: str, reminder_id: str, user: User = Depends(require_user), db: Session = Depends(get_session)
):
    lock_user(db, user.id)
    reminder = owned_editable(db, user, event_id, reminder_id)
    reminder.status = "cancelled"
    reminder.error = "Cancelled by you"
    return {"ok": True}
