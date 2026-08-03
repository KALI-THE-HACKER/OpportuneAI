# Module Documentation

This document explains the purpose, responsibilities, dependencies, public APIs, and internal implementation details of every major module in OpportuneAI.

---

## 1. AI Extraction Layer (`backend/ai/`)
### Purpose
Processes raw text from job descriptions to extract structured, standardized metadata using large language models.

### Responsibilities
- Define target validation structure for parsed metadata (`JobExtraction`).
- Cycle API keys across requests to balance free tier rate limits.
- Render system/human prompting templates to format the job descriptions.
- Construct type-safe provider interfaces and fallback models.

### Dependencies
- `langchain-google-genai` (Gemini API adapter)
- `langchain-openrouter` (OpenRouter API adapter)
- `langchain-core` (prompts, message schema interfaces)
- `pydantic` (validation)
- `config` (API keys, models, temperature settings)

### Public APIs
- **`ai.providers.factory.get_llm()`**: Returns the configured `BaseLLM` provider instance (Gemini or OpenRouter).
- **`ai.extraction.extractor.JobExtractor(llm)`**:
  - `extract(raw_job: RawJob) -> JobExtraction`: Parses a raw job payload and returns a structured output.
- **`ai.pools.gemini_pool.get_pool()`**: Returns the thread-safe `GeminiClientPool` singleton.
  - `acquire()`: Cycles keys and returns the next client instance.
  - `mark_failure(client)`: Logs failure states for key monitoring.

### Internal Implementation Notes
- **Thread-safe Key Pool**: Uses a standard threading `Lock` to synchronize request counters and cycling indexes.
- **Strict Parsing**: The prompt templates instruct the model to avoid guessing or hallucinating properties not explicitly stated in descriptions.

---

## 2. Database & Data Access Layer (`backend/database/`)
### Purpose
Handles asynchronous connection pool management, maps relational schemas, and isolates database operations.

### Responsibilities
- Create asynchronous SQLAlchemy engines and local session makers.
- Map ORM definitions for users, raw scraping data, and structured extraction tables.
- Encapsulate CRUD logic to avoid database queries in router logic.

### Dependencies
- `SQLAlchemy 2.0` (core mapper and select commands)
- `asyncpg` (PostgreSQL async database driver)
- `alembic` (schema migration utility)

### Public APIs
- **`database.session.get_db()`**: FastAPI dependency yielding async database session objects.
- **`database.repositories.user_repository.UserRepository(db)`**:
  - `get_by_id(id)`: Fetch user by primary key.
  - `get_by_auth0_sub(sub)`: Fetch user by Auth0 subject ID.
  - `get_by_email(email)`: Fetch user by email address.
  - `create(...)`: Insert a new user.
  - `update(user, **kwargs)`: Commit updates to existing records.
- **`database.repositories.raw_job_repository.RawJobRepository(db)`**:
  - `get_existing_hashes()`: Retrieve all unique content hashes.
  - `save_many(jobs)`: Bulk insert raw scraped jobs.
- **`database.repositories.processed_job_repository.ProcessedJobRepository(db)`**:
  - `create(raw_job_id, extraction)`: Construct a processed job record.
  - `get_by_id(id)`: Fetch by primary key.
  - `get_by_raw_job_id(raw_job_id)`: Fetch processed data matching a raw job ID.

### Internal Implementation Notes
- **Cascading Deletes**: `ProcessedJob` points to `RawJob` via a foreign key constraint containing `ondelete="CASCADE"`. Deleting a raw job automatically purges processed results.
- **Session Commits**: Repository functions call `db.commit()` and `db.refresh(model)` directly, which requires calling routines to handle session lifetimes.

---

## 3. Job Board Providers (`backend/providers/`)
### Purpose
Adapts custom scrapers and API integrations to output normalized Pydantic job models.

### Responsibilities
- Read criteria variables from the central YAML config.
- Fetch raw inputs from providers.
- Hash details and format normalized data objects.

### Dependencies
- `scrapers` (execution utilities)
- `pydantic` (metadata structure validation)
- `utils.hashing` (fingerprint generation)
- `httpx` (JSON endpoints communication)

### Public APIs
- **`providers.base.BaseProvider`**: Abstract interface specifying:
  - `fetch_jobs() -> list[RawJobData]`
- **`providers.linkedin_provider.LinkedInProvider`**: Web search adapter for LinkedIn.
- **`providers.naukri_provider.NaukriProvider`**: Web search adapter for Naukri.
- **`providers.wellfound_provider.WellfoundProvider`**: Web search adapter for Wellfound.
- **`providers.remoteOK_provider.RemoteOKProvider`**: REST endpoint client adapter for RemoteOK.

---

## 4. Crawling & Parsing Algorithms (`backend/scrapers/`)
### Purpose
Contains standalone selenium browsers and parser components to extract site markup.

### Responsibilities
- Bypass crawler detection configurations.
- Parse DOM blocks to retrieve titles, companies, locations, and descriptions.
- Translate page structures to markdown text.

### Dependencies
- `selenium` & `undetected-chromedriver` (Naukri scraping browser)
- `linkedin-jobs-scraper` (Playwright automation library)
- `firecrawl` (Markdown extraction API client)
- `beautifulsoup4` (HTML parser)

### Internal Implementation Notes
- **Akamai/Cloudflare Bypass**: Naukri scraping requires `undetected-chromedriver` to pass automation checks, which requires a local Chrome browser.
- **Firecrawl**: Wellfound scraping fetches pages via Firecrawl markdown conversion, parsing structure text using regular expressions.

---

## 5. Background Processing Workers (`backend/workers/`)
### Purpose
Runs background processes to perform heavy AI parsing tasks asynchronously.

### Responsibilities
- Establish connections to Redis.
- Define worker queues.
- Synchronize database transaction states.

### Dependencies
- `redis` (broker interface)
- `rq` (task worker engine)
- `asyncio` (async task executor)

### Public APIs
- **`workers.queue.ai_processing_queue`**: Target queue instance.
- **`workers.ai_worker.process_raw_job(raw_job_id)`**: Task entrypoint for the RQ worker.

### Internal Implementation Notes
- **Context Isolation**: Since RQ executes tasks in synchronous processes, `process_raw_job` runs the asynchronous pipeline using `asyncio.run()`, creating standalone database sessions on each job run.

---

## 6. Authentication Routes (`backend/routes/auth.py`)
### Purpose
FastAPI routers providing session management endpoints.

### Responsibilities
- Synchronize registration and logins with external Auth0 instances.
- Match mock tokens for local testing.
- Retrieve and edit profile preferences.

### Dependencies
- `fastapi`
- `httpx` (requests to Auth0 API domains)
- `database.repositories.user_repository`

### Public APIs
- `POST /api/auth/login` (Auth0 credentials login)
- `POST /api/auth/register` (New database connection user signup)
- `GET /api/auth/me` (Profile detail)
- `PUT /api/users/me` (Preferences profile updater)

---

## 7. Frontend Client APIs (`frontend/src/lib/api/`)
### Purpose
Types and coordinates HTTP requests from the React client to the REST backend.

### Responsibilities
- Provide mock structures for fast client rendering during development.
- Parse auth tokens into headers automatically.
- Format server response payloads.

### Dependencies
- `fetch` API
- Local storage variables

### Public APIs
- **`lib.api.client.apiCall()`**: Fetch wrapper providing headers, tokens, and errors formatting.
- **`lib.api.auth.authApi`**: Register and login calls.
- **`lib.api.user.userApi`**: Get and put user settings.
- **`lib.api.jobs.jobsApi`**: Fetch, save, and apply to job entries (mock-only).
- **`lib.api.resume.resumeApi`**: Document parsing (mock-only).
- **`lib.api.admin.adminApi`**: Stats and scheduler control (mock-only).
