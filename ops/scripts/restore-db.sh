#!/usr/bin/env sh
set -e

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: sh ops/scripts/restore-db.sh <path-to-backup.sql>"
  exit 1
fi

: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_DB:=etms}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "Restoring Postgres backup from: $BACKUP_FILE"
cat "$BACKUP_FILE" | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Restore complete."

