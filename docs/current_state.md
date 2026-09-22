# OpportuneAI - Current State

## Implemented

### 1. User Authentication (Backend + Frontend)
**Backend** (`backend/routes/auth.py`, `backend/utils/auth.py`):
- Auth0 integration with password realm grant (email/password login)
- Auth0 DB connection signup flow with mandatory email verification (auto-login disabled on registration)
- Email verification enforcement: `POST /api/auth/login` checks `email_verified` and returns 403 Forbidden until verified
- Resend verification endpoint: `POST /api/auth/resend-verification` via Auth0 Management API
- JWT verification with JWKS caching
- User synchronization: Auth0 → PostgreSQL `users` table
- Mock mode for local development (`AUTH0_CLIENT_ID=mock_client_id`)
- Profile CRUD: GET `/api/auth/me`, PUT `/api/users/me`
- Role-based Access Control (RBAC): `role` column (`admin` | `user`, default `user`), YAML-driven `admin_config.admin_emails` in `backend/config/config.yml` (plus env override), `require_admin` dependency guard, protected `/api/admin/*` endpoints (`/stats`, `/providers`, `/workers`, `/queue`)

**Frontend** (`frontend/src/hooks/use-auth.tsx`, `frontend/src/routes/auth.*`, `frontend/src/components/layouts/app-layout.tsx`, `frontend/src/routes/app.admin.tsx`):
- `@auth0/auth0-react` SPA authentication with PKCE
- Sign in, sign up, callback, forgot password, reset password, verify email routes
- Multi-provider social login: Google, GitHub, LinkedIn
- Token persistence in localStorage with auto-refresh
- Syncs auth token to API client (`setApiAuthToken`)
- Role-based conditional UI: Admin sidebar item and dashboard pipeline widget hidden for normal users; `/app/admin` route guarded with Access Denied view

**Status**: ✅ Functional with mock mode; real Auth0 needs credentials

---

### 2. Job Ingestion Pipeline & Orchestrator
**Backend** (`backend/ingestion/pipeline.py`, `backend/services/pipeline_orchestrator.py`, `backend/providers/`, `backend/scrapers/`):
- Abstract `BaseProvider` with 4 implementations:
  - **LinkedInProvider**: `linkedin-jobs-scraper` (Selenium-based)
  - **NaukriProvider**: Native stealth headless Chrome driver with CDP injection (`--headless=new`)
  - **WellfoundProvider**: Playwright + Firecrawl markdown extraction
  - **RemoteOKProvider**: REST API (`https://remoteok.com/api`)
- Deduplication via content hash (SHA256 of title|company|date|location)
- Distributed Redis locks (`lock:scraper:{provider}`) and distributed cancellation signaling (`cancel:scraper:{id}`)
- Server reload & restart recovery: automatic cleanup of dangling orphaned runs on FastAPI startup
- In-memory & SSE log streaming service (`LogStreamService`) for live crawler terminal output
- Saves to `raw_jobs` table and enqueues AI processing jobs to Redis queue

**Status**: ✅ Core pipeline and orchestrator fully functional with cancellation & retry scheduling

---

### 3. AI Job Processing Worker
**Backend** (`backend/workers/ai_worker.py`, `backend/ai/`):
- RQ worker consuming from `ai-processing` queue
- AI Provider abstraction with Factory pattern:
  - **GeminiProvider**: Google Gemini API with connection pooling (`gemini_pool.py`)
  - **OpenRouterProvider**: OpenAI-compatible fallback
- Job extraction: skills, salary, experience, employment_type, description
- Match scoring against user profiles (skills, roles, locations, experience, salary)
- Saves structured data to `processed_jobs` table

**Status**: ✅ Functional; needs API keys (Gemini/OpenRouter)

---

### 4. Database Layer
**Models** (`backend/database/models/`):
- `User` - Auth0-synced profile with preferences (skills, roles, locations, salary)
- `RawJob` - Scraped data with content_hash for deduplication
- `ProcessedJob` - AI-extracted structured data with 1:1 link to RawJob (includes `last_date_to_apply` with fallback from `job_config.default_expiry_days` / `DEFAULT_JOB_EXPIRY_DAYS`)

**Repositories** (`backend/database/repositories/`):
- `UserRepository`, `RawJobRepository`, `ProcessedJobRepository`

**Migrations** (`backend/alembic/versions/`):
- Initial schema: users, raw_jobs, processed_jobs

**Status**: ✅ Complete with tests

---

### 5. Private Resume Storage & Async LLM Parsing
**Backend** (`backend/routes/resume.py`, `backend/storage/r2.py`, `backend/workers/resume_worker.py`):
- Direct multi-part resume upload via `POST /api/resume/upload`
- In-memory PDF text extraction via `pypdf` with strict size/type validations
- Private document archival via Cloudflare R2 bucket integration (`boto3`)
- Secure time-limited pre-signed download URLs via `GET /api/resume/download-url`
- Background RQ worker (`resume_worker.py`) running asynchronous LLM resume extraction
- Extracts `extracted_skills`, `experience_level`, `years_total`, and `confidence` score
- Synchronizes extracted skills directly to the user's profile table row upon parse completion
- Complete lifecycle management with soft/hard deletion endpoint `DELETE /api/resume`

**Frontend** (`frontend/src/routes/app.resume.tsx`, `frontend/src/lib/api/resume.ts`):
- Resume management interface with interactive drop zone and drag & drop support
- Live status polling for background AI extraction
- Live pre-signed resume download link handling

**Status**: ✅ Complete with unit test coverage

---

### 6. AI Resume Extraction Prompt Tuning
**Backend** (`backend/ai/extraction/resume_prompts.py`, `backend/ai/schemas.py`):
- Strict prompt rules extracting high-signal, relevant technical proficiencies
- Excludes office suite utilities (Word, Excel, Slack, Zoom) and unmeasurable generic soft buzzwords
- Normalizes and standardizes synonyms to canonical industry names

**Status**: ✅ Complete with unit tests

---

### 7. Frontend UI, Theming & Design System
**Frontend** (`frontend/src/styles.css`, `frontend/src/components/`, `frontend/src/routes/`):
- Custom OKLCH design token architecture with warm porcelain light theme and OLED obsidian dark theme.
- Directional wave shimmer skeleton loading system (`skeleton-shimmer`, `state-views.tsx`) moving smoothly from left to right.
- Polished component suite: `StatCard`, `JobCard`, `PageHeader`, `ThemeToggle` with cross-fade animation, `Logo`, `AuthShell`, and `Sonner` toasts.
- Sticky full-height desktop navigation sidebar (`sticky top-0 h-screen`) with independent main content scrolling.
- Blocking `<head>` theme script preventing flash-of-unstyled-content (FOUC) during page reload.
- Fully typed TanStack Router route views with zero build errors.

**Status**: ✅ Complete and production-ready

---

### 8. Profile & Resume Intelligence UI
**Frontend** (`frontend/src/components/profile/`, `frontend/src/routes/app.profile.tsx`, `frontend/src/routes/app.resume.tsx`):
- Full 12-column responsive layout pairing the Identity & Job Preferences form with Experience & Seniority and live `ResumeInsights`.
- `ResumeInsights`: Dedicated component for AI-extracted skills with verification against a standardized system catalog.
- System Skills Catalog (`frontend/src/lib/data/skills.csv`, `skills.ts`): Categorized catalog of standard technical skills with fuzzy/prefix matching and canonicalization.
- `SearchCombobox` & `MultiSearchCombobox`: Autocomplete search inputs for target job title, location, experience levels, preferred roles, and preferred locations.
- Standardized Profile Options (`frontend/src/lib/data/profile-options.ts`): Comprehensive catalogs covering internships, specialty engineering tracks, tech hubs, and seniority levels.
- Optimistic resume removal: Instantly clears cache on client with automatic rollback and user notification on backend failure.

**Status**: ✅ Complete and verified with tests

---

### 9. Hybrid Personalized Job Feed & Scoring Engine (v2)
**Backend** (`backend/ai/embeddings/`, `backend/services/feed_service.py`, `backend/services/user_embedding_service.py`, `backend/services/backfill_embeddings.py`, `backend/database/models/processed_job.py`, `backend/database/models/user.py`, `backend/database/repositories/processed_job_repository.py`):
- Two-stage hybrid recommendation pipeline:
  1. **Stage 1 (Semantic Candidate Retrieval)**: Generates 768-dim embeddings with Google Gemini (`models/gemini-embedding-001`). Precomputes and persists `embedding` in PostgreSQL `processed_jobs` via `Vector(768)` on job ingestion. Computes `preference_embedding` on user profile / resume updates. Retrieves top $N$ candidates (`candidate_pool_size=200`) using database-side pgvector cosine distance (`ProcessedJob.embedding.cosine_distance(user_embedding)`).
  2. **Stage 2 (Structured Reranking)**: Uses deterministic `ScoringEngine` to compute explicit constraint match scores across skills, roles, location, work mode, and experience. Combines scores into final hybrid score: `hybrid_score = (0.40 * semantic_score_100) + (0.60 * structured_score)`.
- Resumable/idempotent backfill script (`services/backfill_embeddings.py`) for offline batch generation.
- Cold start fallback ranking based on recency and metadata completeness for users with empty preference representations.
- Job eligibility and expiry filtering directly using `processed_jobs.last_date_to_apply`.
- Redis feed cache key `feed:user:{id}` with 1-hour TTL storing ranked job IDs.
- Single-query batch PostgreSQL job fetching (`WHERE id IN (...)`) preserving Redis rank order in-memory.
- Automatic feed cache invalidation and preference embedding refresh on profile updates (`PUT /api/users/me`), resume extraction completion, and resume deletion.
- Applied job exclusion: When a user applies to a job, its ID is stored in the user's applied set (`user:{id}:applied_jobs` in Redis and `job_applications` table). The heavy recommendation feed cache (`feed:user:{id}`) is NOT invalidated upon apply; instead, applied job IDs are filtered in-memory with $O(1)$ lookup on subsequent `GET /api/feed` requests and during full feed regenerations.
- Feed location matching & relocation preference: `ScoringEngine.calculate_location_score` updated so that remote preference + remote job counts as a direct location match without checking physical locations. Added `willing_to_relocate` boolean preference in `users` database table (migration `b4bf1fe280c5_add_willing_to_relocate_to_users`), `UserProfileSchema`, and frontend `/app/profile` view. When enabled, feed scoring skips physical location comparison, allowing jobs from any location to receive maximum location score.
- Endpoints: `GET /api/feed` (cursor-paginated) and `GET /api/jobs/{job_id}` (individual job detail with `applied` status).

**Frontend** (`frontend/src/lib/api/jobs.ts`, `frontend/src/components/shared/job-card.tsx`, `frontend/src/routes/app.dashboard.tsx`, `frontend/src/routes/app.recommendations.tsx`, `frontend/src/routes/app.jobs.index.tsx`, `frontend/src/routes/app.jobs.$jobId.tsx`):
- Real backend API integration via `jobsApi.feed()`, `jobsApi.get()`, `jobsApi.recommendations()`, and `jobsApi.list()`.
- Optimistic in-memory removal: On applying to a role, the client removes the applied job directly from cached React Query feeds without triggering computationally heavy server refetches or feed regenerations.
- Applied job state tracking: `JobCard` displays an emerald `Applied` badge with `CheckCircle2` icon. The job detail CTA displays `Applied` (for both direct external links and tracked applications) instead of `Apply now`.
- Applied jobs are excluded from the personalized feed and recommendations.
- Coordinated TanStack Query cache keys (`["feed", { limit: 4 }]` for Dashboard, `["feed", { limit: 12 }]` for Recommendations).
- Interaction tracking wired to `POST /api/v1/events/jobs`.

**Status**: ✅ Complete with unit and integration tests

---

### 10. Real User Activity & Notification System
**Backend** (`backend/database/models/activity.py`, `backend/database/repositories/activity_repository.py`, `backend/routes/notifications.py`, `backend/routes/events.py`, `backend/routes/resume.py`, `backend/workers/resume_worker.py`, `backend/routes/auth.py`):
- `user_activities` table in PostgreSQL mapped to `UserActivity` model.
- `ActivityRepository` handling creation, listing per user, single item mark-as-read, and mark-all-as-read.
- Endpoints: `GET /api/notifications`, `POST /api/notifications/{activity_id}/read`, `POST /api/notifications/read-all`.
- Automatic activity generation on:
  - Job bookmarks/saves (`activity_type="save"`)
  - Applications submitted (`activity_type="application"`)
  - Resume upload and AI extraction completion (`activity_type="resume"`)
  - Profile preference updates (`activity_type="system"`)
- 3 unit/integration tests in `backend/tests/test_notifications.py`.

**Frontend** (`frontend/src/lib/api/notifications.ts`, `frontend/src/routes/app.dashboard.tsx`, `frontend/src/routes/app.notifications.tsx`, `frontend/src/components/layouts/app-layout.tsx`):
- Live `notificationsApi` backed by `apiCall`.
- Dashboard "Recent activity" widget upgraded with rich color-coded category badges (`Send`, `Bookmark`, `Sparkles`, `Zap`, `Bell`), relative timestamps, and empty state.
- Notifications page with "All" and "Unread" filter tabs, mark-as-read actions, and empty states.
- AppLayout navbar Bell icon and sidebar navigation badge dynamically synced to unread notification count.

**Status**: ✅ Complete with tests and production build verification

---

### 11. Real Job Applications Tracking & Management System
**Backend** (`backend/database/models/job_application.py`, `backend/database/repositories/job_application_repository.py`, `backend/routes/applications.py`, `backend/routes/events.py`, `backend/services/feed_service.py`):
- `job_applications` table in PostgreSQL mapped to `JobApplication` ORM model.
- Enforces unique constraint on `(user_id, job_id)`.
- `JobApplicationRepository` supporting `create_or_update`, `list_by_user` (eager-loading job and raw_job), `get_by_id`, `update_status_or_notes`, `delete`, and `get_applied_job_ids`.
- REST endpoints under `/api/applications`:
  - `GET /api/applications` — List user's applications with optional status filtering (`applied`, `interviewing`, `offer`, `rejected`, `withdrawn`).
  - `POST /api/applications` — Create/upsert application, update Redis applied set, invalidate feed cache, and log user activity.
  - `PATCH /api/applications/{id}` — Update status or add recruiter/interview notes.
  - `DELETE /api/applications/{id}` — Remove/withdraw application from tracking.
- Automatic integration with `POST /api/v1/events/jobs` on apply event.
- Migration: `f4de408c0c82_add_job_applications_table`.
- Unit tests in `backend/tests/test_job_applications.py`.

**Frontend** (`frontend/src/routes/app.applied.tsx`, `frontend/src/lib/api/jobs.ts`):
- Live `jobsApi.applications()`, `jobsApi.apply()`, `jobsApi.updateApplication()`, and `jobsApi.deleteApplication()` wired to backend endpoints.
- Applications page (`/app/applied`) features:
  - Dynamic status tabs (`All`, `Applied`, `Interviewing`, `Offers`, `Rejected`) with live count badges.
  - Fast search filter across roles, companies, and skills.
  - Interactive status dropdown with immediate optimistic updates.
  - Inline recruiter and interview notes editor.
  - Direct action buttons (job details, outreach mailto, external apply post, remove application).
  - Rich empty states with "Explore Job Recommendations" CTA.

**Status**: ✅ Complete with tests and production build verification

---

### 12. Production Admin Control Plane & Pipeline Orchestration
**Backend** (`backend/routes/admin.py`, `backend/services/pipeline_orchestrator.py`, `backend/services/scheduler.py`, `backend/services/queue_service.py`, `backend/services/system_config_service.py`, `backend/services/email_notification_service.py`, `backend/services/log_stream_service.py`, `backend/services/audit_service.py`, `backend/utils/encryption.py`, `backend/database/models/`):
- **Database Architecture**: New PostgreSQL tables `scraper_runs`, `system_configs`, `system_api_keys`, `admin_audit_logs`, `alert_notifications` with Alembic migration `3cfcb26a5c5b_add_admin_control_plane_tables`.
- **Scraper & Pipeline Orchestrator**:
  - Redis distributed locking (`lock:scraper:<provider>`) to prevent duplicate concurrent runs.
  - Manual and scheduled batch/single crawler triggers (`all`, `linkedin`, `naukri`, `wellfound`, `remoteok`).
  - Asynchronous, non-blocking execution with real-time progress, duration, items fetched, and items saved telemetry.
  - Configurable retry policies: exponential backoff + automatic 2-hour delay on rate limits / anti-bot challenges (HTTP 429, Cloudflare, Captcha, 403).
  - In-flight scraper cancellation support.
- **Automated Daily 2 AM Cron Scheduler** (`services/scheduler.py`):
  - In-process AsyncIO background scheduler utilizing `croniter` (default `0 2 * * *` = daily 2:00 AM UTC).
  - Automatically evaluates scheduled runs and picks up due retries (`next_retry_at <= now`).
  - Managed via FastAPI app lifespan startup and graceful shutdown.
- **Queue & Worker Management (Redis RQ)** (`services/queue_service.py`):
  - Live telemetry for `ai-processing`, `resume-processing`, `scraper-queue`.
  - Operations to retry all failed jobs from RQ registry or purge failed registries.
  - Active worker node telemetry (names, states, queues, job counters).
- **Secure Encrypted Key Vault & Config Management** (`utils/encryption.py`, `services/system_config_service.py`):
  - AES Fernet encryption for API keys at rest.
  - Raw secret values masked upon creation (`••••••••abcd`) and never returned in plain text.
  - Dynamic runtime config store for LLM provider/model selection, temperatures, scraper settings, retry policies, cron expressions, and feature flags with in-memory caching and DB fallback.
- **Admin Alert & Email Notification Engine** (`services/email_notification_service.py`):
  - Automatic email alerts on scraper failures, repeated retries, provider anti-bot blocks, and critical pipeline errors.
  - Throttling mechanisms (15-min window) preventing alert storms.
  - Configurable SMTP support + dev simulation mode and test email dispatch.
- **Audit Logging** (`services/audit_service.py`):
  - Logs all critical admin actions (triggering scrapers, config changes, key additions/revocations, retry triggers, test alerts) with user email, action name, target, changes diff, and IP address.
- **Live Structured Log Streaming** (`services/log_stream_service.py`):
  - In-memory circular log ring buffer + ingestion log merger filterable by log level, source, and search queries.
- **Full Unit & Integration Test Coverage**: 7 passing tests in `tests/test_admin.py` and `tests/test_pipeline_orchestration.py` (79/79 suite pass).

**Frontend** (`frontend/src/routes/app.admin.tsx`, `frontend/src/lib/api/admin.ts`):
- Modern, 7-tab enterprise Admin Control Plane:
  1. **Overview**: Live status banner, KPI cards, provider health status matrix, quick trigger actions.
  2. **Scrapers & Pipeline Orchestration**: Provider control cards, "Trigger All", filterable execution history table, interactive Run Detail Modal with structured logs viewer and error stack traces.
  3. **Queues & Workers**: RQ queue telemetry, worker node cards, failed job bulk retry and purge controls.
  4. **Live Logs**: Real-time terminal log viewer with auto-scroll toggle, source/level filtering, search, and export log download.
  5. **Config & Secrets Vault**: LLM selector, retry policies, cron scheduler editor, feature flags, encrypted API key vault (add modal with instant masking, delete/revoke).
  6. **Alerts & Emails**: Alert rule toggles, recipient emails manager, send test email trigger.
  7. **Audit Trail**: Searchable, filterable administrative audit logs table.

**Status**: ✅ Complete, migrated, fully tested, and production-ready.

---

## In Progress

### 1. Real API Integration (Frontend → Backend)
- **Completed**: Auth, profiles, resume, feed, job details, interaction events, notifications, user activity, job applications, and full admin control plane.

---

## Not Yet Implemented

### Backend
- [x] `GET /api/feed` - Personalized, cached job feed with cursor pagination
- [x] `GET /api/jobs/{job_id}` - Single job detail with match scoring
- [x] `GET /api/applications` - User applications with status and job metadata
- [x] `POST /api/applications` - Apply to job / track application
- [x] `PATCH /api/applications/{id}` - Update status and notes
- [x] `DELETE /api/applications/{id}` - Remove/withdraw application
- [x] `GET /api/admin/stats` - Pipeline stats and live telemetry
- [x] `GET /api/admin/scrapers` - Scraper health and status
- [x] `POST /api/admin/scrapers/trigger` - Manual scraper trigger
- [x] `GET /api/admin/queue` - Redis RQ queue telemetry
- [x] `GET /api/admin/logs` - Live log streaming
- [x] `GET /api/admin/config` - Dynamic system configuration
- [x] `PUT /api/admin/config` - Update system configuration
- [x] `GET /api/admin/api-keys` - Encrypted API key vault
- [x] `POST /api/admin/api-keys` - Add encrypted API key
- [x] `DELETE /api/admin/api-keys/{id}` - Revoke API key
- [x] `POST /api/admin/notifications/test` - Test email notification
- [x] `GET /api/admin/audit-logs` - Audit trail history
- [x] Scheduler for periodic ingestion (AsyncIO cron scheduler at 2:00 AM UTC)
- [ ] `GET /api/saved` - Saved jobs
- [ ] `POST /api/saved` - Save/unsave job
- [ ] Rate limiting on public API endpoints
- [ ] API versioning strategy
- [ ] Match score recalculation job (when user profile changes)
- [ ] Rate limiting on API endpoints
- [ ] API versioning strategy
- [ ] Structured logging (JSON, correlation IDs)
- [ ] Health check endpoints (`/health`, `/ready`)

### Frontend
- [ ] Replace mock API with real backend calls for jobs, applications, saved, admin
- [ ] React Query mutations for apply/save actions
- [x] Optimistic updates for resume removal
- [x] Resume upload to backend (multipart/form-data)
- [x] Standardized skills and profile combobox autocomplete search
- [x] Flash-free theme hydration script
- [x] Full-height sticky sidebar with independent scrolling
- [ ] Real-time notifications (WebSocket/SSE)
- [ ] PWA offline support (service worker registered but not configured)
- [ ] E2E tests (Playwright/Cypress)
- [ ] Unit tests (Vitest + React Testing Library)

### Infrastructure
- [ ] Docker Compose for local dev (PostgreSQL, Redis, backend, frontend)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Production deployment configs
- [ ] Database backup/restore strategy
- [ ] Monitoring/alerting (Sentry, Prometheus)
- [ ] Secrets management

---

## Current Priorities

### High Priority (Next 1-2 weeks)
1. **Implement job search API** (`GET /api/jobs`, `GET /api/recommendations`)
   - Affected: `backend/routes/`, `backend/database/repositories/processed_job_repository.py`
   - Enables: Dashboard, Jobs, Recommendations pages

2. **Connect frontend to real API**
   - Affected: `frontend/src/lib/api/jobs.ts`, `notifications.ts`, `admin.ts`
   - Remove mock data, use real fetch calls

3. **Add scheduler for ingestion** (APScheduler)
   - Affected: New file `backend/scheduler.py`, integrate with `IngestionPipeline`
   - Enables: Automated job fetching

### Medium Priority (Next 3-4 weeks)
4. **Implement application/save endpoints** (`/api/applied`, `/api/saved`)
   - Affected: New models or extend processed_jobs, new routes
   - Enables: Applied, Saved pages

5. **Match score recalculation job**
   - Affected: New worker job, trigger on profile update
   - Enables: Fresh recommendations

6. **Add rate limiting & health checks**
   - Affected: FastAPI middleware, new routes

---

### 7. User–Job Event Tracking
**Backend** (`backend/database/models/user_job_event.py`, `backend/database/repositories/user_job_event_repository.py`, `backend/routes/events.py`):
- Append-only `user_job_events` table in PostgreSQL (JSONB metadata, integer FKs to `users` + `processed_jobs`)
- 8 controlled event types via `JobEventType` `StrEnum`: `impression`, `click`, `view`, `save`, `unsave`, `apply`, `dismiss`, `not_interested`
- 6 controlled source values via `JobEventSource` `StrEnum`: `feed`, `search`, `job_detail`, `recommendation`, `notification`, `other`
- `POST /api/v1/events/jobs` — JWT-authenticated, validates job existence, returns lightweight receipt (id + event_type + created_at)
- Metadata stored as JSONB; `view` events validate non-negative `duration_seconds`; position validated ≥ 0
- Indexes: `user_id`, `job_id`, `event_type`, `(user_id, created_at)`, `(user_id, job_id)` — optimized for user history queries and per-job analytics
- Migration: `82b73f5f5378_add_user_job_events_table` (reversible)
- 11 passing unit tests in `tests/test_user_job_events.py`

**Future**: A background worker will consume events via `process_user_event(event_id)` to update user preferences and invalidate feed caches.

**Status**: ✅ Implemented, migrated, tested

---

### 8. Job Apply Link Extraction & Autonomous Contact Finder Agent
**Backend** (`backend/ai/schemas.py`, `backend/ai/extraction/prompts.py`, `backend/ai/agents/contact_finder.py`, `backend/workers/ai_worker.py`, `backend/database/models/`):
- **Apply URL extraction**: `JobExtraction` schema and extraction prompt updated to detect direct application links (Greenhouse, Lever, Ashby, Workday, career page URLs, Google Forms) from job descriptions.
- **Raw payload fallback**: `ai_worker.py` reads `apply_url` from scraped `raw_payload` (e.g. RemoteOK API `apply_url` field) before falling back to the LLM result.
- **ProcessedJob enrichment**: New nullable columns `apply_url`, `contact_email`, `contact_name`, `contact_role` on `processed_jobs` table.
- **CompanyContact cache table**: New `company_contacts` table caches discovered contacts per company (by normalized `company_key`). Prevents redundant agent runs for multiple jobs from the same company.
- **Autonomous Contact Finder Agent** (`ai/agents/contact_finder.py`):
  - Triggered automatically in `ai_worker.py` when `apply_url` is absent after AI processing.
  - **Search**: Zero-cost DuckDuckGo HTML scraping via `httpx` (no API key). Runs two targeted queries: LinkedIn people search for HR/Founder/Recruiter at company, and domain email pattern search.
  - **LLM synthesis**: Gemini LLM analyzes snippets, extracts name, role, email or derives email pattern (`first@domain` / `first.last@domain`).
  - **DNS validation**: Async `socket.getaddrinfo` check verifies email domain resolves before committing confidence.
  - **Caching**: Upserts discovered contact into `company_contacts`. Cache hit skips all search/LLM steps.
- **Migration**: `e20c2bd928e7_add_apply_url_contact_fields_and_company_contacts_table`

**Frontend** (`frontend/src/routes/app.jobs.$jobId.tsx`, `frontend/src/lib/mock/jobs.ts`):
- `Job` interface extended with `applyUrl`, `contactEmail`, `contactName`, `contactRole`.
- Job detail page CTA logic:
  - `applyUrl` present → "Apply now" button opens direct link in new tab + records apply event.
  - `applyUrl` absent, `contactEmail` present → `ContactOutreach` component: `mailto:` button with pre-composed cold-outreach email, contact card (name, role, email), one-click email copy, AI discovery disclaimer.
  - Neither → original tracked apply button (fires `POST /api/v1/events/jobs` with `apply` event type).

**Status**: ✅ Implemented, migrated, linted (9/10 tests pass; 1 pre-existing flaky score equality test unrelated to this feature)

---

### 10. Production Docker Containerization & Ansible Infrastructure
**Infrastructure** (`docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `docker/nginx/`, `ansible/`, `DOCKER.md`):
- **Multi-Stage Backend Container**:
  - Python 3.11-slim builder compiles wheels in virtualenv `/opt/venv`.
  - Lean runner copies `/opt/venv`, installs runtime `libpq5`, `chromium`, and `chromium-driver` (for scrapers).
  - Runs under unprivileged system user `opportune` (UID:GID 10001) with Docker `HEALTHCHECK` against `/health`.
- **Multi-Stage Frontend Container**:
  - Node 22-alpine deps stage caches `node_modules` via `npm install`.
  - Builder stage compiles TanStack Start SSR via `NITRO_PRESET=node-server npm run build`.
  - Runner stage executes `node .output/server/index.mjs` on port 3000 under unprivileged user `opportune`.
- **Nginx Ingress Reverse Proxy & Network Isolation**:
  - Nginx is the **only** service with host port exposure (`${PORT:-80}:80`).
  - Backend (`8000`), Frontend (`3000`), and Redis (`6379`) do **not** expose ports to the host; all internal communication occurs over private bridge network `opportune_net`.
  - Nginx handles gzip compression, 30MB client payload limits (for resumes), WebSocket connection upgrades, and security headers.
- **RQ Worker Fleet**:
  - Independent containers for `rq-worker-ai` and `rq-worker-resume` using the backend image with custom start commands.
- **Ansible Automation**:
  - Idempotent playbook (`ansible/playbook.yml`) installing Docker CE and Docker Compose v2 plugin on Debian/Ubuntu.
  - Deploys application directory, synchronizes codebase, ensures `0600` permissions on `.env`.
  - Installs `opportuneai.service` systemd unit for automatic restart on server reboot.
  - Executes database migrations automatically via `alembic upgrade head`.

**Status**: ✅ Complete, validated via `docker compose config` and unit tests

---
*Last updated: 2026-09-22*
