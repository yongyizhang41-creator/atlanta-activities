from datetime import timedelta
from sqlalchemy import text

def add_event(db,title='Campus game',hour=1,categories=None,lat=33.7756,lon=-84.3963):
    from app.models import Event
    from app.events.time import utcnow
    event=Event(title=title,starts_at=utcnow()+timedelta(hours=hour),ends_at=utcnow()+timedelta(hours=hour+1),venue='Student Center',latitude=lat,longitude=lon,location=f'SRID=4326;POINT({lon} {lat})',categories=categories or ['Georgia Tech'],source_urls=['https://calendar.gatech.edu'])
    db.add(event); db.flush()
    return event

def test_category_or_geo_and(signed_in,db):
    add_event(db,categories=['Football']);add_event(db,title='Concert',categories=['Music'])
    add_event(db,title='Outside',categories=['Music'],lat=34.1,lon=-84.4)
    r=signed_in.post('/api/events/search',json={'categories':['Football','Music']})
    assert r.status_code==200,r.text
    assert r.json()['total']==2
    assert signed_in.post('/api/events/search',json={'geo_mode':'radius','center':[-84.3963,33.7756],'radius_m':1000,'categories':['Football']}).json()['total']==1

def test_map_contains_events_beyond_first_page(signed_in,db):
    for i in range(4):add_event(db,title=f'Event {i}')
    assert len(signed_in.post('/api/events/search',json={'limit':1}).json()['items'])==1
    assert len(signed_in.post('/api/events/map',json={'limit':1}).json()['features'])==4

def test_invalid_filter_and_missing_event(signed_in):
    assert signed_in.post('/api/events/search',json={'geo_mode':'radius','center':[0,0],'radius_m':1}).status_code==422
    assert signed_in.get('/api/events/missing').status_code==404
