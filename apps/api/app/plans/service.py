import hashlib
import json

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import or_, select

from app.core.config import settings
from app.core.errors import fail
from app.core.security import lock_user
from app.events.service import dto
from app.events.time import NY, utcnow
from app.models import Event, Plan, Reminder
from app.plans.conflicts import overlap
from app.reminders.service import cancel_pending_reminder

signer = URLSafeTimedSerializer(settings.secret_key, salt="conflict-confirmation")


def conflicts_for(db, user_id, event):
    existing = db.execute(
        select(Plan, Event)
        .join(Event, Event.id == Plan.event_id)
        .where(
            Plan.user_id == user_id, Plan.status == "going", Event.id != event.id, Event.status != "cancelled"
        )
    ).all()
    conflicts = []
    unknown = []
    fingerprint = []
    if not event.ends_at:
        unknown.append({"id": event.id, "title": event.title})
    for plan, other in existing:
        fingerprint.append((other.id, other.version, plan.version))
        if other.ends_at and other.ends_at <= utcnow():
            continue
        if not other.ends_at:
            unknown.append({"id": other.id, "title": other.title})
            continue
        times = overlap(event.starts_at, event.ends_at, other.starts_at, other.ends_at)
        if times:
            conflicts.append(
                {
                    "event_id": other.id,
                    "title": other.title,
                    "starts_at": other.starts_at,
                    "ends_at": other.ends_at,
                    "overlap_start": times[0],
                    "overlap_end": times[1],
                }
            )
    stamp = hashlib.sha256(json.dumps(sorted(fingerprint)).encode()).hexdigest()
    return conflicts, unknown, stamp


def plan_dto(db, plan):
    event = db.get(Event, plan.event_id)
    conflicts, unknown, _ = (
        conflicts_for(db, plan.user_id, event)
        if plan.status == "going" and event.status != "cancelled"
        else ([], [], None)
    )
    reminders = db.scalars(
        select(Reminder)
        .where(Reminder.user_id == plan.user_id, Reminder.event_id == plan.event_id)
        .order_by(Reminder.remind_at)
    ).all()
    reminder = next(
        (r for r in reminders if r.status in ("pending", "retry")), reminders[-1] if reminders else None
    )
    return {
        "event_id": plan.event_id,
        "status": plan.status,
        "position": plan.position,
        "version": plan.version,
        "notice": plan.notice,
        "event": dto(event),
        "conflicts": conflicts,
        "unknown_end_events": unknown,
        "has_sent_reminder": any(r.sent_at for r in reminders),
        "reminders": [reminder_dto(r) for r in reminders],
        "reminder": reminder_dto(reminder) if reminder else None,
    }


def reminder_dto(r):
    return {
        "id": r.id,
        "event_id": r.event_id,
        "remind_at": r.remind_at,
        "status": r.status,
        "sent_at": r.sent_at,
        "error": r.error,
        "editable": r.status in ("pending", "retry", "failed")
        and r.first_attempt_at is None
        and not r.sent_at,
    }


def move_plan(db, user_id, event_id, status, expected_version=None, confirmation_token=None):
    lock_user(db, user_id)
    event = db.scalar(select(Event).where(Event.id == event_id).with_for_update())
    if not event:
        fail("not_found", "This event is no longer available.", 404)
    now = utcnow()
    unknown_date_passed = (
        event.ends_at is None and event.starts_at.astimezone(NY).date() < now.astimezone(NY).date()
    )
    if (
        event.status == "cancelled"
        or (event.ends_at is not None and event.ends_at <= now)
        or unknown_date_passed
    ):
        fail("event_unavailable", "This event has ended or was cancelled.")
    plan = db.scalar(select(Plan).where(Plan.user_id == user_id, Plan.event_id == event_id))
    if plan and expected_version != plan.version:
        fail("stale_plan", "This plan changed in another tab. Refresh and try again.", 409)
    if status == "going" and (not plan or plan.status != "going"):
        if event.status == "cancelled" or (event.ends_at or event.starts_at) <= utcnow():
            fail("event_unavailable", "This event has ended or was cancelled.")
        conflicts, unknown, stamp = conflicts_for(db, user_id, event)
        if conflicts or unknown:
            payload = {"user": user_id, "event": event.id, "version": event.version, "stamp": stamp}
            valid = False
            if confirmation_token:
                try:
                    valid = signer.loads(confirmation_token, max_age=300) == payload
                except (BadSignature, SignatureExpired):
                    pass
            if not valid:
                fail(
                    "schedule_conflict",
                    "Review your schedule before adding this event.",
                    409,
                    conflicts=conflicts,
                    unknown_end_events=unknown,
                    token=signer.dumps(payload),
                )
    if plan:
        plan.status = status
        plan.version += 1
    else:
        positions = db.scalars(
            select(Plan.position).where(Plan.user_id == user_id, Plan.status == status)
        ).all()
        plan = Plan(
            user_id=user_id, event_id=event_id, status=status, position=max(positions, default=-1) + 1
        )
        db.add(plan)
    if status == "maybe":
        cancel_pending_reminder(db, user_id, event_id, "Moved to Maybe")
    db.flush()
    return plan_dto(db, plan)


def inactive_event_clause(now):
    midnight = now.astimezone(NY).replace(hour=0, minute=0, second=0, microsecond=0)
    return or_(
        Event.status == "cancelled",
        (Event.ends_at.is_not(None) & (Event.ends_at <= now)),
        (Event.ends_at.is_(None) & (Event.starts_at < midnight)),
    )


def prune_inactive_plans(db, user_id, now=None):
    """Remove only plans, preserving events and sent/uncertain delivery history."""
    now = now or utcnow()
    lock_user(db, user_id)
    rows = db.execute(
        select(Plan, Event)
        .join(Event, Event.id == Plan.event_id)
        .where(Plan.user_id == user_id, inactive_event_clause(now))
        .order_by(Event.id)
        .with_for_update(of=Event)
        .execution_options(populate_existing=True)
    ).all()
    for plan, event in rows:
        reason = (
            "Activity cancelled"
            if event.status == "cancelled"
            else ("Activity ended" if event.ends_at else "Activity date has passed")
        )
        cancel_pending_reminder(db, user_id, event.id, reason)
        db.delete(plan)
    db.flush()
    return len(rows)


def prune_all_inactive_plans():
    from app.core.database import SessionLocal

    with SessionLocal() as db:
        users = db.scalars(
            select(Plan.user_id)
            .join(Event, Event.id == Plan.event_id)
            .where(inactive_event_clause(utcnow()))
            .distinct()
        ).all()
    for user_id in users:
        # Release each user's locks before starting another user's cleanup.
        with SessionLocal() as db:
            prune_inactive_plans(db, user_id)
            db.commit()
