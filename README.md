# OpportuneAI

<p align="center">
  <img src="https://img.shields.io/badge/status-under%20development-orange?style=flat-square" alt="Status: Under Development" />
</p>



OpportuneAI is an AI-powered job discovery and application copilot. It aggregates opportunities from multiple job platforms, processes and enriches job data, matches roles against a candidate's profile, and helps users identify the most relevant opportunities.

The project features a scalable job ingestion pipeline, raw-data deduplication, a Redis Queue background worker, and an AI-driven metadata extraction engine.

---

## Architecture Overview

OpportuneAI operates a multi-stage background data processing pipeline designed to aggregate opportunities from multiple job platforms, normalize descriptions, structure metadata using LLMs, and prevent duplicates.

```mermaid
graph TD
    subgraph Job_Ingestion ["Job Ingestion (Scrapers & Providers)"]
        A1[LinkedIn Scraper] -->|Raw HTML/DOM| P1[LinkedInProvider]
        A2[Naukri Scraper] -->|Rendered DOM| P2[NaukriProvider]
        A3[Wellfound Scraper] -->|Firecrawl MD| P3[WellfoundProvider]
        A4[RemoteOK API] -->|JSON Payload| P4[RemoteOKProvider]
    end

    subgraph Data_Pipeline ["Data Pipeline"]
        P1 & P2 & P3 & P4 -->|Raw Job Data| B[IngestionPipeline]
        B -->|Hash Deduplication| C{New Job?}
        C -->|Yes| D[(PostgreSQL Raw Jobs)]
        C -->|No| E[Discard]
    end

    subgraph Background_Processing ["Background Processing"]
        D -->|Enqueue Job ID| F[RQ Task Queue]
        F -->|Trigger Tasks| G[AI Worker]
        G -->|Fetch Raw Job| D
    end

    subgraph AI_Extraction ["AI Extraction"]
        G -->|Extract metadata| H[JobExtractor]
        H -->|Structured Schema| I[LLM Client Pool]
        I -->|Gemini/OpenRouter Response| H
        H -->|Save Processed Data| J[(PostgreSQL Processed Jobs)]
    end
```

---

## Repository Structure

The project code is organized inside the `backend` directory.

```
OpportuneAI/
├── backend/
│   ├── ai/                      # AI Extraction layer
│   │   ├── extraction/          # Extraction prompts and extractor logic
│   │   ├── pools/               # Gemini client api key pool
│   │   ├── providers/           # LangChain LLM wrappers (Gemini, OpenRouter)
│   │   └── schemas.py           # Structured Pydantic extraction models
│   ├── config/                  # Configuration loaders and YAML configs
│   │   ├── config.yml           # Search criteria configuration (jobs, location, limits)
│   │   └── settings.py          # Pydantic Settings configuration loading from env
│   ├── database/                # Database connection & models
│   │   ├── models/              # Raw & Processed job schemas
│   │   ├── repositories/        # Database CRUD encapsulation classes
│   │   └── session.py           # Async engine and session creation
│   ├── ingestion/               # Pipeline execution
│   │   └── pipeline.py          # Orchestrates scrapers, deduplication, and queue tasks
│   ├── migrations/              # Alembic database migrations
│   ├── providers/               # Provider connectors
│   │   ├── base.py              # Base class definition
│   │   ├── linkedin_provider.py # LinkedIn adapter
│   │   ├── naukri_provider.py   # Naukri adapter
│   │   ├── remoteOK_provider.py # RemoteOK adapter
│   │   └── wellfound_provider.py# Wellfound adapter
│   ├── scrapers/                # Web crawling algorithms
│   │   ├── linkedin_scraper.py  # Headless browser crawler for LinkedIn
│   │   ├── naukri_scraper.py    # undetected-chromedriver crawler for Naukri
│   │   └── wellfound_scraper.py # Firecrawl markdown web scraping for Wellfound
│   ├── utils/                   # General hashing & formatting utilities
│   ├── workers/                 # Background workers
│   │   ├── ai_worker.py         # AI extraction task handler
│   │   └── queue.py             # Redis task queue (RQ) definitions
│   ├── app.py                   # FastAPI application entrypoint
│   ├── pytest.ini               # Testing configurations
│   ├── requirements.txt         # Core dependencies
│   └── tests/                   # Test suite directory
├── DOCUMENTATION.md             # In-depth technical architecture details
├── CLAUDE.md                    # Developer quick-start, test, and style commands
└── GEMINI.md                    # Details on Gemini key pooling and configuration
```

---

## Tech Stack

- **Core**: Python 3.11, FastAPI, Uvicorn
- **Database & ORM**: PostgreSQL, SQLAlchemy 2.0 (async), Alembic
- **Task Queue**: Redis, Python RQ (Redis Queue)
- **AI Framework**: LangChain, Google Gemini API, OpenRouter
- **Scraping Utilities**: Firecrawl V1 API, Selenium (`undetected-chromedriver`), Playwright (`linkedin-jobs-scraper`), BeautifulSoup4

---

## Getting Started

### 1. Prerequisites
Ensure you have the following installed:
- Python 3.11+
- PostgreSQL
- Redis
- Chrome Browser (required for undetected-chromedriver crawler)

### 2. Installation
Clone the repository and navigate to the project directory:
```bash
git clone <repo-url>
cd OpportuneAI
```

Create and activate a virtual environment:
```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
```

Install the dependencies:
```bash
cd backend
pip install -r requirements.txt
```

### 3. Environment Configuration
Copy the `.env.example` file and fill in your keys:
```bash
cp .env.example .env
```
Key configuration items:
- `FIRECRAWL_API_KEY`: API key for Firecrawl Markdown extraction.
- `DATABASE_URL`: Connection string for SQLAlchemy (e.g. `postgresql+asyncpg://user:pass@localhost:5432/opportune`).
- `ALEMBIC_DATABASE_URL`: Sync connection string for Alembic migrations (e.g. `postgresql://user:pass@localhost:5432/opportune`).
- `GEMINI_API_KEYS`: A list of API keys for Google Gemini (e.g. `["key1", "key2"]`).
- `REDIS_HOST` / `REDIS_PORT`: Redis broker parameters.

### 4. Running Migrations
Apply alembic database schemas:
```bash
alembic upgrade head
```

### 5. Running the API Server
Start the FastAPI development server:
```bash
uvicorn app:app --reload
```
The API documentation will be available at `http://localhost:8000/docs`.

### 6. Starting Background Workers
To process ingested jobs using the background AI pipeline, start the RQ worker:
```bash
rq worker ai-processing
```

### 7. Run Tests
Verify configuration and functionality:
```bash
pytest
```

---

## Core Documentation

For detailed information regarding architecture, scrapers, database structures, and models, please refer to:
- [DOCUMENTATION.md](DOCUMENTATION.md) — System Architecture, Ingestion Flow, Database Models.
- [CLAUDE.md](CLAUDE.md) — Style guide, build commands, and developer routines.
- [GEMINI.md](GEMINI.md) — Gemini client API key pooling and LLM extraction logic details.