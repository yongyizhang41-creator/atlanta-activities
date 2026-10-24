"""Low-volume public venue lookup; one persistent cache/limiter per application.

Public Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
Run this worker on one machine; all processes must share the cache path.
"""

import json
import math
import sqlite3
import time
from pathlib import Path

import httpx
from shapely.geometry import Point, shape

from app.core.config import settings
from app.events.service import COVERAGE


class NominatimGeocoder:
    def __init__(self, cache_path=None, *, transport=None, clock=time.time, sleep=time.sleep):
        self.path = Path(cache_path or settings.geocoding_cache_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.transport, self.clock, self.sleep = transport, clock, sleep

    def locate(self, query):
        key = " ".join(query.casefold().split())
        # The endpoint is part of the key so switching providers cannot reuse a negative result.
        key = settings.nominatim_url + ":" + key
        with sqlite3.connect(self.path, timeout=90) as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS locations (key TEXT PRIMARY KEY, coordinates TEXT, expires REAL)"
            )
            db.execute("CREATE TABLE IF NOT EXISTS limiter (id INTEGER PRIMARY KEY, last_request REAL)")
            db.commit()
            db.execute("BEGIN IMMEDIATE")
            try:
                row = db.execute("SELECT coordinates, expires FROM locations WHERE key=?", (key,)).fetchone()
                if row and row[1] > self.clock():
                    if row[0] is None:
                        raise ValueError("Could not reliably locate event (cached)")
                    return tuple(json.loads(row[0]))
                last = db.execute("SELECT last_request FROM limiter WHERE id=1").fetchone()
                if last:
                    self.sleep(max(0, 16 - (self.clock() - last[0])))
                db.execute("INSERT OR REPLACE INTO limiter VALUES (1,?)", (self.clock(),))
                # No retries or API key. Never send user location or private addresses here.
                with httpx.Client(
                    timeout=15,
                    transport=self.transport,
                    headers={
                        "User-Agent": "AtlantaActivitiesGeocoder/0.1 (public Atlanta event venues)",
                        "Accept-Language": "en",
                    },
                ) as client:
                    response = client.get(
                        settings.nominatim_url,
                        params={
                            "q": query + " Atlanta Georgia USA",
                            "format": "jsonv2",
                            "limit": 1,
                            "countrycodes": "us",
                            "bounded": 1,
                            "viewbox": "-84.42,33.81,-84.36,33.74",
                        },
                    )
                    response.raise_for_status()
                    results = response.json()
                coordinates = None
                if results:
                    try:
                        lon, lat = float(results[0]["lon"]), float(results[0]["lat"])
                        if (
                            math.isfinite(lon)
                            and math.isfinite(lat)
                            and any(
                                shape(f["geometry"]).covers(Point(lon, lat)) for f in COVERAGE["features"]
                            )
                        ):
                            coordinates = (lon, lat)
                    except (KeyError, TypeError, ValueError):
                        pass
                db.execute(
                    "INSERT OR REPLACE INTO locations VALUES (?,?,?)",
                    (
                        key,
                        json.dumps(coordinates) if coordinates else None,
                        self.clock() + (365 * 86400 if coordinates else 7 * 86400),
                    ),
                )
                if coordinates is None:
                    raise ValueError("Could not reliably locate event inside coverage")
                return coordinates
            finally:
                # Preserve the shared rate timestamp even after network errors.
                db.commit()
