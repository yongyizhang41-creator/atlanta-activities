from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
NY = ZoneInfo('America/New_York')

def utcnow():
    return datetime.now(timezone.utc)

def week_bounds(now: datetime, week: str):
    local = now.astimezone(NY)
    monday = local.date() - timedelta(days=local.weekday())
    if week == 'next':
        monday += timedelta(days=7)
    start = datetime.combine(monday, datetime.min.time(), NY)
    end = datetime.combine(monday + timedelta(days=7), datetime.min.time(), NY)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)
