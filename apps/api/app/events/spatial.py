import math
from shapely.geometry import shape, mapping

def validate_polygon(geojson: dict) -> dict:
    try:
        if geojson.get('type') != 'Polygon' or len(geojson['coordinates']) != 1:
            raise ValueError('Draw one polygon without holes')
        ring = geojson['coordinates'][0]
        if len(ring) < 4 or len(ring) > 200 or ring[0] != ring[-1]:
            raise ValueError('Polygon requires 4–200 coordinates and a closed ring')
        for point in ring:
            if len(point) != 2 or not all(math.isfinite(x) for x in point):
                raise ValueError('Invalid coordinates')
            if not (-180 <= point[0] <= 180 and -90 <= point[1] <= 90):
                raise ValueError('Invalid coordinates')
        polygon = shape(geojson)
        if not polygon.is_valid or polygon.area <= 0:
            raise ValueError('Polygon must not cross itself')
        return mapping(polygon)
    except (KeyError, TypeError, IndexError):
        raise ValueError('Invalid polygon') from None
