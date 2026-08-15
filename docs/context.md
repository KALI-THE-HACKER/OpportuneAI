# Long-Term Project Context Memory

This document acts as the persistent, continuously updated system state of OpportuneAI for future AI coding agents.

---

## 1. Project Summary

OpportuneAI is an AI-powered job discovery and application tracking copilot. It automatically scrapes developer opportunities from LinkedIn, Naukri, Wellfound, and RemoteOK, cleans and enriches descriptions using Gemini LLM models, computes suitability match scores against user profiles, and exposes a React frontend (built on TanStack Start) for job discovery, saving, and application tracking.

---

## 2. Current Architecture Snapshot

The application runs a divided architecture:
1. **Scraping Ingestion Pipeline**: Runs crawlers (Selenium, Playwright, Firecrawl API, REST) based on parameters in `config.yml`. It computes content hashes for raw listings, checking them against PostgreSQL records to bypass duplicates, saving new raw records as `pending`.
2. **Task Queue Worker**: For each raw insertion, a job is dispatched to a Redis Queue (RQ) named `ai-processing`. Standalone process workers pull jobs from Redis and start AI extraction.
3. **AI Structured Processing**: The worker uses `GeminiClientPool` to query Gemini models using system prompts. It returns Pydantic validation outputs mapping details (skills, salary, experience, employment type) and inserts them into `processed_jobs`.
4. **REST API Service**: FastAPI app verifying identity tokens statelessly via Auth0 JWKS caching, checking local profiles, and exposing CRUD routes.
5. **Frontend Client App**: Multi-page client application built on React 19 and TanStack Start, loading routes and prefetching details.

---

## 3. Current Progress

**Completion Estimate**: ~65% Complete

### Implemented
- Complete async database layer with SQLAlchemy 2.0 and Alembic migrations.
- Ingestion pipeline with 4 functional crawlers (LinkedIn, Naukri, Wellfound, RemoteOK) and content hash deduplication.
- Asynchronous task processing utilizing Redis and Python RQ.
- Thread-safe `GeminiClientPool` distributing prompts across multiple keys.
- Complete Auth0 integration on the backend (signup, login, profiles sync, JWT validation) and frontend hook routines.
- Complete frontend UI layouts (dashboard, search lists, resume upload, settings, admin stats).
- Cloudflare R2-backed private PDF storage with in-memory text extraction and asynchronous Gemini parsing.
- High-signal AI resume extraction prompt tuning (filtering trivial office tools and generic soft buzzwords).
- Standardized system skill catalog (`skills.csv`, `skills.ts`) with combobox autocomplete in `ResumeInsights`.
- Standardized profile suggestion options (`profile-options.ts`, `search-combobox.tsx`) for job titles, locations, roles, and experience levels.
- Optimistic UI updates with cache rollback for resume removals.

### Remaining
- FastAPI routers for job lists, detail queries, recommendations, saves, and application endpoints.
- Ingestion scheduler system to automate scraper execution.
- Match score recalculation tasks triggered upon user profile updates.
- Real REST backend integration within the remaining frontend API client modules.

---

## 4. Active Components

| Component | Location | Responsibility |
|:---|:---|:---|
| **Ingestion Pipeline** | `backend/ingestion/pipeline.py` | Runs scrapers, checks content hashes, writes raw jobs, triggers workers |
| **LinkedIn Provider** | `backend/providers/linkedin_provider.py` | Scrapes LinkedIn utilizing `linkedin-jobs-scraper` |
| **Naukri Provider** | `backend/providers/naukri_provider.py` | Scrapes Naukri utilizing `undetected-chromedriver` |
| **Wellfound Provider** | `backend/providers/wellfound_provider.py` | Scrapes Wellfound using Firecrawl Markdown API |
| **RemoteOK Provider** | `backend/providers/remoteOK_provider.py` | Fetches JSON listings via RemoteOK API |
| **Gemini Client Pool** | `backend/ai/pools/gemini_pool.py` | Thread-safe connection key cycling |
| **AI Worker** | `backend/workers/ai_worker.py` | Background processor extracting metadata via LLM |
| **Resume Processing** | `backend/routes/resume.py`, `backend/storage/r2.py`, `backend/workers/resume_worker.py` | Private R2 PDF storage, in-memory text extraction, RQ/Gemini parsing, and profile skill synchronization |
| **User Profile Sync** | `backend/utils/auth.py` | Verifies JWTs, fetches Auth0 details, syncs profile database rows |
| **Vite App Shell** | `frontend/src/routes/` | Authenticated routes, layouts, and pages rendering |
| **API Client** | `frontend/src/lib/api/` | Fetches session, user, and job details |

---

## 5. Important Invariants

*The following rules must never be violated when modifying the codebase:*

### 5.1 Content Hashing Rules
- Ingested jobs compute a unique SHA-256 hash using the signature: `title|company|date_posted|location`. This fingerprint is truncated to 16 characters for index performance.
- Any change in provider formatting or scraping payload MUST NOT affect fingerprint generation rules to prevent duplicate job insertion.

### 5.2 1-to-1 Raw to Processed Jobs Constraint
- Each `ProcessedJob` table record must map to exactly one `RawJob` record via `raw_job_id` containing a foreign key unique constraint. 
- AI extraction tasks must only write processed records after raw insertion is committed.

### 5.3 Authentication Guard
- All backend routes matching `/api/*` (except login and register endpoints) must require verification check headers (`Authorization: Bearer <jwt>`) parsed by the `get_current_user` dependency.

### 5.4 Database Transaction Boundary
- Background task processes must invoke session rollback triggers when exceptions occur, marking processing status as `failed` to prevent database locks or corrupted transaction states.

---

## 6. Things Future Agents Must Know

- **Mock Authentication**: During local tests, setting `AUTH0_CLIENT_ID=mock_client_id` activates mock auth routines. Tokens prefixed with `mock-` bypass server verifications and map custom strings directly to user profile fields.
- **Browser Automation Fragility**: Naukri and LinkedIn providers use Selenium and browser execution libraries. They require a local Chrome binary and are prone to breaking if target website layout tags shift.
- **Vite TanStack Start Routines**: Frontend pages utilize file-based route definitions. Modifying directories requires recompiling routing trees via `npm run dev` to generate `routeTree.gen.ts` updates.
- **Python Code Conventions**: PEP8 compliant. Imports must be sorted using Ruff format tools. All database session queries must utilize SQLAlchemy 2.0 select syntax (`select(Model).where(...)`) instead of legacy queries.

---

## 7. Recommended Next Tasks

### 7.1 Implement Job Search & Recommendation API Routes
- **Why**: The frontend search list, dashboard, and recommendations tabs are static mock pages. Serving actual PG data enables core site usage.
- **Where to work**: Create `backend/routes/jobs.py` and implement routes `/api/jobs`, `/api/jobs/{id}`, and `/api/recommendations`. Register these in `backend/app.py`.
- **Possible Pitfalls**: Query performance when filtering lists by array properties (e.g. skills) or string lookups. Ensure appropriate GIN indexes are set in processed job schemas.

### 7.2 Replace Frontend Mock Mocks with Real Fetch Calls
- **Why**: Connecting components to real API calls completes the integration loop.
- **Where to work**: Modify `frontend/src/lib/api/jobs.ts`, `frontend/src/lib/api/user.ts`, etc. Swap local mock delays and arrays with real `apiCall` execution.
- **Possible Pitfalls**: Schema mismatches between frontend type models and FastAPI JSON validation schemas.

### 7.3 Automated Scheduled Ingestion
- **Why**: Scraper crawling is currently manually triggered; automated scheduled jobs keep listings fresh.
- **Where to work**: Create a standalone scheduling script (e.g. `backend/scheduler.py`) using `apscheduler` to run `IngestionPipeline().run()` periodically.
- **Possible Pitfalls**: Crawlers overlapping execution windows. Ensure mutex locks or status checks block execution if another crawling run is already active.
