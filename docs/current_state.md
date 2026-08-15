# OpportuneAI - Current State

## Implemented

### 1. User Authentication (Backend + Frontend)
**Backend** (`backend/routes/auth.py`, `backend/utils/auth.py`):
- Auth0 integration with password realm grant (email/password login)
- Auth0 DB connection signup flow
- JWT verification with JWKS caching
- User synchronization: Auth0 → PostgreSQL `users` table
- Mock mode for local development (`AUTH0_CLIENT_ID=mock_client_id`)
- Profile CRUD: GET `/api/auth/me`, PUT `/api/users/me`

**Frontend** (`frontend/src/hooks/use-auth.tsx`, `frontend/src/routes/auth.*`):
- `@auth0/auth0-react` SPA authentication with PKCE
- Sign in, sign up, callback, forgot password, reset password, verify email routes
- Token persistence in localStorage with auto-refresh
- Syncs auth token to API client (`setApiAuthToken`)

**Status**: ✅ Functional with mock mode; real Auth0 needs credentials

---

### 2. Job Ingestion Pipeline
**Backend** (`backend/ingestion/pipeline.py`, `backend/providers/`):
- Abstract `BaseProvider` with 4 implementations:
  - **LinkedInProvider**: `linkedin-jobs-scraper` (Selenium-based)
  - **NaukriProvider**: `undetected-chromedriver` + BeautifulSoup
  - **WellfoundProvider**: Playwright + Firecrawl markdown extraction
  - **RemoteOKProvider**: REST API (`https://remoteok.com/api`)
- Deduplication via content hash (SHA256 of title|company|date|location)
- Saves to `raw_jobs` table
- Enqueues AI processing jobs to Redis queue

**Status**: ✅ Core pipeline works; scrapers are fragile (browser automation)

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
- `ProcessedJob` - AI-extracted structured data with 1:1 link to RawJob

**Repositories** (`backend/database/repositories/`):
- `UserRepository`, `RawJobRepository`, `ProcessedJobRepository`
- Async SQLAlchemy with asyncpg

**Migrations** (`backend/migrations/versions/`):
- `a028d6f2e27e_create_users_table.py`
- `33911cca3577_create_raw_jobs.py`
- `68cc82b16b5f_create_processed_jobs.py`

**Status**: ✅ Complete with migrations

---

### 5. FastAPI REST API
**Routes** (`backend/routes/auth.py`):
- Authentication endpoints (login, register, me, update)
- Ready for job/user/resume/admin routes (stubs exist in frontend API client)

**Status**: 🟡 Auth complete; other endpoints need implementation

---

### 6. Frontend Application Shell
**Framework**: TanStack Start (React 19, file-based routing)
**UI**: Radix UI + Tailwind CSS + Lucide icons
**State**: @tanstack/react-query for server state

**Routes implemented** (`frontend/src/routes/`):
- `/` → redirects to `/app/dashboard`
- `/app/dashboard` - Stats, recommendations, activity, system pipeline
- `/app/jobs` - Job listing with filters (index + detail `$jobId`)
- `/app/recommendations` - AI-matched jobs
- `/app/applied` - Application tracking
- `/app/saved` - Saved jobs
- `/app/resume` - Resume upload/parsing
- `/app/profile` - User profile management
- `/app/settings` - Settings
- `/app/admin` - Admin dashboard (pipeline stats)
- Auth routes: sign-in, sign-up, callback, forgot/reset password, verify email

**Components** (`frontend/src/components/`):
- shadcn/ui component library (30+ components)
- Shared business components: JobCard, PageHeader, StatCard, StateViews
- Auth shell, layouts (app/public)

**Status**: ✅ UI complete; uses mock API layer

---

### 7. API Client Layer (Frontend)
**Location**: `frontend/src/lib/api/`
- `client.ts` - fetch wrapper with auth token, error handling
- `auth.ts` - signIn, signUp, signOut, session persistence
- `jobs.ts`, `user.ts`, `resume.ts`, `notifications.ts`, `admin.ts` - typed API calls
- `resume.ts` uses the live FastAPI endpoints; remaining modules use mock data with simulated latency (`API_LATENCY_MS = 350`)

**Status**: 🟡 Resume integration is live; the remaining modules are mock-backed

---

### 8. Resume Processing
**Backend** (`backend/resume/`, `backend/routes/resume.py`, `backend/workers/resume_worker.py`):
- Stores source PDFs privately in Cloudflare R2 and tracks the opaque object key on `users`
- Extracts PDF text in memory, stores metadata/text on `users`, then parses it asynchronously through RQ and Gemini
- Merges AI-extracted skills into `users.skills`; exposes upload, status, and deletion endpoints
- Writes rotating feature logs to `backend/logs/` (`resume.log`, `api.log`, `worker.log`, `ingestion.log`)

**Frontend** (`frontend/src/routes/app.resume.tsx`):
- Upload UI with drag-and-drop
- Parsing trigger

**Status**: ✅ R2-backed upload and AI parsing path implemented; requires R2 credentials and migration

---

### 9. Testing Infrastructure
**Backend** (`backend/tests/`):
- pytest with async support
- Unit tests: auth, repositories, providers, AI factory, AI providers, job extractor
- Integration tests: RQ queue

**Frontend**: No tests yet

**Status**: 🟡 Backend has test structure; coverage incomplete

---

### 10. Profile & Resume Intelligence UI
**Frontend** (`frontend/src/components/profile/`, `frontend/src/routes/app.profile.tsx`, `frontend/src/routes/app.resume.tsx`):
- `ResumeInsights`: Dedicated component for AI-extracted skills with verification against a standardized system catalog.
- System Skills Catalog (`frontend/src/lib/data/skills.csv`, `skills.ts`): Categorized catalog of standard technical skills with fuzzy/prefix matching and canonicalization.
- `SearchCombobox` & `MultiSearchCombobox`: Autocomplete search inputs for target job title, location, experience levels, preferred roles, and preferred locations.
- Standardized Profile Options (`frontend/src/lib/data/profile-options.ts`): Comprehensive catalogs covering internships, specialty engineering tracks, tech hubs, and seniority levels.
- Optimistic resume removal: Instantly clears cache on client with automatic rollback and user notification on backend failure.

**Backend** (`backend/ai/extraction/resume_prompts.py`, `backend/ai/schemas.py`):
- Strict prompt rules extracting high-signal, relevant technical proficiencies.
- Excludes office suite utilities (Word, Excel, Slack, Zoom) and unmeasurable generic soft buzzwords.

**Status**: ✅ Complete and verified with tests

---

## In Progress

### 1. Real API Integration (Frontend → Backend)
- **Completed**: API client structure, auth token management, live resume upload/status/delete calls, profile CRUD calls
- **Missing**: Replace mock implementations in `frontend/src/lib/api/jobs.ts`, `notifications.ts`, `admin.ts` with real fetch calls
- **Blockers**: Backend job and admin endpoints are not fully implemented

### 2. Job Search & Filtering API
- **Completed**: Database models, repositories, processed_jobs table
- **Missing**: FastAPI routes for `/api/jobs` (search, filter, paginate), `/api/recommendations`
- **Blockers**: Need to implement route handlers

### 3. Match Score Recalculation
- **Completed**: Initial match scoring at AI processing time
- **Missing**: Recalculate when user updates profile; background job for periodic refresh
- **Blockers**: No scheduler implemented

### 4. Scheduled Ingestion
- **Completed**: IngestionPipeline class, all providers
- **Missing**: Cron/APScheduler to run pipeline periodically
- **Blockers**: Not prioritized yet

---

## Not Yet Implemented

Based on codebase analysis (TODOs, stubs, missing routes, comments):

### Backend
- [ ] `GET /api/jobs` - Paginated job search with filters (skills, location, salary, experience)
- [ ] `GET /api/jobs/{job_id}` - Job detail with match score
- [ ] `GET /api/recommendations` - User-matched jobs (with pagination)
- [ ] `GET /api/applied` - User applications with status
- [ ] `POST /api/applied` - Apply to job
- [ ] `GET /api/saved` - Saved jobs
- [ ] `POST /api/saved` - Save/unsave job
- [x] `POST /api/resume/upload` - In-memory PDF upload and asynchronous parsing
- [x] `GET /api/resume` - Resume metadata and parse status
- [x] `DELETE /api/resume` - Clear stored resume data
- [ ] `GET /api/admin/stats` - Pipeline stats (frontend expects this)
- [ ] `POST /api/admin/ingest` - Trigger manual ingestion
- [ ] `POST /api/admin/reprocess` - Reprocess raw jobs
- [ ] Scheduler for periodic ingestion (APScheduler or cron)
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
*Last updated: 2026-08-15*
