import json
import logging
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup
from shapely.geometry import Point, shape
from sqlalchemy import select, text

from app.core.database import SessionLocal
from app.core.locks import exclusive_job
from app.events.service import COVERAGE
from app.events.time import utcnow, week_bounds
from app.ingestion.parse import (
    identified_occurrences,
    jsonld_events,
    parse_downtown,
    parse_gatech,
    parse_stadium,
)
from app.models import Event, EventSource, Plan, SourceRun
from app.reminders.service import invalidate_event_reminders

logger = logging.getLogger(__name__)
AGENT = "AtlantaActivities/0.1 (+public-event-calendar)"
SOURCE_URLS = {
    "Georgia Tech": "https://calendar.gatech.edu/event-search",
    "State Farm Arena": "https://www.statefarmarena.com/events",
    "Mercedes-Benz Stadium": "https://www.mercedesbenzstadium.com/events",
    "Downtown Atlanta": "https://www.atlantadowntown.com/events",
}


def upsert_event(db, key, data):
    # Stable source identifiers survive a reschedule; exact cross-source match only.
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"), {"key": "event:" + key})
    source = db.get(EventSource, key)
    event = db.scalar(select(Event).where(Event.id == source.event_id).with_for_update()) if source else None
    if event is None:
        event = db.scalar(
            select(Event)
            .where(
                Event.title == data["title"],
                Event.starts_at == data["starts_at"],
                Event.venue == data["venue"],
            )
            .with_for_update()
        )
    if event:
        changed = (
            event.starts_at != data["starts_at"]
            or event.ends_at != data.get("ends_at")
            or event.status != data.get("status", "scheduled")
        )
        if changed:
            event.version += 1
            invalidate_event_reminders(
                db, event.id, "Event time or status changed. Review your plan and set a new reminder."
            )
        old_urls = event.source_urls
        for k, v in data.items():
            if hasattr(event, k):
                setattr(event, k, v)
        event.source_urls = list(dict.fromkeys(old_urls + data["source_urls"]))
        event.last_verified_at = utcnow()
    else:
        event = Event(**data, location=f"SRID=4326;POINT({data['longitude']} {data['latitude']})")
        db.add(event)
        db.flush()
    event.location = f"SRID=4326;POINT({event.longitude} {event.latitude})"
    if not source:
        db.add(EventSource(key=key, event_id=event.id))
    db.flush()
    return event


class Fetcher:
    def __init__(self):
        self.client = httpx.Client(timeout=25, follow_redirects=True, headers={"User-Agent": AGENT})
        self.robots = {}
        self.last = 0

    def get(self, url):
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in {
            "calendar.gatech.edu",
            "www.statefarmarena.com",
            "www.mercedesbenzstadium.com",
            "www.atlantadowntown.com",
        }:
            raise ValueError("Source URL is not on the allowlist")
        host = parsed.scheme + "://" + parsed.netloc
        if host not in self.robots:
            rp = RobotFileParser()
            response = self.client.get(host + "/robots.txt")
            if response.status_code == 200:
                rp.parse(response.text.splitlines())
            elif response.status_code == 404:
                rp.parse([])
            else:
                raise ValueError("Cannot verify source robots policy")
            self.robots[host] = rp
        rp = self.robots[host]
        if not rp.can_fetch(AGENT, url):
            raise ValueError("Source disallows this path")
        delay = max(1, rp.crawl_delay(AGENT) or 0)
        time.sleep(max(0, delay - (time.monotonic() - self.last)))
        response = self.client.get(url)
        self.last = time.monotonic()
        response.raise_for_status()
        if len(response.content) > 5_000_000:
            raise ValueError("Source response too large")
        return response.text

    def close(self):
        self.client.close()


class Geocoder:
    def __init__(self):
        self.cache_path = Path(__file__).resolve().parents[2] / "data/geocode-cache.json"
        self.cache = json.loads(self.cache_path.read_text()) if self.cache_path.exists() else {}

    def resolve(self, event):
        if "latitude" in event:
            return event
        venues_path = Path(__file__).resolve().parents[2] / "data/venues.json"
        for venue in json.loads(venues_path.read_text()):
            if event["venue"].casefold() in [a.casefold() for a in venue["aliases"]]:
                event.update(latitude=venue["latitude"], longitude=venue["longitude"])
                return event
        query = event.get("address") or event["venue"]
        key = query.casefold()
        cached = self.cache.get(key)
        if cached:
            event.update(latitude=cached[1], longitude=cached[0])
            return event
        from app.ingestion.geocoding import NominatimGeocoder

        lon, lat = NominatimGeocoder().locate(query)
        event.update(latitude=lat, longitude=lon)
        return event


def allowed_event(e):
    if not e.get("title") or not e.get("venue") or not e.get("source_urls"):
        return False
    if e.get("ends_at") and e["ends_at"] <= e["starts_at"]:
        return False
    content = (e["title"] + " " + e.get("description", "")).lower()
    if any(
        w in content
        for w in [
            "webinar",
            "virtual-only",
            "study with",
            "office hours",
            "career fair",
            "seminar",
            "info session",
            "research symposium",
        ]
    ):
        return False
    return any(
        shape(f["geometry"]).covers(Point(e["longitude"], e["latitude"])) for f in COVERAGE["features"]
    )


def collect(source, url, fetcher, start, end, planned_urls, known_series=()):
    html = fetcher.get(url)
    if source == "Georgia Tech":
        seen = set()
        page = 0
        while True:
            soup = BeautifulSoup(html, "html.parser")
            links = list(
                dict.fromkeys(
                    urljoin(url, a["href"])
                    for a in soup.select("a[href]")
                    if re.search(r"/event/\d{4}/\d{2}/\d{2}/", a["href"])
                )
            )
            reached = False
            for link in links:
                if link in seen:
                    continue
                seen.add(link)
                match = re.search(r"/event/(\d{4})/(\d{2})/(\d{2})/", link)
                if match and "-".join(match.groups()) > end.date().isoformat():
                    reached = True
                    continue
                e = parse_gatech(fetcher.get(link), link)
                if e["starts_at"] < end and (e.get("ends_at") or e["starts_at"]) >= start:
                    yield link, e
            nxt = soup.select_one('a[rel="next"]')
            if reached or not nxt or page >= 30:
                break
            page += 1
            html = fetcher.get(urljoin(url, nxt["href"]))
        for link in planned_urls:
            if link not in seen and urlparse(link).hostname == "calendar.gatech.edu":
                yield link, parse_gatech(fetcher.get(link), link)
    elif source == "Downtown Atlanta":
        yield from identified_occurrences(
            parse_downtown(html, "https://downtownatlantainc.com/events", start, end), known_series
        )
    else:
        yield from identified_occurrences(jsonld_events(html, url), known_series)
        if source == "Mercedes-Benz Stadium":
            soup = BeautifulSoup(html, "html.parser")
            links = set(
                urljoin(url, a["href"])
                for a in soup.select("a[href]")
                if a["href"].startswith("/events/") and "?" not in a["href"]
            )
            links.update(
                link for link in planned_urls if urlparse(link).hostname == "www.mercedesbenzstadium.com"
            )
            for link in sorted(links):
                detail_html = fetcher.get(link)
                parsed = jsonld_events(detail_html, link)
                if parsed:
                    yield from identified_occurrences(parsed, known_series)
                else:
                    try:
                        yield link, parse_stadium(detail_html, link)
                    except ValueError:
                        logger.info("Stadium event lacks confirmed start time; omitted")


def ingest_all(source_names=None):
    now = utcnow()
    start, _ = week_bounds(now, "this")
    _, end = week_bounds(now, "next")
    fetcher = Fetcher()
    geocoder = Geocoder()
    summary = {}
    try:
        for source, url in SOURCE_URLS.items():
            if source_names and source not in source_names:
                continue
            with exclusive_job("source:" + source) as acquired, SessionLocal() as db:
                if not acquired:
                    continue
                run = SourceRun(source=source)
                db.add(run)
                db.commit()
                count = 0
                rejected = 0
                try:
                    planned = [
                        u
                        for event in db.scalars(
                            select(Event).join(Plan, Plan.event_id == Event.id).where(Event.starts_at > now)
                        ).unique()
                        for u in event.source_urls
                    ]
                    known_series = {
                        k.split("#occurrence:", 1)[0]
                        for k in db.scalars(
                            select(EventSource.key).where(EventSource.key.contains("#occurrence:"))
                        )
                    }
                    for key, event in collect(source, url, fetcher, start, end, planned, known_series):
                        if event["starts_at"] >= end and key not in planned:
                            continue
                        if (event.get("ends_at") or event["starts_at"]) < now and key not in planned:
                            continue
                        try:
                            event = geocoder.resolve(event)
                            if not allowed_event(event):
                                rejected += 1
                                continue
                            upsert_event(db, key, event)
                            db.commit()
                            count += 1
                        except (ValueError, KeyError):
                            db.rollback()
                            rejected += 1
                    if count == 0:
                        run.error = f"No publishable events; {rejected} records omitted (coordinates, scope or fields)."
                except Exception as exc:
                    db.rollback()
                    run = db.get(SourceRun, run.id)
                    run.error = (
                        type(exc).__name__
                        + ": Source request or parsing failed. Check source availability and configuration."
                    )
                    logger.warning("Source failed: %s (%s)", source, type(exc).__name__)
                run.count = count
                run.finished_at = utcnow()
                db.commit()
                summary[source] = {"published": count, "omitted": rejected, "error": run.error}
    finally:
        fetcher.close()
    return summary
