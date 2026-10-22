#!/bin/sh
set -eu
: "${RESTORE_DATABASE_URL:?Set a separate empty recovery database URL}"
: "${BACKUP_FILE:?Choose a backup file path}"
pg_restore --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"
