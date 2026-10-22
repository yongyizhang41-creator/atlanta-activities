from sqlalchemy import select


def test_password_verify_reset_revoke_sessions(client, db):
    from datetime import timedelta

    from app.core.security import digest
    from app.events.time import utcnow
    from app.models import AuthToken, User

    r = client.post(
        "/api/auth/register", json={"email": "User@Example.com", "password": "secure-enough-password"}
    )
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "user@example.com"
    assert r.json()["user"]["verified"] is False
    client.headers["x-csrf-token"] = r.json()["csrf"]
    user = db.scalar(select(User).where(User.email == "user@example.com"))
    db.add(
        AuthToken(
            token_hash=digest("verify-fixture"),
            user_id=user.id,
            kind="verify",
            expires_at=utcnow() + timedelta(minutes=5),
        )
    )
    db.flush()
    assert client.post("/api/auth/verify", json={"token": "verify-fixture"}).status_code == 200
    assert client.post("/api/auth/verify", json={"token": "verify-fixture"}).status_code == 400
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/session").status_code == 401
    assert (
        client.post(
            "/api/auth/login", json={"email": "user@example.com", "password": "wrong-password"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": "user@example.com", "password": "secure-enough-password"}
        ).status_code
        == 200
    )


def test_csrf_and_anonymous_protection(signed_in):
    assert signed_in.delete("/api/me/account", headers={"x-csrf-token": "wrong"}).status_code == 403
    signed_in.cookies.clear()
    assert signed_in.get("/api/events").status_code == 401


def test_google_unconfigured_returns_actionable_error(client):
    response = client.get("/api/auth/google/start", follow_redirects=False)
    assert response.status_code == 503
    assert response.json()["code"] == "google_unavailable"


def test_google_only_user_can_request_password_setup(client, db):
    from sqlalchemy import select

    from app.models import AuthToken, User

    user = User(email="google-only@example.com", verified=True)
    db.add(user)
    db.flush()
    response = client.post("/api/auth/forgot-password", json={"email": user.email})
    assert response.status_code == 200
    assert (
        db.scalar(select(AuthToken).where(AuthToken.user_id == user.id, AuthToken.kind == "reset"))
        is not None
    )
