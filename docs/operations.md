# Operations Runbook

## Monitoring & Alerting
- API health probes: `/health`, `/ready`, `/api/v1/health`, `/api/v1/ready`.
- Correlation IDs are emitted as `X-Request-ID` and logged as `request_id` for API, worker, ingestion, and AI logs.
- Redis-backed rate limiting protects public-heavy routes with configurable window/limit settings:
  - `API_RATE_LIMIT_ENABLED`
  - `API_RATE_LIMIT_REQUESTS`
  - `API_RATE_LIMIT_WINDOW_SECONDS`
- Notification and scraper alerts should be monitored via the Admin Control Plane and `alert_notifications` records.

## Backup & Restore
1. **Database backup**: run periodic PostgreSQL logical backups (`pg_dump`) and store encrypted offsite snapshots.
2. **Redis backup**: enable RDB snapshots (or AOF where required) for queue state recovery.
3. **Restore drill**:
   - Restore PostgreSQL snapshot into a staging instance.
   - Run `alembic upgrade head`.
   - Validate smoke endpoints (`/health`, `/ready`) and a minimal auth + feed flow.
4. **RPO/RTO target**: define environment-specific goals and validate restore timing in scheduled drills.

## Release Safety Checks
- CI must pass backend lint/tests/migrations and frontend lint/unit/e2e/build before deployment.
- After deployment, verify:
  - health/readiness endpoints
  - a feed request for an authenticated user
  - event ingestion (`POST /api/v1/events/jobs`) and saved jobs endpoints
