#!/bin/sh
set -eu
: "${DATABASE_URL:?Set DATABASE_URL to a PostgreSQL URL}"
: "${BACKUP_FILE:?Choose a backup file path}"
pg_dump --format=custom "$(printf '%s' "$DATABASE_URL" | sed 's/^postgresql+psycopg:/postgresql:/')" --file="$BACKUP_FILE"
