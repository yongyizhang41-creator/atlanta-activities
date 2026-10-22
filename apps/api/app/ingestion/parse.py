import json
import re
from datetime import timezone
from dateutil.parser import isoparse
from bs4 import BeautifulSoup
from app.events.time import NY

def date(value):
    dt=isoparse(value)
    return (dt.replace(tzinfo=NY) if dt.tzinfo is None else dt).astimezone(timezone.utc)

def text(node):
    return node.get_text(' ',strip=True) if node else ''

def categories(title,description='',campus=False):
    value=f'{title} {description}'.lower()
    result=['Georgia Tech'] if campus else []
    for name,words in [('Football',['football','falcons','yellow jackets']),('Parade',['parade','procession']),('Sports',['basketball','volleyball','soccer','hawks','dream:','pickleball','billiard','sport','bridge','wnba']),('Music',['concert','music','orchestra','symphony','tour','singer']),('Arts',['theatre','theater','movie','art ','dance','candle','comedy']),('Festival',['festival','fest ','celebration','halloween'])]:
        if any(w in value for w in words): result.append(name)
    return list(dict.fromkeys(result or ['Community']))

def parse_gatech(html,url):
    soup=BeautifulSoup(html,'html.parser');article=soup.select_one('article.mercury-event')
    if not article: raise ValueError('Georgia Tech event layout changed')
    title=text(article.select_one('h1'))
    times=article.select('#add-cal time[datetime]')
    if not times: times=article.select('time[datetime]')
    if not times: raise ValueError('Missing start time')
    location=article.select_one('.location')
    if location and location.label: location.label.decompose()
    description=text(article.select_one('.description'))
    audiences=[text(a) for a in article.select('.invited-audience a')]
    return {'title':title,'description':description,'starts_at':date(times[0]['datetime']),
        'ends_at':date(times[1]['datetime']) if len(times)>1 else None,'venue':text(location),
        'categories':categories(title,description,True),'eligibility':', '.join(audiences) or 'Eligibility unconfirmed',
        'source_urls':[url],'status':'cancelled' if re.search(r'cancel[le]+d',title,re.I) else 'scheduled'}

def jsonld_events(html,url):
    soup=BeautifulSoup(html,'html.parser');events=[]
    def walk(value):
        if isinstance(value,list):
            for item in value: walk(item)
        elif isinstance(value,dict):
            types=value.get('@type',[]);types=[types] if isinstance(types,str) else types
            if any(t.endswith('Event') for t in types) and value.get('startDate'):
                events.append(value)
            else:
                for child in value.values():
                    if isinstance(child,(dict,list)):walk(child)
    for tag in soup.select('script[type="application/ld+json"]'):
        try:walk(json.loads(tag.get_text()))
        except (ValueError,TypeError):continue
    result=[]
    for raw in events:
        location=raw.get('location') or {}
        if isinstance(location,list):location=location[0] if location else {}
        if not isinstance(location,dict) or location.get('@type')=='VirtualLocation':continue
        geo=location.get('geo') or {};address=location.get('address') or ''
        if isinstance(address,dict):address=', '.join(str(address.get(k,'')) for k in ['streetAddress','addressLocality','addressRegion','postalCode']).strip(', ')
        offers=raw.get('offers') or {};offers=offers[0] if isinstance(offers,list) and offers else offers
        title=raw.get('name','');description=text(BeautifulSoup(raw.get('description',''),'html.parser'))
        item={'title':title,'description':description,'starts_at':date(raw['startDate']),
            'ends_at':date(raw['endDate']) if raw.get('endDate') else None,'venue':location.get('name',''),'address':address,
            'categories':categories(title,description),'source_urls':[raw.get('url') or url],
            'status':'cancelled' if 'Cancelled' in raw.get('eventStatus','') else 'scheduled',
            'price':str(offers['price'])+' '+str(offers.get('priceCurrency','')) if isinstance(offers,dict) and 'price' in offers else 'Price unconfirmed',
            'eligibility':'Eligibility unconfirmed'}
        if geo.get('latitude') is not None and geo.get('longitude') is not None:
            item.update(latitude=float(geo['latitude']),longitude=float(geo['longitude']))
        result.append(item)
    return result
