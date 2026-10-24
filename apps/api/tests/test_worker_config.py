from app.core.locks import exclusive_job


def test_worker_does_not_tick_when_another_instance_owns_lock():
    from app.worker.main import run_worker_loop

    calls = []
    with exclusive_job("worker:main") as acquired:
        assert acquired
        assert run_worker_loop(once=True, tick_fn=lambda: calls.append("ran")) is False
    assert calls == []


def test_worker_ticks_when_lock_is_available():
    from app.worker.main import run_worker_loop

    calls = []
    assert run_worker_loop(once=True, tick_fn=lambda: calls.append("ran")) is True
    assert calls == ["ran"]
