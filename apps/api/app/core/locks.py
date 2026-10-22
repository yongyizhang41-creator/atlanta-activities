"""Session advisory locks live on a dedicated connection, not a pooled ORM transaction."""

from contextlib import contextmanager

from sqlalchemy import text

from app.core.database import engine


@contextmanager
def exclusive_job(key: str):
    with engine.connect() as connection:
        acquired = connection.scalar(
            text("SELECT pg_try_advisory_lock(hashtextextended(:key,0))"), {"key": key}
        )
        connection.commit()
        try:
            yield bool(acquired)
        finally:
            if acquired:
                connection.execute(text("SELECT pg_advisory_unlock(hashtextextended(:key,0))"), {"key": key})
                connection.commit()
