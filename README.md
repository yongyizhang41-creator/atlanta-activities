# ATL / Out

Discover Atlanta activities in Downtown, Midtown, and Georgia Tech, then organize your week with an interactive map and personal plans.

[Live Demo](https://atlanta-activities.vercel.app)

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript, CSS, Motion |
| Maps | MapLibre GL JS, OpenFreeMap, PostGIS spatial queries |
| Backend | Python, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL with PostGIS |
| Authentication | Email/password, Google OpenID Connect, cookie sessions, CSRF protection |
| Optional integrations | OpenAI Responses API, Resend email, Nominatim venue geocoding |
| Testing | pytest, Ruff, Vitest, TypeScript, Playwright |
| Demo hosting | Vercel Hobby, Render Free, Neon Free, GitHub Actions |

## Architecture

```text
Browser
  └── Next.js frontend (apps/web)
        └── /api/* proxy → FastAPI backend (apps/api)
                              └── PostgreSQL + PostGIS

Worker / scheduled ingestion
  ├── Collect public event information
  ├── Resolve venue coordinates and update activities
  └── Store results and source status in PostgreSQL

Optional email worker
  └── Process verification, password reset, and reminder jobs
```

The frontend proxies API requests using `API_ORIGIN`, which must be set before building. The backend handles authentication, event searches, plans, reminders, and activity conversations. PostGIS supports radius and polygon searches.

Local Docker Compose runs the frontend, API, database, migrations, and a separate worker. The public demo uses Vercel for the frontend, Render for the API, and Neon for the database. GitHub Actions schedules activity refreshes every six hours; scheduled runs may be delayed or fail independently of the website.

## Features

- Email/password registration and Google sign-in.
- This-week and next-week activity browsing with category filters and Eastern Time dates.
- Interactive activity map with location-based radius searches and polygon selection.
- Maybe and Going boards with drag-and-drop ordering and schedule conflict confirmation.
- Automatic cleanup of ended or cancelled plans.
- Public event ingestion with source links, verification timestamps, and geographic coverage checks.
- Multiple email reminders per activity, email verification, and password reset when an email provider and delivery worker are configured.
- Per-activity AI conversations when a model provider is configured.
- Account and conversation deletion, with no stored location history.

**Current demo:** Google sign-in, activity browsing, maps, and plans are available. Scheduled ingestion is configured, but its first full run was cancelled before completion. AI and email delivery are disabled: the OpenAI account has no remaining trial credit, and no sending domain is configured. Render Free may take about a minute to wake after inactivity. See [demo deployment details](docs/demo-deployment.md).

## Setup Instructions

### Prerequisites

- Python 3.12+ (tested with 3.13)
- Node.js 22+
- PostgreSQL with PostGIS, or Docker with Docker Compose

### Configure environment variables

From the repository root:

```sh
cp .env.example .env
python3 ops/configure.py
```

Set `DATABASE_URL` for your PostgreSQL instance. Google sign-in, AI, and email require their respective provider credentials; they are optional for local development. Keep credentials in `.env` or your hosting provider's secret settings, never in Git.

See the [step-by-step service configuration guide](docs/service-setup.zh-CN.md) and [integration status](docs/integrations.md).

### Run with Docker

```sh
docker compose up --build -d
```

Open [http://localhost:3000](http://localhost:3000). Compose applies migrations and starts the API, frontend, and worker. The container deployment has not been verified end to end on the development Mac.

### Run without Docker

Install dependencies from the repository root:

```sh
python3 -m venv .venv
.venv/bin/pip install -r apps/api/requirements.lock
npm ci --prefix apps/web
make migrate
```

Run each service in a separate terminal:

```sh
make api
```

```sh
make web
```

```sh
make worker
```

Run `make ingest` for a one-time activity refresh. Open [http://localhost:3000](http://localhost:3000).

On the original development Mac, `make start` uses the Git-ignored PostgreSQL runtime in `.local/postgres-runtime` to start the local stack. This runtime is not included when cloning the repository; other machines need their own PostgreSQL/PostGIS installation or Docker.

### Verify the application

Create a separate test database named `atlanta_test`, then apply migrations:

```sh
DATABASE_URL=postgresql+psycopg://atlanta:atlanta@127.0.0.1:55432/atlanta_test make migrate
make check
```

`make check` runs backend lint and tests, frontend formatting, type checking, unit tests, and a production build. With the API and frontend running, use `make e2e` for browser journeys. Backend tests default to `atlanta_test`; an overridden `TEST_DATABASE_URL` must use a database name ending in `_test`. Never run tests against a production database.

For production configuration, backups, and operational requirements, see [deployment instructions](ops/deployment.md).
