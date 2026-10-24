from datetime import timedelta

import pytest
from sqlalchemy import select

from app.events.time import NY, utcnow
from app.models import Plan, Reminder, User
from tests.plans.test_plans import event


def test_reading_board_removes_cancelled_and_ended_from_both_columns(signed_in, db):
    user = db.scalar(select(User).where(User.email == "person@example.com"))
    now = utcnow()
    ended = event(db, "Ended", now - timedelta(hours=3), now - timedelta(hours=1))
    cancelled = event(db, "Cancelled")
    cancelled.status = "cancelled"
    ongoing = event(db, "Ongoing", now - timedelta(hours=1), now + timedelta(hours=1))
    unknown = event(db, "Unknown end", now.astimezone(NY).replace(hour=0, minute=0, second=0, microsecond=0))
    unknown.ends_at = None
    future = event(db, "Future")
    for e, status in [
        (ended, "maybe"),
        (cancelled, "going"),
        (ongoing, "going"),
        (unknown, "maybe"),
        (future, "maybe"),
    ]:
        db.add(Plan(user_id=user.id, event_id=e.id, status=status))
    for minutes in (10, 20):
        db.add(
            Reminder(
                user_id=user.id,
                event_id=cancelled.id,
                event_version=1,
                remind_at=now + timedelta(minutes=minutes),
            )
        )
    sent = Reminder(
        user_id=user.id,
        event_id=ended.id,
        event_version=1,
        remind_at=now - timedelta(hours=4),
        status="sent",
        sent_at=now - timedelta(hours=4),
    )
    db.add(sent)
    other = User(email="other-cleanup@example.com", verified=True)
    db.add(other)
    db.flush()
    other_plan = Plan(user_id=other.id, event_id=ended.id, status="going")
    db.add(other_plan)
    db.flush()
    response = signed_in.get("/api/me/plans")
    assert response.status_code == 200
    assert {p["event"]["title"] for p in response.json()["items"]} == {"Ongoing", "Unknown end", "Future"}
    assert len(db.scalars(select(Plan).where(Plan.user_id == user.id)).all()) == 3
    for r in db.scalars(select(Reminder).where(Reminder.event_id == cancelled.id)):
        db.refresh(r)
        assert r.status == "cancelled"
    db.refresh(sent)
    assert sent.status == "sent"
    assert db.get(type(ended), ended.id) is not None
    assert db.get(Plan, other_plan.id) is not None  # Per-user board reads never delete another user's plans.


def test_ended_or_cancelled_cannot_be_readded_to_maybe(signed_in, db):
    e = event(db)
    e.status = "cancelled"
    db.flush()
    assert signed_in.put(f"/api/me/plans/{e.id}", json={"status": "maybe"}).status_code == 400


def test_worker_cleanup_without_opening_board(db):
    from app.plans.service import prune_inactive_plans

    user = User(email="cleanup@example.com", verified=True)
    db.add(user)
    db.flush()
    e = event(db)
    e.status = "cancelled"
    db.add(Plan(user_id=user.id, event_id=e.id, status="going"))
    db.flush()
    assert prune_inactive_plans(db, user.id) == 1
    assert prune_inactive_plans(db, user.id) == 0


@pytest.mark.parametrize("date", ["2026-10-23", "2026-11-01", "2027-03-14"])
def test_unknown_end_removed_at_next_eastern_midnight(db, date):
    from datetime import datetime

    from app.events.time import NY
    from app.plans.service import prune_inactive_plans

    day = datetime.fromisoformat(date).replace(tzinfo=NY)
    midnight = day + timedelta(days=1)
    user = User(email="midnight@example.com", verified=True)
    db.add(user)
    db.flush()
    e = event(db, "No end", day + timedelta(hours=1))
    e.ends_at = None
    # Confirmed overnight events must keep their real end time.
    overnight = event(db, "Overnight", day + timedelta(hours=23), midnight + timedelta(hours=3))
    for activity, status in [(e, "maybe"), (overnight, "going")]:
        db.add(Plan(user_id=user.id, event_id=activity.id, status=status))
    db.flush()
    assert prune_inactive_plans(db, user.id, now=midnight - timedelta(microseconds=1)) == 0
    assert prune_inactive_plans(db, user.id, now=midnight) == 1
    assert db.scalar(select(Plan).where(Plan.user_id == user.id)).event_id == overnight.id
