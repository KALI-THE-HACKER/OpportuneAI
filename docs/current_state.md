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
- Multi-provider social login: Google, GitHub, LinkedIn
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

## In Progress

### 1. Real API Integration (Frontend → Backend)
- **Completed**: API client structure, auth token management, live resume upload/status/delete calls, profile CRUD calls (`userApi.get`, `userApi.update`)
- **Missing**: Replace mock implementations in `frontend/src/lib/api/jobs.ts`, `notifications.ts`, `admin.ts` with real fetch calls
- **Blockers**: Backend job and admin endpoints need implementation

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
*Last updated: 2026-08-16*
