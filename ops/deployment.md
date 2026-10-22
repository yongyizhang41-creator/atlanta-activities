# Deployment and operations

Run `cp .env.example .env`, configure locally with `python3 ops/configure.py`, then `docker compose up --build -d`. This creates web, API, persistent PostgreSQL/PostGIS, migration and an independent worker. Docker is not installed on the development machine, so container deployment must be verified on a Docker-capable host before publishing.

For production use a unique SECRET_KEY, strong POSTGRES_PASSWORD, ENVIRONMENT=production and HTTPS APP_ORIGIN. Bind the web port behind a TLS reverse proxy; do not expose API/database ports to the internet. Set explicit database credentials and narrowly scope proxy trust for the deployment network. Next.js API_ORIGIN is supplied at build time, not changed after image build. Database storage must be persistent. Configure provider accounts according to docs/service-setup.zh-CN.md.

API readiness: `/api/health` checks PostGIS. Worker heartbeat is stored in worker_state; monitor it and latest successful source_runs. Alert if heartbeat is older than 3 minutes, a source is unverified for 24 hours, reminders fail, or provider quota is reached. All logs must omit questions, passwords, tokens, precise locations and provider credentials.

Back up with `DATABASE_URL=postgresql://… BACKUP_FILE=… sh ops/backup.sh`; encrypt backup storage. Restore to a **separate empty recovery database** with `RESTORE_DATABASE_URL=… BACKUP_FILE=… sh ops/restore.sh`; never point recovery at the live database. Schedule backups with the hosting provider and test restore before launch. Do not place database passwords directly in shell history; load them through environment files or the host secret manager.

First public rollout requires: Google OIDC real callback, a real OpenAI response, verified sending domain and real recipient reminder test, map attribution/key restrictions, source field/location spot checks, privacy/contact ownership and backup recovery verification. Infrastructure, domains and paid accounts are user-owned; this repository does not purchase or publish anything automatically.

## Reminder dispatch semantics

The committed `submitting` transition is the point after which sending cannot reliably be recalled. Moving a plan before this transition suppresses delivery. Moving it afterward cannot recall already-submitted mail. A provider timeout uses the identical persisted payload and key during a 23-hour retry window; outside that window it fails closed instead of risking a second reminder. Sent history remains after removing/readding a card. Only verified emails receive reminders. A stopped worker may send late reminders before start, never after start.
