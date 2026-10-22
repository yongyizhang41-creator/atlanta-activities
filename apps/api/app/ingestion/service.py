import hashlib
import json
import logging
import re
import time
from pathlib import Path
from urllib.parse import urljoin,urlparse
from urllib.robotparser import RobotFileParser
from datetime import timedelta
import httpx
from bs4 import BeautifulSoup
from shapely.geometry import shape,Point
from sqlalchemy import select,text
from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Event,EventSource,SourceRun,Plan
from app.events.time import utcnow,week_bounds
from app.events.service import COVERAGE
from app.ingestion.parse import parse_gatech,jsonld_events
from app.reminders.service import invalidate_event_reminders

logger=logging.getLogger(__name__)
AGENT='AtlantaActivities/0.1 (+public-event-calendar)'
SOURCE_URLS={'Georgia Tech':'https://calendar.gatech.edu/event-search','State Farm Arena':'https://www.statefarmarena.com/events','Mercedes-Benz Stadium':'https://www.mercedesbenzstadium.com/events','Downtown Atlanta':'https://www.atlantadowntown.com/events'}

def upsert_event(db,key,data):
    # Stable source identifiers survive a reschedule; exact cross-source match only.
    db.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:key,0))'),{'key':'event:'+key})
    source=db.get(EventSource,key)
    event=db.scalar(select(Event).where(Event.id==source.event_id).with_for_update()) if source else None
    if event is None:
        event=db.scalar(select(Event).where(Event.title==data['title'],Event.starts_at==data['starts_at'],Event.venue==data['venue']).with_for_update())
    if event:
        changed=event.starts_at!=data['starts_at'] or event.ends_at!=data.get('ends_at') or event.status!=data.get('status','scheduled')
        if changed:
            event.version+=1
            invalidate_event_reminders(db,event.id,'Event time or status changed. Review your plan and set a new reminder.')
        old_urls=event.source_urls
        for k,v in data.items():
            if hasattr(event,k):setattr(event,k,v)
        event.source_urls=list(dict.fromkeys(old_urls+data['source_urls']))
        event.last_verified_at=utcnow()
    else:
        event=Event(**data,location=f"SRID=4326;POINT({data['longitude']} {data['latitude']})")
        db.add(event);db.flush()
    event.location=f'SRID=4326;POINT({event.longitude} {event.latitude})'
    if not source:db.add(EventSource(key=key,event_id=event.id))
    db.flush()
    return event

class Fetcher:
    def __init__(self):
        self.client=httpx.Client(timeout=25,follow_redirects=True,headers={'User-Agent':AGENT})
        self.robots={};self.last=0
    def get(self,url):
        parsed=urlparse(url)
        if parsed.scheme!='https' or parsed.hostname not in {'calendar.gatech.edu','www.statefarmarena.com','www.mercedesbenzstadium.com','www.atlantadowntown.com'}:
            raise ValueError('Source URL is not on the allowlist')
        host=parsed.scheme+'://'+parsed.netloc
        if host not in self.robots:
            rp=RobotFileParser();response=self.client.get(host+'/robots.txt')
            if response.status_code==200:rp.parse(response.text.splitlines())
            elif response.status_code==404:rp.parse([])
            else:raise ValueError('Cannot verify source robots policy')
            self.robots[host]=rp
        rp=self.robots[host]
        if not rp.can_fetch(AGENT,url):raise ValueError('Source disallows this path')
        delay=max(1,rp.crawl_delay(AGENT) or 0)
        time.sleep(max(0,delay-(time.monotonic()-self.last)))
        response=self.client.get(url);self.last=time.monotonic();response.raise_for_status()
        if len(response.content)>5_000_000:raise ValueError('Source response too large')
        return response.text
    def close(self):self.client.close()

class Geocoder:
    def __init__(self):
        self.cache_path=Path(__file__).resolve().parents[2]/'data/geocode-cache.json'
        self.cache=json.loads(self.cache_path.read_text()) if self.cache_path.exists() else {}
    def resolve(self,event):
        if 'latitude' in event:return event
        query=event.get('address') or event['venue']
        key=query.casefold()
        cached=self.cache.get(key)
        if cached:
            event.update(latitude=cached[1],longitude=cached[0]);return event
        if not settings.maptiler_geocoding_key:
            raise ValueError('Reliable coordinates unavailable; configure MAPTILER_GEOCODING_KEY')
        with httpx.Client(timeout=15) as client:
            response=client.get('https://api.maptiler.com/geocoding/'+httpx.URL(query+' Atlanta Georgia USA').raw_path.decode()+'.json',params={'key':settings.maptiler_geocoding_key,'limit':1,'bbox':'-84.42,33.74,-84.36,33.81'})
            response.raise_for_status();features=response.json().get('features',[])
        if not features:raise ValueError('Could not locate event')
        lon,lat=features[0]['geometry']['coordinates']
        event.update(latitude=lat,longitude=lon)
        # Persist only where the account's geocoding licence permits permanent storage.
        return event

def allowed_event(e):
    if not e.get('title') or not e.get('venue') or not e.get('source_urls'):return False
    if e.get('ends_at') and e['ends_at']<=e['starts_at']:return False
    content=(e['title']+' '+e.get('description','')).lower()
    if any(w in content for w in ['webinar','virtual-only','study with','office hours','career fair','seminar','info session','research symposium']):return False
    return any(shape(f['geometry']).covers(Point(e['longitude'],e['latitude'])) for f in COVERAGE['features'])

def collect(source,url,fetcher,start,end,planned_urls):
    html=fetcher.get(url)
    if source=='Georgia Tech':
        seen=set();page=0
        while True:
            soup=BeautifulSoup(html,'html.parser')
            links=list(dict.fromkeys(urljoin(url,a['href']) for a in soup.select('a[href]') if re.search(r'/event/\d{4}/\d{2}/\d{2}/',a['href'])))
            reached=False
            for link in links:
                if link in seen:continue
                seen.add(link)
                match=re.search(r'/event/(\d{4})/(\d{2})/(\d{2})/',link)
                if match and '-'.join(match.groups())>end.date().isoformat():reached=True;continue
                e=parse_gatech(fetcher.get(link),link)
                if e['starts_at']<end and (e.get('ends_at') or e['starts_at'])>=start:yield link,e
            nxt=soup.select_one('a[rel="next"]')
            if reached or not nxt or page>=30:break
            page+=1;html=fetcher.get(urljoin(url,nxt['href']))
        for link in planned_urls:
            if link not in seen and urlparse(link).hostname=='calendar.gatech.edu':yield link,parse_gatech(fetcher.get(link),link)
    else:
        for e in jsonld_events(html,url):yield e['source_urls'][0],e
        if source=='Mercedes-Benz Stadium':
            soup=BeautifulSoup(html,'html.parser')
            links=set(urljoin(url,a['href']) for a in soup.select('a[href]') if a['href'].startswith('/events/') and '?' not in a['href'])
            links.update(link for link in planned_urls if urlparse(link).hostname=='www.mercedesbenzstadium.com')
            for link in sorted(links):
                for e in jsonld_events(fetcher.get(link),link):yield link,e

def ingest_all():
    now=utcnow();start,_=week_bounds(now,'this');_,end=week_bounds(now,'next')
    fetcher=Fetcher();geocoder=Geocoder();summary={}
    try:
        for source,url in SOURCE_URLS.items():
            with SessionLocal() as db:
                # One worker owns this source; acquisition is session scoped.
                acquired=db.scalar(text('SELECT pg_try_advisory_lock(hashtextextended(:key,0))'),{'key':'source:'+source})
                if not acquired:continue
                run=SourceRun(source=source);db.add(run);db.commit()
                count=0;rejected=0
                try:
                    planned=[u for event in db.scalars(select(Event).join(Plan,Plan.event_id==Event.id).where(Event.starts_at>now)).unique() for u in event.source_urls]
                    for key,event in collect(source,url,fetcher,start,end,planned):
                        if event['starts_at']>=end and key not in planned:continue
                        if (event.get('ends_at') or event['starts_at'])<now and key not in planned:continue
                        try:
                            event=geocoder.resolve(event)
                            if not allowed_event(event):rejected+=1;continue
                            upsert_event(db,key,event);db.commit();count+=1
                        except (ValueError,KeyError):
                            db.rollback();rejected+=1
                    if count==0:run.error=f'No publishable events; {rejected} records omitted (coordinates, scope or fields).'
                except Exception as exc:
                    db.rollback();run=db.get(SourceRun,run.id);run.error=type(exc).__name__+': '+str(exc)[:250]
                    logger.warning('Source failed: %s (%s)',source,type(exc).__name__)
                run.count=count;run.finished_at=utcnow();db.commit();summary[source]={'published':count,'omitted':rejected,'error':run.error}
                db.execute(text('SELECT pg_advisory_unlock(hashtextextended(:key,0))'),{'key':'source:'+source});db.commit()
    finally:fetcher.close()
    return summary
