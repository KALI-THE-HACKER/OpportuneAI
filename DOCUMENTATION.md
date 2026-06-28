# OpportuneAI Technical Documentation

OpportuneAI is an AI-powered job discovery and application copilot. This document details the system architecture, ingestion pipeline, data models, AI extraction services, and backend technologies implemented in the project.

---

### Flow Sequence
1. **Scraping**: The [IngestionPipeline](backend/ingestion/pipeline.py) runs scrapers for active providers.
2. **Deduplication**: Content hashes are computed using job metadata (title, company, date, location). Existing hashes in PostgreSQL are compared; new listings are saved as `pending` raw jobs.
3. **Queueing**: For each saved raw job, a background task is pushed to a Redis Queue (RQ) named `ai-processing`.
4. **AI Processing**: An [ai_worker](backend/workers/ai_worker.py) picks up the job ID, transitions status to `processing`, and calls the [JobExtractor](backend/ai/extraction/extractor.py).
5. **Extraction**: The extractor builds prompt messages and calls a thread-safe LLM client pool (Gemini or OpenRouter), returning structured details (skills, salary, experience, employment type) conforming to a Pydantic schema.
6. **Persistence**: Extracted data is saved as a [ProcessedJob](backend/database/models/processed_job.py) and the original raw job is updated to `processed` status.

---

## Component Reference

### 1. Job Ingestion & Providers

Each scraper is wrapped in a provider implementation implementing the [BaseProvider](backend/providers/base.py) abstract class. They read job criteria from the central YAML configuration [config.yml](backend/config/config.yml).

- **LinkedIn Provider** ([linkedin_provider.py](backend/providers/linkedin_provider.py)):
  - Utilizes [linkedin_scraper.py](backend/scrapers/linkedin_scraper.py) wrapping the `linkedin-jobs-scraper` library.
  - Headless browser automation query filtering for software jobs.
  - Normalizes external job ID and computes hashes.
- **Naukri Provider** ([naukri_provider.py](backend/providers/naukri_provider.py)):
  - Utilizes [naukri_scraper.py](backend/scrapers/naukri_scraper.py) which implements `undetected-chromedriver` to bypass bot protection systems (Akamai/Cloudflare).
  - Uses BeautifulSoup to parse rendered DOM elements from list tuples. Supports parsing local HTML dumps for debug and offline testing.
- **Wellfound Provider** ([wellfound_provider.py](backend/providers/wellfound_provider.py)):
  - Utilizes [wellfound_scraper.py](backend/scrapers/wellfound_scraper.py) connected to the **Firecrawl V1 API**.
  - Fetches the search page in markdown format and applies regex parsing to isolate salary, equity, remote work eligibility, experience, and job description links.
- **RemoteOK Provider** ([remoteOK_provider.py](backend/providers/remoteOK_provider.py)):
  - Communicates directly with RemoteOK's JSON API endpoint using `httpx`.
  - Performs keyword matching across positions and tags to isolate relevant roles.

### 2. Relational Database Engine

The database is built on **PostgreSQL** with async drivers.

- **Session Config** ([session.py](backend/database/session.py)): Establishes connection engine pools via SQLAlchemy 2.0 async engine (`create_async_engine`).
- **Raw Jobs Model** ([raw_job.py](backend/database/models/raw_job.py)):
  - `id`: Primary key.
  - `source`: Source platform (e.g. `linkedin`, `naukri`, `wellfound`, `remoteok`).
  - `external_id`: Unique identifier assigned by the provider.
  - `title`, `company`, `location`, `link`, `date_posted`.
  - `content_hash`: SHA-256 fingerprint.
  - `raw_payload`: JSON dump of raw description or scraped structure.
  - `processing_status`: State transition value (`pending`, `processing`, `processed`, `failed`).
- **Processed Jobs Model** ([processed_job.py](backend/database/models/processed_job.py)):
  - Holds structured details extracted via AI: `job_title`, `company`, `skills` (JSON array), `location`, `salary`, `experience_years`, `employment_type`, and `job_description`.
  - Linked to `RawJob` via a foreign key relation.
- **Repositories**: Encapsulate DB operations for raw jobs ([raw_job_repository.py](backend/database/repositories/raw_job_repository.py)) and processed jobs ([processed_job_repository.py](backend/database/repositories/processed_job_repository.py)).

### 3. Background Task Queue

- **Redis Integration** ([queue.py](backend/workers/queue.py)): Initializes a Redis connection to setup a Python RQ Queue named `ai-processing`.
- **AI Worker Orchestrator** ([ai_worker.py](backend/workers/ai_worker.py)):
  - Defines the task entry points.
  - Async runner `_process_raw_job` runs inside `asyncio.run` mapping a session wrapper.
  - Updates DB states and triggers rollback on exceptions to mark failed extraction.

### 4. AI Structured Extraction Engine

Designed to extract standardized metrics from unformatted job postings.

- **LLM Providers Base** ([base.py](backend/ai/providers/base.py)): Interface definition requiring `invoke()` with a target Pydantic schema structure.
- **Gemini Client Pool** ([gemini_pool.py](backend/ai/pools/gemini_pool.py)):
  - A thread-safe API key pool manager.
  - Cycles through a list of Google Gemini API keys configured in `GEMINI_API_KEYS` environment variable.
  - Tracks request numbers, failures, and supports API rate limit distribution.
- **Gemini Provider** ([gemini.py](backend/ai/providers/gemini.py)): Integrates `ChatGoogleGenerativeAI` and instructs model calls to use Pydantic validation via `.with_structured_output(JobExtraction)`.
- **OpenRouter Provider** ([openrouter.py](backend/ai/providers/openrouter.py)): Integrates alternative routes through `ChatOpenRouter` with free and paid open-source/commercial models.
- **LLM Factory** ([factory.py](backend/ai/providers/factory.py)): Resolves LLM client based on configuration.
- **Extraction Prompts** ([prompts.py](backend/ai/extraction/prompts.py)): Expert job posting parser templates restricting hallucinations.
- **Output Schema** ([schemas.py](backend/ai/schemas.py)): Defines the validation structure of [JobExtraction](backend/ai/schemas.py#L5-L14).

---

## Tech Stack Summary

| Technology | Purpose | Components |
| :--- | :--- | :--- |
| **Python 3.11** | Backend Runtime Language | Entire Backend service |
| **FastAPI / Uvicorn** | REST API & Routing | [app.py](backend/app.py) |
| **PostgreSQL** | Primary Relational Database | Raw & Processed Jobs Tables |
| **SQLAlchemy 2.0** | Object-Relational Mapping (Async) | [session.py](backend/database/session.py) |
| **Alembic** | Database Schema Migrations | [migrations/](backend/migrations/) |
| **Redis** | In-Memory task state storage | Job broker for queueing |
| **Python RQ** | Background Task Queueing | [queue.py](backend/workers/queue.py) |
| **LangChain** | LLM Integration & Orchestration | Prompt mapping and model bindings |
| **Google Gemini API** | Primary AI Extraction Model | Metadata Extraction Engine |
| **Firecrawl API** | Web Scraping (Markdown render) | Wellfound scraper parser |
| **Selenium / Chrome** | Browser Scraping | Naukri crawler automation |
| **Ruff** | Code Linting and Formatting | Styles and conventions check |
| **pytest & AnyIO** | Unit / Integration Test Suites | tests directory |
