import argparse
import json
import logging
import time
from datetime import timedelta
from threading import Thread

from sqlalchemy import text

from app.core.database import SessionLocal
from app.events.time import utcnow
from app.ingestion.service import ingest_all
from app.models import WorkerState
from app.reminders.delivery import deliver_auth_mail, deliver_due_reminders

logging.basicConfig(level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("worker")


def tick():
    deliver_due_reminders()
    deliver_auth_mail()
    with SessionLocal() as db:
        db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended('scheduler',0))"))
        state = db.get(WorkerState, "ingestion")
        due = not state or utcnow() - state.last_run >= timedelta(hours=6)
        if due:
            if not state:
                db.add(WorkerState(name="ingestion", last_run=utcnow()))
            else:
                state.last_run = utcnow()
        heartbeat = db.get(WorkerState, "heartbeat")
        if heartbeat:
            heartbeat.last_run = utcnow()
        else:
            db.add(WorkerState(name="heartbeat", last_run=utcnow()))
        db.commit()
    if due:
        Thread(
            target=lambda: logger.info("Ingestion: %s", ingest_all()), daemon=True, name="activity-ingestion"
        ).start()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["run", "ingest", "deliver"], default="run", nargs="?")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--source", action="append")
    args = parser.parse_args()
    if args.command == "ingest":
        print(json.dumps(ingest_all(args.source), default=str))
        return
    if args.command == "deliver":
        deliver_due_reminders()
        deliver_auth_mail()
        return
    while True:
        try:
            tick()
        except Exception:
            logger.exception("Worker tick failed")
        if args.once:
            return
        time.sleep(60)


if __name__ == "__main__":
    main()
