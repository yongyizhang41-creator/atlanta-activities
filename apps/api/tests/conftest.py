import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# All tests, including concurrency tests, use a distinct database.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://atlanta:atlanta@127.0.0.1:55432/atlanta_test"
)
if not os.environ["DATABASE_URL"].split("?", 1)[0].endswith("_test"):
    raise RuntimeError("TEST_DATABASE_URL must point to a database ending in _test")

# Real provider credentials must never be used by automated tests.
for name in (
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "RESEND_API_KEY",
    "MAIL_FROM",
    "MAPTILER_KEY",
    "MAPTILER_GEOCODING_KEY",
):
    os.environ[name] = ""


@pytest.fixture
def db():
    from app.core.config import settings

    engine = create_engine(os.getenv("TEST_DATABASE_URL", settings.database_url))
    connection = engine.connect()
    tx = connection.begin()
    session = sessionmaker(
        bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
    )()
    yield session
    session.close()
    tx.rollback()
    connection.close()
    engine.dispose()


@pytest.fixture
def client(db):
    from app.core.database import get_session
    from app.main import app

    app.dependency_overrides[get_session] = lambda: db
    with TestClient(app, base_url="http://localhost:3000") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def signed_in(client, db):
    response = client.post(
        "/api/auth/register", json={"email": "person@example.com", "password": "a-long-test-password"}
    )
    assert response.status_code == 200, response.text
    csrf = response.json()["csrf"]
    client.headers["x-csrf-token"] = csrf
    return client
