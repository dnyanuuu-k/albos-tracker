# ETMS Production Runbook (Docker Compose)

This runbook is meant to make your deployment “hands-off”: the running containers manage Prisma migrations on startup, and scheduled email jobs run independently.

## 1) Prerequisites

You need:
- Docker + Docker Compose
- A PostgreSQL deployment (this runbook uses the `db` container from `docker-compose.yml`)
- A Resend account (for real transactional email)

## 2) Required Environment Variables

Create a production env file (example names):
- `.env.production` (preferred), or update your `.env` directly for Compose.

At minimum:
- `DATABASE_URL` (PostgreSQL connection string; used by the app and Prisma)
- `JWT_SECRET` (strong random string)
- `NEXT_PUBLIC_APP_URL` (public base URL, used in email links)
- `RESEND_API_KEY` (set for real email delivery)
- `EMAIL_FROM` (must be a verified sender in Resend)

For the reverse proxy:
- `APP_DOMAIN` (domain name for Caddy)
- `CADDY_EMAIL` (email for ACME registration)

If you use the provided `docker-compose.yml` defaults for Postgres credentials, ensure they match your `DATABASE_URL`.

## 3) First-Time Migration Setup

Before you can start the production stack, you must have Prisma migrations generated and committed:
- Ensure `prisma/migrations/*` exists
- The `web` and `jobs` containers run `bunx prisma migrate deploy` automatically on startup

If you don’t see `prisma/migrations/*`, generate them (see the `create-prisma-migrations` task in this repo workplan).

## 4) Deploy

From the project root:
1. `docker compose up -d --build`
2. Wait for `db` to become healthy, then confirm `web` is healthy:
   - `GET /api/health`

## 5) Email Configuration (Resend)

Transactional email uses Resend (`src/lib/email.ts`):
- If `RESEND_API_KEY` is missing, emails are logged to the container console instead of sent.
- `EMAIL_FROM` must match a verified sender/domain in your Resend setup.

## 6) Backups Strategy

Backups are handled outside the application code:

Recommended approach:
- Schedule a host cron to run the backup script daily/weekly depending on your RPO/RTO needs.

Scripts included:
- `ops/scripts/backup-db.sh`
- `ops/scripts/restore-db.sh`

Example:
- `sh ops/scripts/backup-db.sh ./backups`

## 7) Restoring

1. Stop the stack (optional but recommended): `docker compose down`
2. Restore using:
   - `sh ops/scripts/restore-db.sh ./backups/<backup-file>.sql`
3. Start again:
   - `docker compose up -d`

## 8) Operational Notes

Logs:
- `docker compose logs -f web`
- `docker compose logs -f jobs`

Health:
- `docker-compose.yml` checks `http://localhost:3000/api/health` for the `web` container.

