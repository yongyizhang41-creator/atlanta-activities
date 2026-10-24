import asyncio
import json
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import Mock

from app.chat import router as module


def test_answer_is_yielded_before_saved(monkeypatch):
    monkeypatch.setattr(module.settings, "openai_api_key", "test")
    monkeypatch.setattr(module.settings, "openai_model", "test")
    monkeypatch.setattr(module, "rate_limit", lambda *a: None)
    monkeypatch.setattr(module, "dto", lambda e: {"latitude": 0, "longitude": 0})
    chat = SimpleNamespace(id="session", messages=[])
    db = Mock()
    db.scalar.return_value = chat

    class Client:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        @contextmanager
        def stream(self, *args, **kwargs):
            assert kwargs["json"]["stream"] is True
            yield SimpleNamespace(raise_for_status=lambda: None, iter_lines=lambda: iter([
                'data: {"type":"response.output_text.delta","delta":"你好"}',
                'data: {"type":"response.output_text.delta","delta":"！"}',
                'data: {"type":"response.completed"}',
            ]))

    monkeypatch.setattr(module.httpx, "Client", Client)
    response = module.ask("event", module.ChatInput(message="你好", session_id="session", stream=True), SimpleNamespace(id="user"), db)

    async def consume():
        iterator = response.body_iterator
        first = await anext(iterator)
        assert json.loads(first[6:])["text"] == "你好"
        db.commit.assert_not_called()
        rest = [chunk async for chunk in iterator]
        assert json.loads(rest[-1][6:]) == {"type": "done", "session_id": "session"}
    asyncio.run(consume())
    assert chat.messages[-1]["content"] == "你好！"
    db.commit.assert_called_once()
