from datetime import timedelta

from sqlalchemy import select

from app.events.time import utcnow
from app.models import Reminder, User
from tests.events.test_search import add_event


def setup(signed_in, db):
    u = db.scalar(select(User).where(User.email == "person@example.com"))
    u.verified = True
    event = add_event(db, hour=5)
    db.flush()
    assert signed_in.put(f"/api/me/plans/{event.id}", json={"status": "going"}).status_code == 200
    return event


def test_repeat_save_edits_one_schedule_and_can_schedule_after_sent(signed_in, db):
    event = setup(signed_in, db)
    url = f"/api/me/plans/{event.id}/reminders"
    times = [(event.starts_at - timedelta(hours=h)).isoformat() for h in (1, 2, 3)]
    first = signed_in.post(url, json={"remind_at": times[0]})
    assert first.status_code == 200
    for time in times[1:]:
        saved = signed_in.post(url, json={"remind_at": time})
        assert saved.status_code == 200
        assert saved.json()["id"] == first.json()["id"]
    assert len(signed_in.get(url).json()) == 1
    reminder = db.get(Reminder, first.json()["id"])
    reminder.status = "sent"
    reminder.sent_at = utcnow()
    db.flush()
    assert signed_in.patch(url + "/" + reminder.id, json={"remind_at": times[0]}).status_code == 409
    saved = signed_in.post(url, json={"remind_at": times[0]})
    assert saved.status_code == 200
    assert saved.json()["id"] != reminder.id
    assert signed_in.delete(url + "/" + saved.json()["id"]).status_code == 200
    assert db.get(Reminder, saved.json()["id"]).status == "cancelled"


def test_maybe_cancels_all_and_rejects_invalid_times(signed_in, db):
    event = setup(signed_in, db)
    url = f"/api/me/plans/{event.id}/reminders"
    for h in (1, 2):
        assert (
            signed_in.post(
                url, json={"remind_at": (event.starts_at - timedelta(hours=h)).isoformat()}
            ).status_code
            == 200
        )
    assert (
        signed_in.post(url, json={"remind_at": (utcnow() - timedelta(minutes=1)).isoformat()}).status_code
        == 400
    )
    plan = signed_in.get("/api/me/plans").json()["items"][0]
    assert (
        signed_in.put(
            f"/api/me/plans/{event.id}", json={"status": "maybe", "expected_version": plan["version"]}
        ).status_code
        == 200
    )
    assert all(r["status"] == "cancelled" for r in signed_in.get(url).json())
    assert (
        signed_in.post(
            url, json={"remind_at": (event.starts_at - timedelta(hours=1)).isoformat()}
        ).status_code
        == 400
    )


def test_reminders_for_different_events_send_independently(db):
    from app.reminders.delivery import deliver_one
    from tests.reminders.test_delivery import MailSink, setup_reminder

    first, event = setup_reminder(db)
    other = add_event(db, hour=6)
    from app.models import Plan

    db.add(Plan(user_id=first.user_id, event_id=other.id, status="going"))
    second = Reminder(
        user_id=first.user_id,
        event_id=other.id,
        event_version=event.version,
        remind_at=utcnow() - timedelta(seconds=2),
    )
    db.add(second)
    db.flush()
    sink = MailSink()
    for rid in (first.id, second.id):
        assert deliver_one(db, rid, sink) == "sent"
        assert deliver_one(db, rid, sink) == "ignored"
    assert len(sink.messages) == 2
