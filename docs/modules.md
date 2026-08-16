# Module Documentation

This document explains the purpose, responsibilities, dependencies, public APIs, and internal implementation details of every major module in OpportuneAI.

---

## 1. AI Extraction Layer (`backend/ai/`)
### Purpose
Processes raw text from job descriptions and resumes to extract structured, standardized metadata using large language models.

### Responsibilities
- Define target validation structure for parsed metadata (`JobExtraction`, `ResumeExtraction`).
- Cycle API keys across requests to balance free tier rate limits.
- Render system/human prompting templates to format the job and resume descriptions.
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
- **Strict Parsing**: Prompt templates instruct the model to avoid guessing or hallucinating properties not explicitly stated in descriptions.

---

## 2. Database & Data Access Layer (`backend/database/`)
### Purpose
Handles asynchronous connection pool management, maps relational schemas, and isolates database operations.

### Responsibilities
- Create asynchronous SQLAlchemy engines and local session makers.
- Map ORM definitions for users, raw scraping data, structured extraction tables, and resume metadata.
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
  - `get_by_content_hash(hash)`: Check if job content was previously scraped.
  - `create(job)`: Write raw scrape payloads.
  - `get_pending_jobs()`: Retrieve queued records.
- **`database.repositories.processed_job_repository.ProcessedJobRepository(db)`**:
  - `create(...)`: Commit structured LLM extraction outputs.

---

## 3. Scraping Ingestion Engine (`backend/scrapers/`, `backend/providers/`)
### Purpose
Orchestrates web crawling across LinkedIn, Naukri, Wellfound, and RemoteOK.

### Responsibilities
- Fetch postings according to search filters in `config.yml`.
- Normalize provider schemas into standardized `ScrapedJob` objects.
- Compute content hashes to eliminate duplicate entries before saving.

### Dependencies
- `selenium` / `linkedin-jobs-scraper`
- `undetected-chromedriver` / `beautifulsoup4`
- `playwright` / `firecrawl-py`
- `httpx` (RemoteOK REST API client)

### Public APIs
- **`providers.base.BaseProvider`**: Abstract interface defining `fetch_jobs()`.
- **`ingestion.pipeline.IngestionPipeline`**:
  - `run()`: Executes crawling sequence across all active providers.

---

## 4. Resume Storage & Processing (`backend/storage/`, `backend/routes/resume.py`)
### Purpose
Handles private document archival, in-memory PDF extraction, and asynchronous resume parsing.

### Responsibilities
- Upload PDF documents to private Cloudflare R2 bucket.
- Extract raw text in-memory via `pypdf`.
- Enqueue resume parsing jobs to Redis RQ.
- Generate secure pre-signed download URLs.

### Dependencies
- `boto3` (Cloudflare R2 S3 adapter)
- `pypdf` (In-memory PDF text extraction)

### Public APIs
- **`storage.r2.R2Client`**: `upload_file()`, `get_download_url()`, `delete_file()`.
- **`routes.resume`**: `POST /api/resume/upload`, `GET /api/resume`, `DELETE /api/resume`, `GET /api/resume/download-url`.

---

## 5. Background Processing Workers (`backend/workers/`)
### Purpose
Runs background processes to perform heavy AI parsing tasks asynchronously.

### Responsibilities
- Establish connections to Redis.
- Define worker queues (`ai-processing`, `resume-processing`).
- Synchronize database transaction states.

### Dependencies
- `redis` (broker interface)
- `rq` (task worker engine)
- `asyncio` (async task executor)

### Public APIs
- **`workers.queue.ai_processing_queue`**: Target queue for raw job processing.
- **`workers.queue.resume_processing_queue`**: Target queue for resume parsing.
- **`workers.ai_worker.process_raw_job(raw_job_id)`**: Entrypoint for job metadata extraction.
- **`workers.resume_worker.process_resume_job(user_id)`**: Entrypoint for resume skill parsing.

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
- **`lib.api.user.userApi`**: Get and update user profile settings (`userApi.get`, `userApi.update`).
- **`lib.api.jobs.jobsApi`**: Fetch, save, and apply to job entries.
- **`lib.api.resume.resumeApi`**: Document parsing and download URL requests.
- **`lib.api.admin.adminApi`**: Telemetry and stats.

---

## 8. Frontend Shell, Theming & UI (`frontend/src/components/`, `frontend/src/styles.css`)
### Purpose
Provides the design system, persistent navigation shell, theme state management, and profile combobox autocomplete components.

### Responsibilities
- Manage OKLCH semantic color tokens for light (porcelain) and dark (OLED obsidian) palettes.
- Deliver wave shimmer skeleton loaders (`skeleton-shimmer`).
- Maintain a sticky full-height sidebar (`sticky top-0 h-screen`) with independent main content scrolling.
- Eliminate FOUC on page reloads with blocking `<head>` script.
- Provide standardized combobox search for job titles, locations, roles, and system skill catalogs.
