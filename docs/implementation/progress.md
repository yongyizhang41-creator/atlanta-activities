# Execution ledger — 2026-10-22-atlanta-activities-implementation
Mode: Native. User approved design, plan and continuous implementation. No teaching during implementation.
Ruling: Fresh repository is implemented in the requested project directory on feat/atlanta-activities; no existing code/branch needs isolation. Sandbox requires escalation for Git metadata writes.
Environment: Python 3.13 and Node 22 available; uv, Docker, PostgreSQL/PostGIS absent. Continue code/test work while arranging real PostGIS verification; do not substitute SQLite for spatial verification.
Pre-flight interfaces: 1→2 database dependency; use synchronous SQLAlchemy/psycopg Session consistently instead of mixing async and sync (bounded network calls stay in sync API/threadpool). 3→7/9 event version invalidates reminders transactionally; 4→6 shared search and map result; 5→all identity/CSRF; 7→8/9 user/event locks; 10→6 event-context chat. Shared DTO names remain those of plan.
Ruling: DB session is synchronous Session rather than AsyncSession — simpler worker and transaction sharing; no user-visible behavior change, cost is thread-per-request rather than async DB concurrency.
Task 1: in progress; dependencies and local service prerequisites being established.
Tasks 1/2: engineering dependencies installed, real local PostgreSQL 18.6/PostGIS established using isolated official Postgres.app runtime. Docker deployment still to be exercised on Docker host. Schema migration applied.
Tasks 4/5/7/8: API implemented; shared temporal, spatial, credentials, privacy, conflict confirmation, one-reminder and cancellation behavior exercised against real PostGIS.
Tasks 3/9/10: ingestion adapters, durable worker/delivery and per-event AI implemented. Full backend run: 22 passed. Real provider delivery/OAuth/AI require accounts (user confirmed none exist).
Task 6: frontend screens implemented, typecheck caught MapLibre 6's named-export change; updated import based on installed types. Frontend DST tests: 3 passed. Build and browser verification underway.
Ruling: frontend dependency audit required MapLibre 6.15 and Vitest 5.0.5 rather than initial majors; npm audit now reports zero vulnerabilities. Cost: named-export compatibility adjustments.
Ruling: OpenAI uses documented Responses REST API through httpx rather than adding SDK, preserving same request/response contract and server-side credentials; no added SDK dependency.
Ruling: public basemap defaults to configurable OpenFreeMap, with MapTiler switch supported. Does not require a paid account for local map preview; unknown-coordinate ingestion still needs a licensed geocoder or verified venue cache.
