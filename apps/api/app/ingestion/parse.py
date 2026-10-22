import json
import re
from datetime import timezone
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from dateutil.parser import isoparse

from app.events.time import NY


def date(value):
    dt = isoparse(value)
    return (dt.replace(tzinfo=NY) if dt.tzinfo is None else dt).astimezone(timezone.utc)


def text(node):
    return node.get_text(" ", strip=True) if node else ""


def categories(title, description="", campus=False):
    value = f"{title} {description}".lower()
    result = ["Georgia Tech"] if campus else []
    for name, words in [
        ("Football", ["football", "falcons", "yellow jackets", "gridiron", "sec championship"]),
        ("Parade", ["parade", "procession"]),
        (
            "Sports",
            [
                "basketball",
                "volleyball",
                "soccer",
                "hawks",
                "dream:",
                "pickleball",
                "billiard",
                "sport",
                "bridge",
                "wnba",
            ],
        ),
        ("Music", ["concert", "music", "orchestra", "symphony", "tour", "singer"]),
        ("Arts", ["theatre", "theater", "movie", "art ", "dance", "candle", "comedy"]),
        ("Festival", ["festival", "fest ", "celebration", "halloween"]),
    ]:
        if any(w in value for w in words):
            result.append(name)
    return list(dict.fromkeys(result or ["Community"]))


def parse_gatech(html, url):
    soup = BeautifulSoup(html, "html.parser")
    article = soup.select_one("article.mercury-event")
    if not article:
        raise ValueError("Georgia Tech event layout changed")
    title = text(article.select_one("h1"))
    times = article.select("#add-cal time[datetime]")
    if not times:
        times = article.select("time[datetime]")
    if not times:
        raise ValueError("Missing start time")
    location = article.select_one(".location")
    if location and location.label:
        location.label.decompose()
    description = text(article.select_one(".description"))
    audiences = [text(a) for a in article.select(".invited-audience a")]
    return {
        "title": title,
        "description": description,
        "starts_at": date(times[0]["datetime"]),
        "ends_at": date(times[1]["datetime"]) if len(times) > 1 else None,
        "venue": text(location),
        "categories": categories(title, description, True),
        "eligibility": ", ".join(audiences) or "Eligibility unconfirmed",
        "source_urls": [url],
        "status": "cancelled" if re.search(r"cancel[le]+d", title, re.I) else "scheduled",
    }


def jsonld_events(html, url):
    soup = BeautifulSoup(html, "html.parser")
    events = []

    def walk(value):
        if isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, dict):
            types = value.get("@type", [])
            types = [types] if isinstance(types, str) else types
            if any(t.endswith("Event") for t in types) and value.get("startDate"):
                events.append(value)
            else:
                for child in value.values():
                    if isinstance(child, (dict, list)):
                        walk(child)

    for tag in soup.select('script[type="application/ld+json"]'):
        try:
            walk(json.loads(tag.get_text()))
        except (ValueError, TypeError):
            continue
    result = []
    for raw in events:
        location = raw.get("location") or {}
        if isinstance(location, list):
            location = location[0] if location else {}
        if not isinstance(location, dict) or location.get("@type") == "VirtualLocation":
            continue
        geo = location.get("geo") or {}
        address = location.get("address") or ""
        if isinstance(address, dict):
            address = ", ".join(
                str(address.get(k, ""))
                for k in ["streetAddress", "addressLocality", "addressRegion", "postalCode"]
            ).strip(", ")
        offers = raw.get("offers") or {}
        offers = offers[0] if isinstance(offers, list) and offers else offers
        title = raw.get("name", "")
        description = text(BeautifulSoup(raw.get("description", ""), "html.parser"))
        source_url = urljoin(url, raw.get("url") or url)
        if urlparse(source_url).scheme not in ("http", "https"):
            source_url = url
        item = {
            "title": title,
            "description": description,
            "starts_at": date(raw["startDate"]),
            "ends_at": date(raw["endDate"]) if raw.get("endDate") else None,
            "venue": location.get("name", ""),
            "address": address,
            "categories": categories(title, description),
            "source_urls": [source_url],
            "status": "cancelled" if "Cancelled" in raw.get("eventStatus", "") else "scheduled",
            "price": str(offers["price"]) + " " + str(offers.get("priceCurrency", ""))
            if isinstance(offers, dict) and "price" in offers
            else "Price unconfirmed",
            "eligibility": "Eligibility unconfirmed",
        }
        if geo.get("latitude") is not None and geo.get("longitude") is not None:
            item.update(latitude=float(geo["latitude"]), longitude=float(geo["longitude"]))
        result.append(item)
    return result


def identified_occurrences(events, known_series=()):
    """Stable occurrence ID where supplied; date suffix for otherwise ambiguous series URLs.

    Known series are remembered through persisted source-key suffixes. An ambiguous
    reschedule without a provider occurrence identifier creates a separate occurrence
    rather than silently changing somebody's existing plan.
    """
    from collections import Counter

    counts = Counter(e["source_urls"][0] for e in events)
    for event in events:
        url = event["source_urls"][0]
        if counts[url] > 1 or url in known_series:
            yield url + "#occurrence:" + event["starts_at"].isoformat(), event
        else:
            yield url, event


def parse_stadium(html, url):
    from datetime import timezone

    from dateutil.parser import parse

    soup = BeautifulSoup(html, "html.parser")
    date_text = text(soup.select_one(".event_hero_date"))
    title = text(
        soup.select_one(
            ".event_hero_content h1, .event_hero_content h2, .event_hero_content .heading-style-h1"
        )
    )
    if not title:
        title = text(soup.select_one('meta[property="og:title"]'))
        tag = soup.select_one('meta[property="og:title"]')
        if tag:
            title = tag.get("content", "").split(" | ")[0]
    start_time = ""
    for item in soup.select(".event_timeline--item"):
        if text(item.select_one(".event_timeline_label")).casefold() == "event start":
            start_time = text(item.select_one(".event_timeline_time"))
    if not title or not date_text or not start_time:
        raise ValueError("Stadium event start not confirmed")
    start = parse(date_text + " " + start_time).replace(tzinfo=NY).astimezone(timezone.utc)
    return {
        "title": title,
        "description": text(soup.select_one(".event_hero_content .w-richtext")),
        "starts_at": start,
        "ends_at": None,
        "venue": "Mercedes-Benz Stadium",
        "latitude": 33.7554,
        "longitude": -84.4009,
        "categories": categories(title),
        "source_urls": [url],
        "eligibility": "Eligibility unconfirmed",
    }


def parse_downtown(html, url, start, end):
    from datetime import timedelta, timezone
    from urllib.parse import urljoin

    from dateutil.parser import parse

    soup = BeautifulSoup(html, "html.parser")
    events = []
    for card in soup.select(".artcrd"):
        link = card.select_one('a[href^="/do/"]')
        month = text(card.select_one(".evcard-date-month"))
        day = text(card.select_one(".evcard-date-day"))
        time_text = text(card.select_one(".artcrd-content-time"))
        title = text(card.select_one(".artcrd-headline"))
        venue = text(card.select_one(".artcrd-content-venue"))
        if not all([link, month, day, time_text, title, venue]):
            continue
        times = re.findall(r"\d{1,2}(?::\d{2})?\s*(?:am|pm)", time_text, re.I)
        if not times:
            continue  # Never invent midnight for a missing start time.
        for year in {start.astimezone(NY).year, end.astimezone(NY).year}:
            try:
                start_at = (
                    parse(f"{month} {day} {year} {times[0]}").replace(tzinfo=NY).astimezone(timezone.utc)
                )
                end_at = (
                    parse(f"{month} {day} {year} {times[1]}").replace(tzinfo=NY).astimezone(timezone.utc)
                    if len(times) > 1
                    else None
                )
            except (ValueError, OverflowError):
                continue
            if end_at and end_at <= start_at:
                end_at += timedelta(days=1)
            if not start <= start_at < end:
                continue
            events.append(
                {
                    "title": title,
                    "description": "",
                    "venue": venue,
                    "starts_at": start_at,
                    "ends_at": end_at,
                    "categories": categories(title, text(card.select_one(".artcrd-subhead"))),
                    "source_urls": [urljoin(url, link["href"])],
                    "eligibility": "Eligibility unconfirmed",
                }
            )
    return events
