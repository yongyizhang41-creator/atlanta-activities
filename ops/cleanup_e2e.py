"""Remove only explicitly labelled local browser fixtures."""
from sqlalchemy import select,delete
from app.core.config import settings
from app.core.database import SessionLocal
from app.models import User,Event,Plan,Reminder,Chat,EventSource
if settings.environment=='production':raise SystemExit('Refusing production cleanup')
with SessionLocal() as db:
    user=db.scalar(select(User).where(User.email=='e2e-local@example.com'))
    if user:db.delete(user);db.flush()
    ids=list(db.scalars(select(Event.id).where(Event.title.like('[E2E] %'))))
    if ids:
        for model in (Plan,Reminder,Chat,EventSource):db.execute(delete(model).where(model.event_id.in_(ids)))
        db.execute(delete(Event).where(Event.id.in_(ids)))
    db.commit()
print('Local E2E fixtures removed; real collected activities retained.')
