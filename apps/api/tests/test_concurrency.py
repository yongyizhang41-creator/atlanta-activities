from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

from fastapi import HTTPException
from sqlalchemy import delete

from app.core.database import SessionLocal
from app.events.time import utcnow
from app.models import Event, User


def test_parallel_add_rechecks_going_set():
    from uuid import uuid4

    from app.plans.service import move_plan

    with SessionLocal() as db:
        user = User(email=f"{uuid4()}@example.com")
        db.add(user)
        db.flush()
        user_id = user.id
        ids = []
        for title in ["first", "second"]:
            event = Event(
                title=title,
                starts_at=utcnow() + timedelta(days=1),
                ends_at=utcnow() + timedelta(days=1, hours=2),
                venue="Concurrency fixture",
                latitude=33.77,
                longitude=-84.4,
                location="SRID=4326;POINT(-84.4 33.77)",
                source_urls=[],
            )
            db.add(event)
            db.flush()
            ids.append(event.id)
        db.commit()
    barrier = Barrier(2)

    def add(event_id):
        with SessionLocal() as db:
            barrier.wait(timeout=5)
            try:
                move_plan(db, user_id, event_id, "going")
                db.commit()
                return 200
            except HTTPException as exc:
                db.rollback()
                return exc.status_code

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(add, ids))
        assert sorted(statuses) == [200, 409]
    finally:
        with SessionLocal() as db:
            db.execute(delete(User).where(User.id == user_id))
            db.execute(delete(Event).where(Event.id.in_(ids)))
            db.commit()


def test_advisory_lease_remains_owned_across_db_commits():
    from uuid import uuid4

    from app.core.locks import exclusive_job

    key = str(uuid4())
    with exclusive_job(key) as acquired:
        assert acquired
        with SessionLocal() as db:
            db.commit()

        def competing():
            with exclusive_job(key) as other:
                return other

        with ThreadPoolExecutor(max_workers=1) as pool:
            assert pool.submit(competing).result() is False
    with exclusive_job(key) as acquired:
        assert acquired


def test_locked_read_refreshes_a_cached_cancelled_reminder():
    from uuid import uuid4

    from app.models import Plan, Reminder
    from app.reminders.delivery import deliver_one

    with SessionLocal() as owner:
        user = User(email=f"{uuid4()}@example.com", verified=True)
        owner.add(user)
        owner.flush()
        event = Event(
            title="Cancellation race fixture",
            starts_at=utcnow() + timedelta(hours=2),
            ends_at=utcnow() + timedelta(hours=3),
            venue="Fixture",
            latitude=33.77,
            longitude=-84.4,
            location="SRID=4326;POINT(-84.4 33.77)",
            source_urls=[],
        )
        owner.add(event)
        owner.flush()
        owner.add(Plan(user_id=user.id, event_id=event.id, status="going"))
        reminder = Reminder(
            user_id=user.id, event_id=event.id, event_version=1, remind_at=utcnow() - timedelta(seconds=1)
        )
        owner.add(reminder)
        owner.commit()
        uid, eid, rid = user.id, event.id, reminder.id
        try:
            with SessionLocal() as other:
                changed = other.get(Reminder, rid)
                changed.status = "cancelled"
                other.commit()

            class MustNotSend:
                def send(self, payload, key):
                    raise AssertionError("Cancelled reminder was submitted")

            assert reminder.status == "pending"  # intentionally stale identity-map state
            assert deliver_one(owner, rid, MustNotSend()) == "ignored"
        finally:
            owner.rollback()
            owner.execute(delete(User).where(User.id == uid))
            owner.execute(delete(Event).where(Event.id == eid))
            owner.commit()
