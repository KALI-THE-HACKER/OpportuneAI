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
3. **AI Structured Processing**: The worker uses `GeminiClientPool` to query Gemini models using system prompts. It returns Pydantic validation outputs mapping details (skills, salary, experience, employment type, last_date_to_apply, **apply_url**) and inserts them into `processed_jobs`, resolving expiry date via `config.yml`/`DEFAULT_JOB_EXPIRY_DAYS` fallback. When no `apply_url` is found in the extraction or the scraper `raw_payload`, the **Contact Finder Agent** (`ai/agents/contact_finder.py`) is triggered automatically.
4. **Autonomous Contact Finder Agent**: Runs DuckDuckGo HTML searches (zero cost, no API key) to discover HR, Recruiter, Co-Founder, or Founder contacts for a company. Gemini LLM synthesizes contact name, role, and email from search snippets. Async DNS MX validation confirms deliverability. Results are cached in the `company_contacts` table — subsequent jobs from the same company hit the cache, skipping all search and LLM calls.
5. **REST API Service**: FastAPI app verifying identity tokens statelessly via Auth0 JWKS caching, checking local profiles, and exposing CRUD routes.
6. **Frontend Client App**: Multi-page client application built on React 19 and TanStack Start, loading routes and prefetching details. The job detail page uses a three-tier CTA: (1) direct apply link if available, (2) `mailto:` outreach button with pre-composed cold email if contact was found, (3) tracked apply button otherwise.
7. **Design System & UI**: Custom OKLCH design token architecture with warm porcelain light theme, OLED obsidian dark theme, blocking script hydration for flash-free theme reloads, sticky full-height desktop navigation sidebar, and left-to-right directional wave shimmer skeleton loaders.

---

## 3. Current Progress

**Completion Estimate**: ~70% Complete

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
- Complete platform-wide UI & theme redesign: warm porcelain light mode, OLED obsidian dark mode, wave shimmer skeleton loading system, and responsive auth flows with restored OAuth logins.
- Sticky full-height sidebar layout (`sticky top-0 h-screen`) for desktop and independent main content scrolling.
- Blocking `<head>` theme script preventing flash-of-unstyled-content (FOUC) on page reload.
- Full 12-column responsive Profile view pairing the Identity/Preferences form with Experience & Seniority and live `ResumeInsights`.
- Role-based Access Control (RBAC): database `role` column (`admin` | `user`), YAML-driven `admin_config.admin_emails` in `config.yml` (plus env fallback), `require_admin` FastAPI dependency (HTTP 403 Forbidden for non-admins), protected `/api/admin/*` endpoints, and dynamic frontend protection (sidebar navigation filtering, dashboard pipeline widget guarding, and `/app/admin` route access denial).
- Personalized Job Feed v2 (Hybrid Recommendation Engine): Two-stage recommendation architecture combining pgvector cosine distance candidate retrieval with deterministic `ScoringEngine` structured reranking. Precomputes 768-dimensional job embeddings via Google Gemini (`models/gemini-embedding-001`) upon `ProcessedJob` ingestion; generates canonical user preference embeddings on profile/resume changes; retrieves top N candidates (pool size = 200) via database-side pgvector `<=>` cosine distance; structured reranking weights (Semantic 40%, Structured 60%); Redis feed cache (`feed:user:{id}` with 1-hour TTL); deterministic cold start fallback for empty profiles; single-batch PostgreSQL query pagination with ranking order preservation.
- Real Activity & Notification System: PostgreSQL `user_activities` table, `ActivityRepository`, `/api/notifications` routes mounted in FastAPI, event hooks on job save/apply (`/api/v1/events/jobs`), resume upload and AI parsing, profile updates, and dynamic frontend Dashboard widget, Notifications page with filter tabs, and navbar unread sync.
- **Applied Job State Tracking & Feed Exclusion**: When user applies to a job, `jobId` is added to the user's applied set (in Redis `user:{id}:applied_jobs` and client state). Applied jobs display an emerald `Applied` badge on `JobCard` and an `Applied` CTA (for both external direct apply and tracked applications) on the job detail page instead of `Apply now`. `FeedService` and client feed calls automatically exclude all applied jobs from being suggested in subsequent personalized feeds or recommendation lists.
- **Real Job Applications Tracking & Management**: Complete database-backed application management system. PostgreSQL `job_applications` table (`JobApplication` ORM model, unique constraint on `(user_id, job_id)`), `JobApplicationRepository`, and `/api/applications` REST endpoints (`GET`, `POST`, `PATCH`, `DELETE`). The frontend Applications page (`/app/applied`) provides live status filtering (All, Applied, Interviewing, Offer, Rejected), instant search, inline status updater dropdown, recruiter notes editing, direct job actions, and rich empty states.
- **Feed Location Matching & Willingness to Relocate**: `ScoringEngine.calculate_location_score` updated: (1) if user's preferred locations/modes include `remote` and a job is `remote`, it is treated as an instant location match (`LOCATION_WEIGHT`) without comparing physical locations; (2) `willing_to_relocate` boolean preference added to `User` model, `UserProfileSchema`, `canonical.py` preference embeddings, and frontend Profile page. When enabled, feed ranking skips physical location filters, allowing matching jobs worldwide.

### Remaining
- Ingestion scheduler system to automate scraper execution.
- Advanced behavioral learning and ML reranking.
- Real REST backend integration for admin stats.

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
| **AI Worker** | `backend/workers/ai_worker.py` | Background processor: LLM extraction → apply_url resolution → Contact Finder Agent → embedding |
| **Contact Finder Agent** | `backend/ai/agents/contact_finder.py` | DuckDuckGo search → Gemini synthesis → DNS MX validation → company_contacts cache |
| **Resume Processing** | `backend/routes/resume.py`, `backend/storage/r2.py`, `backend/workers/resume_worker.py` | Private R2 PDF storage, in-memory text extraction, RQ/Gemini parsing, and profile skill synchronization |
| **User Profile Sync** | `backend/utils/auth.py` | Verifies JWTs, fetches Auth0 details, syncs profile database rows |
| **Vite App Shell** | `frontend/src/routes/` | Authenticated routes, layouts, and pages rendering |
| **Design System & Theme** | `frontend/src/styles.css`, `frontend/src/hooks/use-theme.tsx` | OKLCH tokens, shimmer keyframes, theme persistence, FOUC prevention |
| **Profile & Insights UI** | `frontend/src/components/profile/` | Combobox search, resume skill extractor editor, experience level bindings |
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

### 5.5 Theme Persistence & Hydration Invariant
- Theme initialization must occur synchronously in `<head>` before HTML render to prevent light/dark flash during page reloads.
- Color variables in `styles.css` must remain strictly structured under `:root` (light mode porcelain canvas) and `.dark` (OLED obsidian canvas) using `oklch`.

### 5.6 Contact Finder Agent Caching Invariant
- The `company_contacts` table is a shared cache keyed on `company_key` (normalized lowercase, alphanumeric-only company name). The agent MUST check for an existing cached record with a non-null `contact_email` before running any search or LLM calls.
- Never hard-delete rows from `company_contacts` — instead upsert with updated confidence values. Deleting cached contacts would cause redundant agent re-runs for already-resolved companies.
- The agent is non-blocking: LLM failure, DNS failure, or empty search results must never raise exceptions to the caller (`ai_worker.py` catches and logs all agent errors gracefully).

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
