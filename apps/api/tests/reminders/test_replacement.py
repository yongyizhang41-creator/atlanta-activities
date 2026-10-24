from datetime import timedelta

import pytest
from sqlalchemy import select

from app.events.time import utcnow
from app.models import Reminder
from tests.reminders.test_multiple import setup


@pytest.mark.parametrize("method", ["post", "put", "patch"])
def test_latest_save_replaces_old_time_and_only_latest_sends(signed_in, db, monkeypatch, method):
    from app.reminders import delivery
    from tests.reminders.test_delivery import MailSink

    event = setup(signed_in, db)
    now = utcnow()
    base = f"/api/me/plans/{event.id}"
    old_time, latest_time = now + timedelta(hours=1), now + timedelta(hours=2)
    first = signed_in.post(base + "/reminders", json={"remind_at": old_time.isoformat()}).json()
    url = base + ("/reminder" if method == "put" else "/reminders")
    if method == "patch":
        url += "/" + first["id"]
    saved = getattr(signed_in, method)(url, json={"remind_at": latest_time.isoformat()})
    assert saved.status_code == 200, saved.text
    pending = db.scalars(select(Reminder).where(Reminder.status == "pending")).all()
    assert len(pending) == 1
    assert pending[0].remind_at == latest_time
    sink = MailSink()
    monkeypatch.setattr(delivery, "utcnow", lambda: old_time + timedelta(seconds=1))
    assert delivery.deliver_one(db, first["id"], sink) == "ignored"
    assert not sink.messages
    monkeypatch.setattr(delivery, "utcnow", lambda: latest_time + timedelta(seconds=1))
    assert delivery.deliver_one(db, saved.json()["id"], sink) == "sent"
    assert delivery.deliver_one(db, saved.json()["id"], sink) == "ignored"
    assert len(sink.messages) == 1


def test_save_replaces_legacy_multiple_pending_schedules(signed_in, db):
    event = setup(signed_in, db)
    base = f"/api/me/plans/{event.id}/reminders"
    first = signed_in.post(
        base, json={"remind_at": (event.starts_at - timedelta(hours=1)).isoformat()}
    ).json()
    user_id = db.get(Reminder, first["id"]).user_id
    duplicate = Reminder(
        user_id=user_id,
        event_id=event.id,
        event_version=event.version,
        remind_at=event.starts_at - timedelta(hours=2),
    )
    db.add(duplicate)
    db.flush()
    result = signed_in.post(base, json={"remind_at": duplicate.remind_at.isoformat()})
    assert result.status_code == 200, result.text
    active = db.scalars(select(Reminder).where(Reminder.status == "pending")).all()
    assert len(active) == 1
    assert active[0].id == result.json()["id"]


def test_invalid_replacement_preserves_current_schedule(signed_in, db):
    event = setup(signed_in, db)
    base = f"/api/me/plans/{event.id}/reminders"
    first = signed_in.post(
        base, json={"remind_at": (event.starts_at - timedelta(hours=1)).isoformat()}
    ).json()
    assert (
        signed_in.post(base, json={"remind_at": (utcnow() - timedelta(minutes=1)).isoformat()}).status_code
        == 400
    )
    db.refresh(db.get(Reminder, first["id"]))
    assert db.get(Reminder, first["id"]).status == "pending"


def test_unknown_delivery_cannot_be_overwritten(signed_in, db):
    event = setup(signed_in, db)
    base = f"/api/me/plans/{event.id}/reminders"
    first = signed_in.post(
        base, json={"remind_at": (event.starts_at - timedelta(hours=1)).isoformat()}
    ).json()
    reminder = db.get(Reminder, first["id"])
    reminder.status = "unknown"
    reminder.first_attempt_at = utcnow()
    db.flush()
    response = signed_in.post(base, json={"remind_at": (event.starts_at - timedelta(hours=2)).isoformat()})
    assert response.status_code == 409
    assert len(db.scalars(select(Reminder)).all()) == 1
