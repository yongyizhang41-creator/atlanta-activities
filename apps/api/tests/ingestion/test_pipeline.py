from datetime import timedelta
from pathlib import Path

from sqlalchemy import select

from app.events.time import utcnow


def test_campus_eligibility_and_time_are_preserved():
    from app.ingestion.parse import parse_gatech

    e = parse_gatech(
        (Path(__file__).parents[1] / "fixtures/sources/gatech-event.html").read_text(),
        "https://calendar.gatech.edu/event/2026/10/22/diy-candle-making-event",
    )
    assert e["title"] == "DIY Candle Making Event"
    assert e["starts_at"].isoformat() == "2026-10-22T21:30:00+00:00"
    assert e["ends_at"].isoformat() == "2026-10-22T23:30:00+00:00"
    assert "Graduate students" in e["eligibility"]


def test_repeat_ingestion_is_idempotent_and_reschedule_cancels(db):
    from app.ingestion.service import upsert_event
    from app.models import Event, Reminder, User

    start = utcnow() + timedelta(days=1)
    data = {
        "title": "A real-shaped test event",
        "starts_at": start,
        "ends_at": start + timedelta(hours=1),
        "venue": "Test venue",
        "latitude": 33.7756,
        "longitude": -84.3963,
        "source_urls": ["https://example.org/event"],
        "categories": ["Community"],
    }
    first = upsert_event(db, "test:1", data)
    second = upsert_event(db, "test:1", data)
    assert first.id == second.id
    assert len(db.scalars(select(Event)).all()) == 1
    user = User(email="ingestion@example.com", verified=True)
    db.add(user)
    db.flush()
    reminder = Reminder(
        user_id=user.id, event_id=first.id, event_version=1, remind_at=start - timedelta(hours=1)
    )
    db.add(reminder)
    db.flush()
    upsert_event(
        db, "test:1", {**data, "starts_at": start + timedelta(hours=2), "ends_at": start + timedelta(hours=3)}
    )
    db.refresh(reminder)
    assert first.version == 2
    assert reminder.status == "cancelled"


def test_shared_series_url_has_distinct_stable_occurrence_keys():
    from datetime import datetime, timezone

    from app.ingestion.parse import identified_occurrences

    url = "https://example.org/weekly-series"
    first = {"source_urls": [url], "starts_at": datetime(2026, 10, 24, tzinfo=timezone.utc)}
    second = {"source_urls": [url], "starts_at": datetime(2026, 10, 31, tzinfo=timezone.utc)}
    items = list(identified_occurrences([first, second]))
    assert len({key for key, e in items}) == 2
    assert list(identified_occurrences([second], known_series={url}))[0][0] == items[1][0]


def test_stadium_event_start_is_not_gate_open_time():
    from app.ingestion.parse import parse_stadium

    e = parse_stadium(
        (Path(__file__).parents[1] / "fixtures/sources/mbs-event.html").read_text(),
        "https://www.mercedesbenzstadium.com/events/university-of-georgia-vs-university-of-florida",
    )
    assert e["starts_at"].isoformat() == "2026-10-31T19:30:00+00:00"
    assert e["ends_at"] is None
    assert "Football" in e["categories"]


def test_downtown_listing_uses_explicit_time_and_week_year():
    from datetime import datetime, timezone

    from app.ingestion.parse import parse_downtown

    events = parse_downtown(
        (Path(__file__).parents[1] / "fixtures/sources/downtown-listing.html").read_text(),
        "https://downtownatlantainc.com/events",
        datetime(2026, 10, 19, tzinfo=timezone.utc),
        datetime(2026, 11, 2, tzinfo=timezone.utc),
    )
    e = next(e for e in events if "Fright Night at Founders Green" in e["title"])
    assert e["starts_at"].isoformat() == "2026-10-23T22:30:00+00:00"
    assert e["ends_at"].isoformat() == "2026-10-24T01:00:00+00:00"


def test_jsonld_does_not_publish_script_source_url():
    from app.ingestion.parse import jsonld_events

    html = '<script type="application/ld+json">{"@type":"Event","name":"Test","startDate":"2026-10-24T12:00:00-04:00","url":"javascript:alert(1)","location":{"@type":"Place","name":"Arena"}}</script>'
    result = jsonld_events(html, "https://example.org/event")
    assert result[0]["source_urls"] == ["https://example.org/event"]


def test_backend_geocoder_uses_independent_provider(monkeypatch):
    from app.ingestion.geocoding import NominatimGeocoder
    from app.ingestion.service import Geocoder

    monkeypatch.setattr(NominatimGeocoder, "locate", lambda self, query: (-84.3963, 33.7756))
    result = Geocoder().resolve({"venue": "Uncached fixture building"})
    assert result["longitude"] == -84.3963
    assert result["latitude"] == 33.7756
