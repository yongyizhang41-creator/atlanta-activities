PYTHON ?= .venv/bin/python
.PHONY: check test api web worker ingest migrate e2e
check:
	$(PYTHON) -m ruff check apps/api
	$(PYTHON) -m pytest -c apps/api/pyproject.toml apps/api/tests -q
	cd apps/web && npm run format:check && npm run typecheck && npm test && npm run build
test:
	$(PYTHON) -m pytest -c apps/api/pyproject.toml apps/api/tests -q
api:
	cd apps/api && ../../$(PYTHON) -m uvicorn app.main:app --host 127.0.0.1 --port 8000
web:
	cd apps/web && npm run dev
worker:
	cd apps/api && ../../$(PYTHON) -m app.worker.main run
ingest:
	cd apps/api && ../../$(PYTHON) -m app.worker.main ingest --once
migrate:
	cd apps/api && ../../.venv/bin/alembic upgrade head
e2e:
	cd apps/api && PYTHONPATH=. ../../$(PYTHON) ../../ops/seed_e2e.py
	cd apps/web && npm run e2e
start:
	$(PYTHON) ops/start_local.py
configure:
	$(PYTHON) ops/configure.py
