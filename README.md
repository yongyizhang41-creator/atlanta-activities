# ATL / Out

Atlanta weekly group activities for Downtown, Midtown and Georgia Tech. English UI; Next.js + TypeScript, FastAPI + Python, PostgreSQL + PostGIS.

Includes email/password and Google auth, this/next week and category filtering, live-location radius and polygon map selection, Maybe/Going draggable plans, confirmed schedule conflicts, single email reminders and per-activity AI conversations. Activities are collected automatically; there is no Admin/manual approval flow.

## Local development

Python 3.12+ (tested 3.13), Node 22+, PostgreSQL/PostGIS required. Use Docker if available:

```sh
cp .env.example .env
python3 ops/configure.py
docker compose up --build -d
```

Open http://localhost:3000. Docker deployment has not yet been run on this Mac, which has no Docker installed.

Without Docker:

```sh
python3 -m venv .venv
.venv/bin/pip install -r apps/api/requirements.lock
cd apps/web
npm ci
```

From the repository root, configure DATABASE_URL in `.env`, run `make migrate`, then in separate terminals run `make api`, `make web` and `make worker`. `make ingest` collects once. This Mac has a project-only PostgreSQL/PostGIS runtime in `.local/postgres-runtime` and data in `.local/pgdata`, both Git-ignored. `make start` runs the local API, website and worker from one terminal using this runtime. It is not installed as a system service. Ctrl+C stops only processes started by the launcher.

## External services

Start with [中文逐步配置指南](docs/service-setup.zh-CN.md). Google/OpenAI/email providers require your own accounts and credentials. `python3 ops/configure.py` writes local configuration without exposing secrets. No key should be pasted into chat or committed. Missing providers show explicit UI errors; mocked integration success is not represented as a real service connection.

Maps have a key-free OpenFreeMap default. Events without a verified location are withheld until a licensed geocoder or curated venue lookup resolves them. See [integration status](docs/integrations.md) for actual source coverage and current gaps.

## Verification

`make check` runs backend lint, API tests against real PostGIS, TypeScript, frontend time tests and production build. With API/web running, `make e2e` creates clearly labelled local test fixtures and runs Chrome journeys. `ops/seed_e2e.py` refuses production environments. Do not run tests against a live customer database.

See [design](docs/superpowers/specs/2026-10-22-atlanta-activities-design.md), [implementation plan](docs/superpowers/plans/2026-10-22-atlanta-activities-implementation.md), [progress ledger](docs/implementation/progress.md), and [deployment](ops/deployment.md).

Backend tests default to a separate `atlanta_test` database. Create it and apply migrations first:

```sh
DATABASE_URL=postgresql+psycopg://atlanta:atlanta@127.0.0.1:55432/atlanta_test make migrate
```

Override `TEST_DATABASE_URL` for another test host; its database name must end in `_test`. Existing development activities must never be used as test fixtures.
