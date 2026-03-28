#!/usr/bin/env sh
set -e

OUT_DIR="${1:-./backups}"
TS="$(date +%Y%m%d_%H%M%S 2>/dev/null || date +%Y%m%d%H%M%S)"

: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_DB:=etms}"

mkdir -p "$OUT_DIR"

OUT_FILE="$OUT_DIR/etms_pg_${POSTGRES_DB}_${TS}.sql"

echo "Creating Postgres backup: $OUT_FILE"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$OUT_FILE"

echo "Backup complete."

