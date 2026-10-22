import json
from pathlib import Path
from sqlalchemy import select, func, or_, and_, cast
from geoalchemy2 import Geometry
from app.events.time import utcnow, week_bounds
from app.models import Event

COVERAGE=json.loads((Path(__file__).resolve().parents[2]/'data/coverage.geojson').read_text())

def dto(event):
    return {k:getattr(event,k) for k in ['id','title','description','starts_at','ends_at','venue','address','latitude','longitude','categories','eligibility','price','registration','status','version','source_urls','last_verified_at']}

def filtered_query(filters,now):
    start,end=week_bounds(now,filters.week)
    query=select(Event).where(Event.starts_at<end,or_(
        and_(Event.ends_at.is_not(None),Event.ends_at>start,Event.ends_at>now),
        and_(Event.ends_at.is_(None),Event.starts_at>=start,Event.starts_at>now)))
    coverage=[func.ST_GeomFromGeoJSON(json.dumps(f['geometry'])) for f in COVERAGE['features']]
    query=query.where(or_(*(func.ST_Covers(p,cast(Event.location,Geometry(srid=4326))) for p in coverage)))
    if filters.categories:
        query=query.where(or_(*(Event.categories.contains([c]) for c in filters.categories)))
    if filters.geo_mode=='radius':
        point=func.ST_SetSRID(func.ST_MakePoint(*filters.center),4326)
        from geoalchemy2 import Geography
        query=query.where(func.ST_DWithin(Event.location,cast(point,Geography()),filters.radius_m))
    if filters.geo_mode=='polygon':
        query=query.where(func.ST_Covers(func.ST_GeomFromGeoJSON(json.dumps(filters.polygon)),cast(Event.location,Geometry(srid=4326))))
    return query

def search_events(db,filters,now=None,map_only=False):
    now=now or utcnow()
    query=filtered_query(filters,now)
    total=db.scalar(select(func.count()).select_from(query.subquery()))
    start,end=week_bounds(now,filters.week)
    if map_only:
        # A point per matching event for the two-week domain; client clusters all points.
        events=db.scalars(query.order_by(Event.starts_at,Event.id)).all()
        return {'type':'FeatureCollection','features':[{'type':'Feature','geometry':{'type':'Point','coordinates':[e.longitude,e.latitude]},'properties':{'id':e.id,'title':e.title,'category':e.categories[0] if e.categories else 'Community'}} for e in events],'total':total}
    events=db.scalars(query.order_by(Event.starts_at,Event.id).offset(filters.cursor).limit(filters.limit)).all()
    return {'items':[dto(e) for e in events],'total':total,'next_cursor':filters.cursor+len(events) if filters.cursor+len(events)<total else None,'week_start':start,'week_end':end,'server_now':now}
