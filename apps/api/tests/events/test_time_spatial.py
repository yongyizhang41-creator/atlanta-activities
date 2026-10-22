from datetime import datetime, timezone
import pytest

def test_week_dst_boundaries():
    from app.events.time import week_bounds
    start,end=week_bounds(datetime(2026,10,29,tzinfo=timezone.utc),'this')
    assert start.isoformat()=='2026-10-26T04:00:00+00:00'
    assert end.isoformat()=='2026-11-02T05:00:00+00:00'
    assert (end-start).total_seconds()==169*3600

def test_polygon_includes_boundary():
    from app.events.spatial import validate_polygon
    from shapely.geometry import shape, Point
    p=validate_polygon({'type':'Polygon','coordinates':[[[-84.4,33.7],[-84.3,33.7],[-84.3,33.8],[-84.4,33.7]]]})
    assert shape(p).covers(Point(-84.4,33.7))

def test_polygon_rejects_self_intersection_and_over_200_vertices():
    from app.events.spatial import validate_polygon
    with pytest.raises(ValueError):
        validate_polygon({'type':'Polygon','coordinates':[[[0,0],[1,1],[0,1],[1,0],[0,0]]]})
    with pytest.raises(ValueError):
        validate_polygon({'type':'Polygon','coordinates':[[[0,0]]*201]})
