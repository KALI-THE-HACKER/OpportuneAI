# OpportuneAI - Architecture Overview

## Project Purpose
OpportuneAI is an AI-powered job matching platform that:
1. **Scrapes** job postings from multiple sources (LinkedIn, Naukri, Wellfound, RemoteOK)
2. **Processes** raw job data using AI (Gemini/OpenRouter) to extract structured information
3. **Matches** processed jobs against user profiles (skills, preferences, experience)
4. **Provides** a React frontend (TanStack Start) for job discovery and application tracking

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ LinkedIn │  │  Naukri  │  │Wellfound │  │ RemoteOK │  │  Auth0   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼──────────────┼──────────────┼──────────────┼────────────┼────────┘
        │              │              │              │            │
        ▼              ▼              ▼              ▼            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI + Python)                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     INGESTION PIPELINE                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │  │
│  │  │LinkedIn  │  │  Naukri  │  │Wellfound │  │ RemoteOK │        │  │
│  │  │Provider  │  │ Provider │  │ Provider │  │ Provider │        │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │  │
│  │       └─────────────┼──────────────┼────────────┘              │  │
│  │                     ▼              ▼                            │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │              IngestionPipeline (orchestrator)            │  │  │
│  │  │  - Deduplication via content hashes                       │  │  │
│  │  │  - Saves to raw_jobs table                                │  │  │
│  │  │  - Enqueues AI processing jobs                            │  │  │
│  │  └──────────────────────┬───────────────────────────────────┘  │  │
│  └─────────────────────────┼─────────────────────────────────────┘  │
│                            ▼                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   AI PROCESSING WORKER (RQ + Redis)            │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │              AI Worker (RQ Worker)                       │  │ │
│  │  │  - Consumes raw_job_id from "ai-processing" queue        │  │ │
│  │  │  - Uses AI Provider (Gemini/OpenRouter) to extract       │  │ │
│  │  │    structured data: skills, salary, experience, etc.     │  │ │
│  │  │  - Saves to processed_jobs table                         │  │ │
│  │  │  - Computes match scores against user profiles           │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                            │                                        │
│                            ▼                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     API LAYER (FastAPI)                         │ │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐   │ │
│  │  │ /auth  │  │ /jobs  │  │ /user  │  │/resume │  │ /admin │   │ │
│  │  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘   │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (TanStack Start + React 19)            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Routes: /app/dashboard, /app/jobs, /app/recommendations,       │  │
│  │          /app/applied, /app/saved, /app/resume, /app/profile    │  │
│  │  Auth: @auth0/auth0-react (SPA + PKCE)                          │  │
│  │  State: @tanstack/react-query (server state)                    │  │
│  │  UI: Radix UI + Tailwind CSS + Lucide icons                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │PostgreSQL│  │  Redis   │  │  Auth0   │  │  AI APIs │                │
│  │(Primary) │  │  (Queue) │  │  (Auth)  │  │Gemini/OR │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Folder/Module Breakdown

### Backend (`backend/`)
```
backend/
├── app.py                    # FastAPI app factory, middleware, routers
├── alembic.ini               # Alembic migration config
├── config/
│   ├── config.yml            # Scraper config (job titles, locations)
│   └── settings.py           # Pydantic Settings (env-driven config)
├── ai/
│   ├── providers/            # AI Provider abstraction (Gemini, OpenRouter)
│   │   ├── base.py           # Abstract base class
│   │   ├── factory.py        # Provider factory
│   │   ├── gemini.py         # Google Gemini implementation
│   │   └── openrouter.py     # OpenRouter implementation
│   ├── extraction/
│   │   ├── extractor.py      # Job extraction logic with prompts
│   │   └── prompts.py        # Prompt templates
│   ├── pools/
│   │   └── gemini_pool.py    # Connection pool for Gemini API
│   └── schemas.py            # Pydantic schemas for AI responses
├── database/
│   ├── base.py               # SQLAlchemy declarative base
│   ├── session.py            # Async session management
│   ├── models/               # SQLAlchemy ORM models
│   │   ├── user.py           # User profile (synced from Auth0)
│   │   ├── raw_job.py        # Raw scraped job data
│   │   └── processed_job.py  # AI-processed structured job data
│   └── repositories/         # Repository pattern for DB access
│       ├── user_repository.py
│       ├── raw_job_repository.py
│       └── processed_job_repository.py
├── ingestion/
│   └── pipeline.py           # Ingestion orchestrator
├── providers/                # Job board scrapers/providers
│   ├── base.py               # Abstract base provider
│   ├── linkedin_provider.py  # linkedin-jobs-scraper library
│   ├── naukri_provider.py    # undetected-chromedriver + BeautifulSoup
│   ├── wellfound_provider.py # Playwright-based scraper
│   ├── remoteOK_provider.py  # REST API (remoteok.com/api)
│   └── models/
│       └── raw_jobs_data.py  # Pydantic model for raw job data
├── scrapers/                 # Standalone scraper scripts (legacy/standalone)
│   ├── linkedin_scraper.py
│   ├── naukri_scraper.py
│   └── wellfound_scraper.py
├── routes/                   # FastAPI route handlers
│   └── auth.py               # Auth0 integration endpoints
├── workers/
│   ├── queue.py              # RQ queue configuration
│   └── ai_worker.py          # RQ worker for AI processing
├── utils/
│   ├── auth.py               # Auth0 token verification, user sync
│   ├── hashing.py            # Content hashing for deduplication
│   ├── linkedin_utils.py
│   ├── naukri_utils.py
│   └── wellfound_utils.py
├── migrations/               # Alembic migrations
│   ├── versions/
│   └── env.py
└── tests/                    # pytest test suite
```

### Frontend (`frontend/`)
```
frontend/
├── src/
│   ├── routes/               # TanStack Router file-based routes
│   │   ├── __root.tsx        # Root layout + providers
│   │   ├── app.tsx           # Authenticated app layout
│   │   ├── app.dashboard.tsx
│   │   ├── app.jobs.index.tsx
│   │   ├── app.jobs.$jobId.tsx
│   │   ├── app.recommendations.tsx
│   │   ├── app.applied.tsx
│   │   ├── app.saved.tsx
│   │   ├── app.resume.tsx
│   │   ├── app.profile.tsx
│   │   ├── app.settings.tsx
│   │   ├── app.admin.tsx
│   │   ├── auth.sign-in.tsx
│   │   ├── auth.sign-up.tsx
│   │   ├── auth.callback.tsx
│   │   ├── auth.forgot-password.tsx
│   │   ├── auth.reset-password.tsx
│   │   └── auth.verify-email.tsx
│   ├── components/
│   │   ├── ui/               # shadcn/ui components (Radix + Tailwind)
│   │   ├── shared/           # Shared business components
│   │   │   ├── job-card.tsx
│   │   │   ├── page-header.tsx
│   │   │   ├── stat-card.tsx
│   │   │   └── state-views.tsx
│   │   ├── auth/             # Auth shell
│   │   └── layouts/          # Layout components
│   ├── hooks/
│   │   ├── use-auth.tsx      # Auth0 integration hook
│   │   ├── use-theme.tsx
│   │   └── use-mobile.tsx
│   ├── lib/
│   │   ├── api/              # API client layer
│   │   │   ├── client.ts     # fetch wrapper with auth
│   │   │   ├── auth.ts       # Auth API
│   │   │   ├── jobs.ts       # Jobs API
│   │   │   ├── user.ts       # User profile API
│   │   │   ├── resume.ts     # Resume API
│   │   │   ├── notifications.ts
│   │   │   └── admin.ts
│   │   ├── mock/             # Mock data for development
│   │   └── pwa/              # PWA service worker
│   ├── router.tsx            # Router configuration
│   └── styles.css            # Global styles + Tailwind
├── package.json
├── vite.config.ts
├── tsconfig.json
└── bun.lock
```

## Important Services

### 1. Ingestion Pipeline (`backend/ingestion/pipeline.py`)
- Orchestrates all job providers
- Deduplicates using content hashes
- Stores raw jobs → enqueues AI processing

### 2. AI Processing Worker (`backend/workers/ai_worker.py`)
- RQ worker consuming from Redis queue
- Uses AI providers (Gemini/OpenRouter) to extract structured data
- Computes match scores against user profiles
- Stores to `processed_jobs` table

### 3. AI Provider Abstraction (`backend/ai/providers/`)
- Abstract base class `BaseAIProvider`
- Factory pattern for provider selection
- Implementations: `GeminiProvider`, `OpenRouterProvider`
- Connection pooling for Gemini (`gemini_pool.py`)

### 4. Job Providers (`backend/providers/`)
- Abstract base `BaseProvider`
- Implementations for each job board
- Return normalized `RawJobData` Pydantic models

### 5. Authentication (`backend/routes/auth.py` + `backend/utils/auth.py`)
- Auth0 integration (password realm + DB connection)
- Mock mode for development (`mock_client_id`)
- JWT token verification with JWKS caching
- User synchronization (Auth0 → PostgreSQL)

### 6. Frontend Auth (`frontend/src/hooks/use-auth.tsx`)
- `@auth0/auth0-react` integration
- Token management with auto-refresh
- Syncs token to API client

## Data Flow

```
Job Boards (LinkedIn, Naukri, Wellfound, RemoteOK)
         │
         ▼
┌─────────────────────────────────────┐
│      Ingestion Pipeline             │
│  1. Fetch from all providers        │
│  2. Compute content_hash            │
│  3. Deduplicate against raw_jobs    │
│  4. Save new raw_jobs               │
│  5. Enqueue AI processing jobs      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      Redis Queue (ai-processing)    │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      AI Worker (RQ)                 │
│  1. Dequeue raw_job_id              │
│  2. Fetch raw job + user profiles   │
│  3. Call AI Provider (Gemini/OR)    │
│  4. Extract: skills, salary, exp,   │
│     employment_type, description    │
│  5. Compute match_score per user    │
│  6. Save to processed_jobs          │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      PostgreSQL                     │
│  - users (Auth0 sync)               │
│  - raw_jobs (deduped scraped data)  │
│  - processed_jobs (structured data) │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      FastAPI REST API               │
│  - /api/jobs (search, filter)       │
│  - /api/recommendations (matched)   │
│  - /api/users/me (profile)          │
│  - /api/resume (upload, parse)      │
│  - /api/auth (login, register)      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      TanStack Start Frontend        │
│  - React Query for server state     │
│  - Auth0 React SDK for auth         │
│  - Radix UI + Tailwind for UI       │
└─────────────────────────────────────┘
```

## Database Design

### Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User profiles synced from Auth0 | `id`, `auth0_sub` (unique), `email`, `name`, `skills[]`, `preferred_roles[]`, `preferred_locations[]`, `work_modes[]`, `years_of_experience`, `min_salary` |
| `raw_jobs` | Raw scraped job data (deduped) | `id`, `source`, `external_id`, `title`, `company`, `location`, `date_posted`, `link`, `content_hash` (unique), `raw_payload` (JSON) |
| `processed_jobs` | AI-extracted structured data | `id`, `raw_job_id` (FK, unique), `job_title`, `company`, `skills[]`, `location`, `salary`, `experience_years`, `employment_type`, `job_description`, `processed_at` |

### Relationships
- `raw_jobs` 1:1 `processed_jobs` (via `raw_job_id` FK with unique constraint)
- `users` have no direct FK to jobs (matching computed at query time)

### Indexes
- `raw_jobs.content_hash` (unique) - deduplication
- `raw_jobs.source` + `raw_jobs.external_id` - provider dedup
- `processed_jobs.job_title` - search
- `processed_jobs.company` - filter
- `processed_jobs.skills` (GIN) - skill matching
- `users.auth0_sub` (unique) - auth lookup
- `users.email` (unique) - auth lookup

## API Structure

### Authentication
- `POST /api/auth/login` - Email/password (Auth0 password realm)
- `POST /api/auth/register` - Signup (Auth0 DB connection)
- `GET /api/auth/me` - Current user profile
- `PUT /api/users/me` - Update profile

### Jobs
- `GET /api/jobs` - Paginated job search with filters
- `GET /api/jobs/{job_id}` - Job detail
- `GET /api/recommendations` - AI-matched jobs for current user
- `GET /api/applied` - User's applications
- `GET /api/saved` - Saved jobs

### Resume
- `POST /api/resume/upload` - Upload PDF
- `POST /api/resume/parse` - Parse resume with AI

### Admin
- `GET /api/admin/stats` - Pipeline stats
- `POST /api/admin/ingest` - Trigger ingestion

## Authentication & Authorization

### Auth0 Integration
- **Authentication**: Auth0 React SDK (SPA + PKCE) on frontend
- **Backend verification**: JWT validation via JWKS (cached)
- **User sync**: On first login/register, create/update local `users` row
- **Mock mode**: `AUTH0_CLIENT_ID=mock_client_id` enables local dev without Auth0

### Authorization
- All `/api/*` endpoints require valid JWT (except `/api/auth/login`, `/api/auth/register`)
- User isolation: users only see their own profile, applications, saved jobs
- Admin endpoints: check for admin role (not yet fully implemented)

## External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| **Auth0** | Authentication & user management | JWT verification, user sync |
| **PostgreSQL** | Primary database | SQLAlchemy async + asyncpg |
| **Redis** | Job queue (RQ) | `redis-py` + `rq` |
| **Google Gemini** | Primary AI provider | `google-generativeai` SDK + connection pool |
| **OpenRouter** | Fallback AI provider | OpenAI-compatible API |
| **LinkedIn** | Job scraping | `linkedin-jobs-scraper` (Selenium) |
| **Naukri** | Job scraping | `undetected-chromedriver` + BeautifulSoup |
| **Wellfound** | Job scraping | Playwright |
| **RemoteOK** | Job scraping | REST API (`remoteok.com/api`) |

## Event Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Scheduler  │────▶│  Ingestion  │────▶│   Redis     │────▶│  AI Worker  │
│  (cron/     │     │  Pipeline   │     │   Queue     │     │  (RQ)       │
│   manual)   │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │
                                                                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │◀────│   FastAPI   │◀────│ PostgreSQL  │◀────│ Processed   │
│  (React)    │     │   REST API  │     │  (Jobs,     │     │  Jobs Table │
└─────────────┘     └─────────────┘     │   Users)    │     └─────────────┘
                                         └─────────────┘
```

## Background Workers

### RQ Worker (`backend/workers/ai_worker.py`)
- Queue: `ai-processing` (Redis)
- Job: `process_raw_job(raw_job_id: int)`
- Concurrency: Configurable via worker count
- Retries: 3 attempts with exponential backoff

### Scheduler (Not Yet Implemented)
- Should run ingestion pipeline periodically (cron / APScheduler)
- Should trigger match score recalculation

## Important Abstractions

### 1. Provider Pattern (`backend/providers/base.py`)
```python
class BaseProvider(ABC):
    @abstractmethod
    async def fetch_jobs(self) -> list[RawJobData]: ...
```

### 2. AI Provider Pattern (`backend/ai/providers/base.py`)
```python
class BaseAIProvider(ABC):
    @abstractmethod
    async def extract_job_data(self, raw_job: RawJobData, user_profile: UserProfile) -> ExtractedJobData: ...
```

### 3. Repository Pattern (`backend/database/repositories/`)
```python
class BaseRepository:
    def __init__(self, session: AsyncSession): ...
    
class UserRepository(BaseRepository): ...
class RawJobRepository(BaseRepository): ...
class ProcessedJobRepository(BaseRepository): ...
```

### 4. Content Hash Deduplication (`backend/utils/hashing.py`)
```python
def compute_content_hash(title, company, date, location) -> str:
    return hashlib.sha256(f"{title}|{company}|{date}|{location}".encode()).hexdigest()[:16]
```

## Design Patterns Used

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Provider/Strategy** | `providers/`, `ai/providers/` | Swappable job sources & AI models |
| **Factory** | `ai/providers/factory.py` | Provider instantiation |
| **Repository** | `database/repositories/` | DB abstraction, testability |
| **Dependency Injection** | FastAPI `Depends()` | Session, auth, config |
| **Queue/Worker** | `workers/queue.py`, `ai_worker.py` | Async AI processing |
| **Connection Pool** | `ai/pools/gemini_pool.py` | API rate limit management |
| **Repository + Unit of Work** | `database/repositories/` | Transaction management |

## Technical Debt & Known Issues

1. **No scheduled ingestion** - Pipeline must be triggered manually
2. **No match score recalculation** - Scores computed once at processing time
3. **Naukri/Wellfound scrapers** use browser automation (fragile, slow)
4. **No retry logic** for failed provider fetches in pipeline
5. **Frontend uses mock API** - Real API integration incomplete
6. **No comprehensive test coverage** for ingestion/AI pipeline
7. **Auth0 mock mode** has limited parity with real Auth0
8. **No rate limiting** on API endpoints
9. **No API versioning** strategy
10. **No structured logging** (just basic logging to file)
11. **Database migrations** not run automatically in deployment
12. **Frontend build** uses Vite but backend serves separately (no SSR integration)

## Assumptions for Future Developers

1. **Auth0 is the source of truth for auth** - local `users` table is a cache/sync
2. **Content hash deduplication** assumes title+company+date+location uniquely identifies a job
3. **AI processing is async** - jobs appear in raw_jobs before processed_jobs
4. **Match scores** are computed per-user at processing time, not at query time
5. **RemoteOK is the only reliable API-based source** - others use scraping
6. **Frontend expects FastAPI at `http://localhost:8000`** (VITE_API_URL)
7. **Mock Auth0 mode** uses `mock_client_id` - set real credentials for production
8. **Redis must be running** for AI worker queue
9. **PostgreSQL** required with `asyncpg` driver
10. **Gemini API key** required for AI processing (or OpenRouter fallback)

---
*Last updated: 2026-07-27*
