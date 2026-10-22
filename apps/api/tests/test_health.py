from fastapi.testclient import TestClient


def test_health_checks_database(monkeypatch):
    from app.main import app, engine

    def unavailable():
        raise ConnectionError("offline")

    monkeypatch.setattr(engine, "connect", unavailable)
    response = TestClient(app).get("/api/health")
    assert response.status_code == 503
    assert response.json()["status"] == "unavailable"
