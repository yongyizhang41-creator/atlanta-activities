# Free demo deployment

Public site: https://atlanta-activities.vercel.app

## Services

- Vercel Hobby deploys `apps/web` from `main`. `API_ORIGIN` points to the Render API.
- Render Free runs `apps/api` using Docker and `sh start.sh`. Startup applies Alembic migrations. `/api/health` checks Neon and PostGIS. Idle services can take about a minute to wake up.
- Neon Free stores application data. Credentials live in platform secret settings, never in this repository.
- Google OAuth uses the existing client in the `atlanta-activities` Google Cloud project. The live JavaScript origin is `https://atlanta-activities.vercel.app`; its redirect URI is `https://atlanta-activities.vercel.app/api/auth/google/callback`. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured on Render. Localhost entries are retained for development.

## Activity refresh

`.github/workflows/ingestion.yml` runs on standard GitHub-hosted Linux runners, free while the repository remains public. It refreshes the current and next week at minute 17 every six hours, and supports manual dispatch from Actions. GitHub schedules can be delayed; they are not exact-time delivery infrastructure. GitHub can disable scheduled workflows in inactive public repositories after 60 days without repository activity.

The encrypted `INGESTION_DATABASE_URL` repository secret connects to the demo database. Only the ingestion command receives it; no pull-request event triggers this workflow. Repository collaborators who can modify workflows can use repository secrets, so restrict write access accordingly. The workflow refuses to run on private repositories or branches other than `main`.

Runs are serialized. Public venue geocoding uses one shared Actions cache, with the application's existing 16-second request spacing. The cache contains public venue lookups, not user records or credentials. Individual source failures and rejected records remain visible in the database and ingestion output. A successful workflow does not mean every source returned publishable activities.

## Deliberately disabled integrations

- AI: the existing OpenAI account had $0 remaining trial credit when checked on October 23, 2026. No AI credential is deployed, no paid calls or top-ups are enabled.
- Email: Resend has no verified sending domain. The local `resend.dev` address only supports tests to the account owner's email, not arbitrary demo users. No paid domain is purchased, no Resend credential is deployed, and no email worker is scheduled. Email verification, password-reset delivery, and email reminders therefore do not send. Google sign-in can create verified accounts without email verification delivery.

This demo does not include a continuously running worker. Scheduled activity refresh does not dispatch email jobs or reminders. If email is enabled later, review existing queued jobs before starting delivery and arrange a suitable delivery schedule.
