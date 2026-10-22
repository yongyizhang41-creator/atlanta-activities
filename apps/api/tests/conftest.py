import os
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

@pytest.fixture
def db():
    from app.core.config import settings
    from app.core.database import Base
    from app import models
    engine=create_engine(os.getenv('TEST_DATABASE_URL',settings.database_url))
    connection=engine.connect()
    tx=connection.begin()
    session=sessionmaker(bind=connection,expire_on_commit=False,join_transaction_mode='create_savepoint')()
    yield session
    session.close()
    tx.rollback()
    connection.close()
    engine.dispose()

@pytest.fixture
def client(db):
    from app.main import app
    from app.core.database import get_session
    app.dependency_overrides[get_session]=lambda: db
    with TestClient(app,base_url='http://localhost:3000') as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def signed_in(client,db):
    response=client.post('/api/auth/register',json={'email':'person@example.com','password':'a-long-test-password'})
    assert response.status_code==200, response.text
    csrf=response.json()['csrf']
    client.headers['x-csrf-token']=csrf
    return client
