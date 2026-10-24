from datetime import datetime

from sqlalchemy import select

from app.models import Plan, Reminder


def validate_reminder_time(remind_at: datetime, starts_at: datetime, now: datetime):
    if remind_at.tzinfo is None or remind_at.utcoffset() is None:
        raise ValueError("Choose a time with an explicit timezone offset")
    if not now < remind_at < starts_at:
        raise ValueError("Choose a future reminder before the event starts")


def cancel_pending_reminder(db, user_id, event_id, reason):
    for reminder in db.scalars(
        select(Reminder).where(Reminder.user_id == user_id, Reminder.event_id == event_id).with_for_update()
    ):
        if reminder.status in ("pending", "retry", "failed"):
            reminder.status = "cancelled"
            reminder.error = reason


def invalidate_event_reminders(db, event_id, reason):
    for reminder in db.scalars(select(Reminder).where(Reminder.event_id == event_id).with_for_update()):
        if reminder.status in ("pending", "retry", "failed"):
            reminder.status = "cancelled"
            reminder.error = reason
    for plan in db.scalars(select(Plan).where(Plan.event_id == event_id)):
        plan.notice = reason
        plan.version += 1
