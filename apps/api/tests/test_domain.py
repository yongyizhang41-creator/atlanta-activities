from datetime import datetime, timedelta, timezone

import pytest


def test_adjacent_intervals_do_not_overlap():
    from app.plans.conflicts import overlap

    now = datetime(2026, 10, 22, 16, tzinfo=timezone.utc)
    assert overlap(now, now + timedelta(hours=1), now + timedelta(hours=1), now + timedelta(hours=2)) is None
    assert overlap(now, now + timedelta(hours=2), now + timedelta(hours=1), now + timedelta(hours=3)) == (
        now + timedelta(hours=1),
        now + timedelta(hours=2),
    )


def test_reminder_strict_bounds():
    from app.reminders.service import validate_reminder_time

    now = datetime(2026, 10, 22, tzinfo=timezone.utc)
    start = now + timedelta(hours=2)
    for bad in [
        now,
        now - timedelta(seconds=1),
        start,
        start + timedelta(seconds=1),
        now.replace(tzinfo=None),
    ]:
        with pytest.raises(ValueError):
            validate_reminder_time(bad, start, now)
    validate_reminder_time(now + timedelta(hours=1), start, now)
