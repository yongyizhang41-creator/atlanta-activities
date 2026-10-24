"""Coverage-derived upper bound for useful nearby searches (same units as the UI)."""

import json
import math
from pathlib import Path

COVERAGE = json.loads((Path(__file__).resolve().parents[2] / "data/coverage.geojson").read_text())


def maximum_radius_m(center):
    lon, lat = map(math.radians, center)
    distances = []
    for feature in COVERAGE["features"]:
        geometry = feature["geometry"]
        polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        for polygon in polygons:
            for ring in polygon:
                for x, y in ring:
                    x, y = math.radians(x), math.radians(y)
                    h = (
                        math.sin((y - lat) / 2) ** 2
                        + math.cos(lat) * math.cos(y) * math.sin((x - lon) / 2) ** 2
                    )
                    distances.append(2 * 6371008.8 * math.asin(min(1, math.sqrt(h))))
    miles = max(distances, default=0) / 1609.344
    return min(50, max(0.1, math.ceil(miles * 10) / 10)) * 1609.344
