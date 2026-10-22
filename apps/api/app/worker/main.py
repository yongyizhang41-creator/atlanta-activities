import argparse
import json
import logging
import time
from datetime import timedelta
from sqlalchemy import text
from app.core.database import SessionLocal
from app.events.time import utcnow
from app.models import WorkerState
from app.ingestion.service import ingest_all
from app.reminders.delivery import deliver_due_reminders,deliver_auth_mail

logging.basicConfig(level=logging.INFO)
logger=logging.getLogger('worker')

def tick():
    deliver_due_reminders();deliver_auth_mail()
    with SessionLocal() as db:
        db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended('scheduler',0))"))
        state=db.get(WorkerState,'ingestion')
        due=not state or utcnow()-state.last_run>=timedelta(hours=6)
        if due:
            if not state:db.add(WorkerState(name='ingestion',last_run=utcnow()))
            else:state.last_run=utcnow()
        heartbeat=db.get(WorkerState,'heartbeat')
        if heartbeat:heartbeat.last_run=utcnow()
        else:db.add(WorkerState(name='heartbeat',last_run=utcnow()))
        db.commit()
    if due:logger.info('Ingestion: %s',ingest_all())

def main():
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['run','ingest','deliver'],default='run',nargs='?');parser.add_argument('--once',action='store_true');args=parser.parse_args()
    if args.command=='ingest':print(json.dumps(ingest_all(),default=str));return
    if args.command=='deliver':deliver_due_reminders();deliver_auth_mail();return
    while True:
        try:tick()
        except Exception:logger.exception('Worker tick failed')
        if args.once:return
        time.sleep(60)

if __name__=='__main__':main()
