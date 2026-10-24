from datetime import timedelta

from app.events.time import utcnow
from app.models import Event, Plan, Reminder, User


def setup_reminder(db):
    now = utcnow()
    u = User(email="delivery@example.com", verified=True)
    db.add(u)
    db.flush()
    e = Event(
        title="Concert",
        venue="Arena",
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=3),
        latitude=33.76,
        longitude=-84.4,
        location="SRID=4326;POINT(-84.4 33.76)",
        source_urls=["https://example.org"],
    )
    db.add(e)
    db.flush()
    db.add(Plan(user_id=u.id, event_id=e.id, status="going"))
    r = Reminder(user_id=u.id, event_id=e.id, event_version=1, remind_at=now - timedelta(seconds=1))
    db.add(r)
    db.flush()
    return r, e


class MailSink:
    def __init__(self):
        self.messages = []

    def send(self, payload, key):
        self.messages.append(payload)
        return "provider-fixture"


def test_due_reminder_sends_once(db):
    from app.reminders.delivery import deliver_one

    r, e = setup_reminder(db)
    sink = MailSink()
    assert deliver_one(db, r.id, sink) == "sent"
    assert deliver_one(db, r.id, sink) == "ignored"
    assert r.sent_at is not None
    assert sink.messages[0]["to"] == ["delivery@example.com"]
    assert "Concert" in sink.messages[0]["subject"]
    assert len(sink.messages) == 1


def test_cancelled_or_late_never_sends(db):
    from app.reminders.delivery import deliver_one

    r, e = setup_reminder(db)
    sink = MailSink()
    e.status = "cancelled"
    db.flush()
    assert deliver_one(db, r.id, sink) == "cancelled"
    assert not sink.messages


def test_unknown_outside_provider_window_is_not_retried(db):
    from app.reminders.delivery import deliver_one

    r, e = setup_reminder(db)
    sink = MailSink()
    r.status = "unknown"
    r.first_attempt_at = utcnow() - timedelta(hours=24)
    r.delivery_payload = {"x": 1}
    db.flush()
    assert deliver_one(db, r.id, sink) == "unconfirmed"
    assert not sink.messages


def test_provider_timeout_then_plan_change_preserves_uncertainty(db):
    import httpx

    from app.reminders.delivery import deliver_one

    class TimeoutMail:
        def send(self, payload, key):
            raise httpx.ReadTimeout("provider accepted but reply lost")

    r, e = setup_reminder(db)
    assert deliver_one(db, r.id, TimeoutMail()) == "unknown"
    e.version += 1
    db.flush()
    assert deliver_one(db, r.id, MailSink()) == "ignored"  # next_attempt_at has not elapsed
    r.next_attempt_at = utcnow() - timedelta(seconds=1)
    db.flush()
    assert deliver_one(db, r.id, MailSink()) == "unconfirmed"


def test_backoff_is_filtered_before_batch_limit(db):
    from app.reminders.delivery import due_reminder_ids

    r, e = setup_reminder(db)
    r.status = "retry"
    r.next_attempt_at = utcnow() + timedelta(hours=1)
    db.flush()
    u = User(email="next-due@example.com", verified=True)
    db.add(u)
    db.flush()
    due = Reminder(
        user_id=u.id, event_id=e.id, event_version=1, remind_at=utcnow() - timedelta(milliseconds=1)
    )
    db.add(due)
    db.flush()
    assert due_reminder_ids(db, utcnow(), 1) == [due.id]


def test_missing_email_configuration_does_not_create_uncertain_delivery(db):
    from app.reminders.delivery import deliver_one
    from app.reminders.email import EmailUnavailable

    class MissingMail:
        def send(self, payload, key):
            raise EmailUnavailable("not configured")

    r, e = setup_reminder(db)
    assert deliver_one(db, r.id, MissingMail()) == "retry"
    assert r.first_attempt_at is None
    assert r.delivery_payload is None


def test_exhausted_expired_auth_mail_is_marked_expired(db):
    from app.models import MailJob
    from app.reminders.delivery import deliver_auth_mail

    user = User(email="old-auth@example.com")
    db.add(user)
    db.flush()
    job = MailJob(
        user_id=user.id,
        payload={"from": "", "to": ["old-auth@example.com"]},
        attempts=5,
        created_at=utcnow() - timedelta(hours=2),
    )
    db.add(job)
    db.flush()

    class NoSend:
        def send(self, payload, key):
            raise AssertionError("Expired authentication mail must not send")

    deliver_auth_mail(db=db, mail=NoSend())
    db.refresh(job)
    assert job.status == "expired"
