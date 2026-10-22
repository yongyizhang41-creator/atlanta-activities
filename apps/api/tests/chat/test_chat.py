def test_ai_unconfigured_does_not_fabricate(signed_in, db):
    from datetime import timedelta

    from app.events.time import utcnow
    from app.models import Event

    e = Event(
        title="Test",
        venue="Arena",
        starts_at=utcnow() + timedelta(hours=1),
        latitude=33.76,
        longitude=-84.4,
        location="SRID=4326;POINT(-84.4 33.76)",
        source_urls=["https://example.org"],
    )
    db.add(e)
    db.flush()
    r = signed_in.post(f"/api/events/{e.id}/chat", json={"message": "How much is a ticket?"})
    assert r.status_code == 503
    assert r.json()["code"] == "ai_unavailable"


def test_chat_is_private_and_deletable(signed_in, db):
    from app.events.time import utcnow
    from app.models import Chat, Event, User

    u = User(email="other@example.com")
    db.add(u)
    db.flush()
    e = Event(
        title="Test",
        venue="Arena",
        starts_at=utcnow(),
        latitude=33.76,
        longitude=-84.4,
        location="SRID=4326;POINT(-84.4 33.76)",
        source_urls=[],
    )
    db.add(e)
    db.flush()
    chat = Chat(user_id=u.id, event_id=e.id, messages=[])
    db.add(chat)
    db.flush()
    assert signed_in.get(f"/api/me/chats/{chat.id}").status_code == 404
    assert signed_in.delete(f"/api/me/chats/{chat.id}").status_code == 404
