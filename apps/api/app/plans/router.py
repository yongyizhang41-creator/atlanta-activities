from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.errors import fail
from app.core.security import lock_user, require_user
from app.models import Plan, User
from app.plans.service import move_plan, plan_dto, prune_inactive_plans
from app.reminders.service import cancel_pending_reminder

router = APIRouter(prefix="/api/me/plans")


class Move(BaseModel):
    status: Literal["maybe", "going"]
    expected_version: int | None = None
    confirmation_token: str | None = Field(default=None, max_length=2000)


class OrderItem(BaseModel):
    event_id: str
    version: int


class Order(BaseModel):
    status: Literal["maybe", "going"]
    items: list[OrderItem] = Field(max_length=1000)


@router.get("")
def board(user: User = Depends(require_user), db: Session = Depends(get_session)):
    prune_inactive_plans(db, user.id)
    plans = db.scalars(select(Plan).where(Plan.user_id == user.id).order_by(Plan.position, Plan.id)).all()
    return {"items": [plan_dto(db, p) for p in plans]}


@router.post("/order")
def order(body: Order, user: User = Depends(require_user), db: Session = Depends(get_session)):
    lock_user(db, user.id)
    plans = db.scalars(select(Plan).where(Plan.user_id == user.id, Plan.status == body.status)).all()
    by_id = {p.event_id: p for p in plans}
    if len(body.items) != len(plans) or set(by_id) != {p.event_id for p in body.items}:
        fail("stale_plan", "The list changed. Refresh and try again.", 409)
    for position, item in enumerate(body.items):
        p = by_id[item.event_id]
        if p.version != item.version:
            fail("stale_plan", "The list changed. Refresh and try again.", 409)
        p.position = position
        p.version += 1
    return {"ok": True}


@router.put("/{event_id}")
def move(event_id: str, body: Move, user: User = Depends(require_user), db: Session = Depends(get_session)):
    return move_plan(db, user.id, event_id, body.status, body.expected_version, body.confirmation_token)


@router.delete("/{event_id}")
def remove(event_id: str, user: User = Depends(require_user), db: Session = Depends(get_session)):
    lock_user(db, user.id)
    plan = db.scalar(select(Plan).where(Plan.user_id == user.id, Plan.event_id == event_id))
    if plan:
        cancel_pending_reminder(db, user.id, event_id, "Removed from your plans")
        db.delete(plan)
    return {"ok": True}
