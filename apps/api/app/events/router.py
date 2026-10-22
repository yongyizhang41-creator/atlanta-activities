from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_session
from app.core.errors import fail
from app.core.security import require_user
from app.events.schemas import CATEGORIES, EventFilters
from app.events.service import COVERAGE, dto, search_events
from app.models import Event, SourceRun

router = APIRouter(prefix="/api", dependencies=[Depends(require_user)])


@router.get("/events")
def listing(
    week: str = "this", categories: list[str] = Query(default=[]), db: Session = Depends(get_session)
):
    try:
        filters = EventFilters(week=week, categories=categories)
    except ValueError:
        fail("invalid_filters", "Check your event filters.")
    return search_events(db, filters)


@router.post("/events/search")
def search(filters: EventFilters, db: Session = Depends(get_session)):
    return search_events(db, filters)


@router.post("/events/map")
def map_events(filters: EventFilters, db: Session = Depends(get_session)):
    return search_events(db, filters, map_only=True)


@router.get("/events/{event_id}")
def detail(event_id: str, db: Session = Depends(get_session)):
    event = db.get(Event, event_id)
    if not event:
        fail("not_found", "This event is no longer available.", 404)
    return dto(event)


@router.get("/config")
def config(db: Session = Depends(get_session)):
    style = (
        f"https://api.maptiler.com/maps/streets-v2/style.json?key={settings.maptiler_key}"
        if settings.maptiler_key
        else settings.map_style_url
    )
    runs = db.scalars(select(SourceRun).order_by(SourceRun.started_at.desc()).limit(20)).all()
    return {
        "categories": CATEGORIES,
        "coverage": COVERAGE,
        "map_style": style,
        "timezone": "America/New_York",
        "services": {
            "google": bool(settings.google_client_id),
            "ai": bool(settings.openai_api_key and settings.openai_model),
            "email": bool(settings.resend_api_key and settings.mail_from),
        },
        "sources": [
            {
                "name": r.source,
                "last_run": r.started_at,
                "finished_at": r.finished_at,
                "count": r.count,
                "status": "failed" if r.error else "ok",
            }
            for r in runs
        ],
    }
