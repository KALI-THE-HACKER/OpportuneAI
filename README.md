# OpportuneAI

<p align="center">
  <strong>AI-Powered Autonomous Job Discovery & Application Copilot</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active%20development-emerald?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/python-3.11+-blue?style=flat-square&logo=python" alt="Python 3.11+" />
  <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/tanstack-start-ff4154?style=flat-square" alt="TanStack Start" />
  <img src="https://img.shields.io/badge/llm-gemini--2.5--flash-8e75ff?style=flat-square&logo=google" alt="Gemini 2.5 Flash" />
  <img src="https://img.shields.io/badge/cache-redis-dc382d?style=flat-square&logo=redis" alt="Redis" />
  <img src="https://img.shields.io/badge/docker-ready-2496ed?style=flat-square&logo=docker" alt="Docker Ready" />
  <img src="https://img.shields.io/badge/ansible-automated-ee0000?style=flat-square&logo=ansible" alt="Ansible Automated" />
</p>

---

OpportuneAI is an end-to-end AI-powered job discovery and application tracking platform. It crawls opportunities across major hiring platforms (LinkedIn, Naukri, Wellfound, RemoteOK), extracts structured metadata with Google Gemini LLMs, scores match suitability against user career profiles, and serves an intelligent, personalized feed through a React 19 / TanStack Start frontend.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    %% 1. Ingestion Phase
    subgraph S1 ["1. Job Crawling & Ingestion"]
        direction TB
        SCRAPERS["Multi-Platform Crawlers\n(LinkedIn, Naukri, Wellfound, RemoteOK)"]
        PIPE["Ingestion Pipeline"]
        DEDUP{"SHA-256 Hash\nDeduplication"}
        RAW[("PostgreSQL\nraw_jobs")]
        DISCARD["Discard Duplicate"]
        
        SCRAPERS --> PIPE --> DEDUP
        DEDUP -->|"New Listing"| RAW
        DEDUP -->|"Duplicate"| DISCARD
    end

    %% 2. Background Queue & AI Processing
    subgraph S2 ["2. Async Queue & AI Extraction"]
        direction TB
        RQ_AI["Redis Queue\nai-processing"]
        AI_WORKER["AI Background Worker"]
        GEMINI_POOL["Gemini Client Pool\n(Key Cycling & Cooldowns)"]
        GEMINI["Gemini 2.5 Flash LLM"]
        EMBED_GEN["Gemini Embeddings\n(models/gemini-embedding-001)"]
        PROCESSED[("PostgreSQL\nprocessed_jobs + pgvector")]
        APPLY_CHECK{"apply_url\nfound?"}
        CONTACT_AGENT["Contact Finder Agent\n(DuckDuckGo + Gemini + DNS MX)"]
        CONTACT_CACHE[("PostgreSQL\ncompany_contacts cache")]

        RAW --> RQ_AI --> AI_WORKER
        AI_WORKER --> GEMINI_POOL --> GEMINI
        GEMINI -->|"Structured Metadata\n+ apply_url"| PROCESSED
        AI_WORKER --> EMBED_GEN -->|"Vector(768)"| PROCESSED
        PROCESSED --> APPLY_CHECK
        APPLY_CHECK -->|"Yes"| PROCESSED
        APPLY_CHECK -->|"No"| CONTACT_AGENT
        CONTACT_AGENT --> CONTACT_CACHE
        CONTACT_CACHE -->|"contact_email + name + role"| PROCESSED
    end

    %% 3. Candidate Profile & Resume Engine
    subgraph S3 ["3. Candidate Profile & User Embeddings"]
        direction TB
        RESUME_IN["Resume PDF Upload"]
        R2_STORE[("Cloudflare R2\nPrivate Storage")]
        RESUME_WORKER["Resume AI Worker"]
        USER_PROFILE[("PostgreSQL\nusers profile + pgvector")]
        USER_EMBED["User Preference Vector\n(Profile + Resume Skills)"]

        RESUME_IN --> R2_STORE
        RESUME_IN --> RESUME_WORKER --> GEMINI_POOL
        RESUME_WORKER -->|"Extracted Skills"| USER_PROFILE
        USER_PROFILE --> USER_EMBED -->|"Vector(768)"| USER_PROFILE
    end

    %% 4. Hybrid Feed & Scoring Engine
    subgraph S4 ["4. Two-Stage Hybrid Recommendation Engine"]
        direction TB
        STAGE1["Stage 1: Semantic Candidate Retrieval\n(pgvector Cosine Distance, Top 200)"]
        STAGE2["Stage 2: Structured Reranking\n(ScoringEngine: Skills, Roles, Loc, Exp)"]
        HYBRID_SCORE["Hybrid Combiner\n(40% Semantic + 60% Structured)"]
        REDIS_CACHE[("Redis Feed Cache\nfeed:user:id (1h TTL)")]
        FEED_API["FastAPI Feed Router"]

        USER_PROFILE & PROCESSED --> STAGE1
        STAGE1 --> STAGE2 --> HYBRID_SCORE
        HYBRID_SCORE -->|"Ranked Job IDs"| REDIS_CACHE
        REDIS_CACHE -->|"Ordered Slice"| FEED_API
        FEED_API -->|"Single Batch Fetch"| PROCESSED
    end

    %% 5. User Interaction & Notifications
    subgraph S5 ["5. Client Application & Event Stream"]
        direction TB
        REACT_APP["TanStack Start + React 19 Client\n(Dashboard, Recommendations, Explorer)"]
        CTA{"apply_url\npresent?"}
        DIRECT["Apply Now\n(Direct External Link)"]
        OUTREACH["Email Recruiter / Founder\n(mailto: + Cold Outreach Draft)"]
        EVENTS["User Actions\n(Save, Apply, Profile Edit)"]
        NOTIFS[("PostgreSQL\nuser_activities")]

        FEED_API --> REACT_APP
        REACT_APP --> CTA
        CTA -->|"Yes"| DIRECT
        CTA -->|"No (contact found)"| OUTREACH
        REACT_APP --> EVENTS
        EVENTS -->|"Invalidate Feed"| REDIS_CACHE
        EVENTS -->|"Log Activity"| NOTIFS
        NOTIFS -->|"Live Updates"| REACT_APP
    end

    %% Flow connections between phases
    S1 -.-> S2
    S2 -.-> S4
    S3 -.-> S4
    S4 -.-> S5
```

---

## 🧠 Two-Stage Hybrid Job Recommendation Engine

The personalized recommendation system (`backend/ai/embeddings/`, `backend/services/scoring.py`, and `backend/services/feed_service.py`) combines dense vector semantic candidate retrieval with deterministic structured reranking.

```
Candidate Profile / Resume
           ↓
Canonical User Preference Text
           ↓
Google Gemini Embeddings (768-dim)
           ↓
[Stage 1] pgvector Cosine Distance Retrieval (Top 200 unexpired jobs)
           ↓
[Stage 2] Deterministic ScoringEngine Reranking (Skills, Roles, Loc, Mode, Exp)
           ↓
Hybrid Final Score = 0.40 × (Semantic × 100) + 0.60 × Structured Score
           ↓
Ranked Job IDs cached in Redis (feed:user:{id}, 1h TTL)
           ↓
1 Batch PostgreSQL Query (WHERE id IN (...)) for paginated page delivery
```

### 1. Stage 1 — Semantic Candidate Retrieval (pgvector)
- **Precomputed Job Embeddings**: During job ingestion (`ai_worker.py`), a canonical representation (Title, Company, Skills, Location, Work Mode, Employment Type, Experience, Description) is embedded once via Google Gemini (`models/gemini-embedding-001`, dim 768) and persisted in PostgreSQL `processed_jobs.embedding`.
- **Dynamic User Preference Vectors**: Generated from profile skills, resume-extracted skills, preferred roles, target locations, and seniority.
- **Database-Side Vector Search**: Computes cosine distance directly in PostgreSQL using pgvector `<=>` operator over unexpired listings:
  ```sql
  SELECT * FROM processed_jobs 
  WHERE embedding IS NOT NULL AND (last_date_to_apply IS NULL OR last_date_to_apply >= NOW())
  ORDER BY embedding <=> :user_embedding 
  LIMIT 200;
  ```

### 2. Stage 2 — Structured Reranking (`ScoringEngine`)
Candidates from Stage 1 are reranked against explicit user constraints across 5 dimensions:

| Dimension | Weight | Evaluation Method |
| :--- | :---: | :--- |
| **Technical Skills** | **35%** | Variable-length normalized intersection between candidate proficiencies and required job skills. |
| **Target Roles** | **30%** | Substring / token fuzzy matching between preferred roles and job title. |
| **Location & Work Mode** | **15%** | Remote match shortcut, physical city matching, or full match when "Willing to relocate" is enabled. |
| **Experience & Seniority** | **10%** | Experience level comparison (`entry`, `mid`, `senior`, `lead`) with numeric year tolerances. |
| **Employment Type** | **10%** | Match on contract/full-time/internship preferences. |

### 3. Hybrid Score Combination
Semantic relevance and explicit preference alignment are combined using centralized, configurable weights:

$$\text{Final Score} = 0.40 \times (\text{Cosine Similarity} \times 100) + 0.60 \times \text{Structured Score}$$

### 4. Cold-Start Fallback Ranking
For users without sufficient profile or resume data:
- System bypasses semantic candidate retrieval and falls back to deterministic quality scoring based on recency, salary transparency, and completeness.

### 5. Feed Caching & Invalidation (Redis + PostgreSQL)
1. **Redis Ranking Cache**: Ranked job ID arrays are cached under `feed:user:{user_id}` (1-hour TTL).
2. **Order-Preserving Batch Queries**: Pagination slices job IDs from Redis and retrieves full job records in **1 single batch query** (`WHERE id IN (...)`), re-sorted in-memory to preserve rank order. Zero N+1 queries.
3. **Event-Driven Invalidation**: Feed cache is cleared and preference vector refreshed on:
   - Profile preference edits (`PUT /api/users/me`).
   - Resume AI parse completion (`resume_worker.py`).
   - Resume deletion (`DELETE /api/resume`).
   - Significant interaction events (`save`, `unsave`, `apply`, `dismiss`, `not_interested`).

---

## ⚡ Key Features

- **Multi-Source Scraping**: Integrated scrapers for LinkedIn, Naukri, Wellfound (Firecrawl markdown), and RemoteOK.
- **SHA-256 Job Fingerprinting**: Prevents duplicate listings across multiple crawling runs using `title|company|date_posted|location` hashing.
- **Gemini Client Pool**: Thread-safe multi-API-key cycling with rate-limit tracking and automatic cooldown flags.
- **Two-Stage Hybrid Scoring Engine**: Combines 768-dim vector embeddings (`gemini-embedding-001`) with deterministic rules (skills, target roles, locations, experience, work modes).
- **Smart Location & Remote Matching**: Remote jobs instantly match remote preferences; optional "Willing to relocate" flag unlocks global opportunities.
- **Smart Apply Links**: Gemini LLM extracts direct application URLs (Greenhouse, Lever, Ashby, Workday, etc.) from job descriptions.
- **Autonomous Contact Finder Agent**: Discovers recruiter, founder, and HR contacts via DuckDuckGo and Gemini synthesis with DNS MX deliverability verification.
- **One-Click Cold Outreach & AI Pitch Generator**: Pre-composed `mailto:` links with one-click copy, plus an AI cold outreach generator tailored to the job description and user profile.
- **Real Application Tracking**: Comprehensive application lifecycle management (`/app/applied`) with status tags (Applied, Interviewing, Offer, Rejected) and automatic feed exclusion for applied listings.
- **Enterprise Admin Control Plane**: Centralized telemetry, live crawler logs (SSE), cancellation controls, secret/API-key encryption, and email alerting (Google Workspace, Zoho, SMTP).
- **Resume Intelligence**: Private Cloudflare R2 PDF document storage, in-memory text parsing (`pypdf`), and async LLM skill extraction.
- **Production Containerization & Automation**: Multi-stage Docker builds, isolated internal Docker network with Nginx ingress (only port 80 exposed), and automated Ansible playbooks for zero-downtime deployment.
- **Role-Based Access Control (RBAC)**: Fine-grained admin dashboard and metrics gated by JWT claims and email allowlists.
- **Modern UI / UX**: Built on TanStack Start, React 19, Tailwind CSS v4, custom OKLCH dark/light themes, and skeleton shimmer loaders.

---

## 📁 Repository Structure

```
OpportuneAI/
├── backend/
│   ├── ai/                      # Gemini LLM extractors, prompt templates & client pools
│   │   ├── agents/              # Autonomous AI agents (ContactFinderAgent)
│   │   ├── embeddings/          # Vector embedding service & canonical text builders
│   │   ├── extraction/          # Job & resume parsing prompts
│   │   ├── pools/               # Thread-safe multi-key Gemini pooling
│   │   └── schemas.py           # Pydantic extraction output schemas (JobExtraction, ContactInfo)
│   ├── config/                  # Configuration loaders, settings & YAML definitions
│   ├── database/                # SQLAlchemy models, async session & repositories
│   │   ├── models/              # User, RawJob, ProcessedJob, CompanyContact, UserActivity, UserJobEvent, JobApplication
│   │   ├── repositories/        # Database CRUD encapsulation classes
│   │   └── seed.py              # Realistic sample data seed generator
│   ├── ingestion/               # Scraping orchestrator & deduplication pipeline
│   ├── migrations/              # Alembic database migration revisions (incl. pgvector)
│   ├── providers/               # Platform adapter interfaces (LinkedIn, Naukri, Wellfound, RemoteOK)
│   ├── routes/                  # FastAPI routers (auth, feed, jobs, events, notifications, resume, admin, applications, outreach)
│   ├── services/                # Feed service, ScoringEngine, UserEmbeddingService, LogStreamService, EmailAlertService
│   ├── storage/                 # Cloudflare R2 S3-compatible client wrappers
│   ├── workers/                 # Background RQ worker consumers (ai_worker, resume_worker)
│   ├── Dockerfile               # Multi-stage Python 3.11 runner with unprivileged user & health check
│   └── tests/                   # Complete pytest suite (unit, integration, API, embeddings, agents)
├── frontend/
│   ├── src/
│   │   ├── components/          # UI primitives (JobCard, StatCard, SearchCombobox, Layouts)
│   │   ├── hooks/               # Auth, theme, and query management hooks
│   │   ├── lib/                 # Typed API client adapters & formatting utilities
│   │   ├── routes/              # TanStack Start file-based routing views
│   │   └── styles.css           # OKLCH design tokens & animations
│   └── Dockerfile               # Multi-stage Node 22-alpine SSR runner
├── docker/
│   └── nginx/                   # Ingress reverse proxy configuration (gzip, routing, security headers)
├── systemd/                     # Systemd service unit and auto-installer script
├── scripts/
│   └── deploy.sh                # Production zero-downtime manual CI/CD deployment script
├── ansible/                     # Production server provisioning and stack deployment playbooks
├── docker-compose.yml           # Unified orchestration for Nginx, frontend, backend, redis, and workers
├── DOCKER.md                    # In-depth container architecture & troubleshooting guide
├── docs/                        # Architecture memory and current system states
├── DOCUMENTATION.md             # In-depth technical architecture details
├── CLAUDE.md                    # Developer guidelines and commands
└── GEMINI.md                    # Gemini LLM pooling and prompt details
```

---

## 🛠️ Tech Stack

### Backend
- **Language & Framework**: Python 3.11+, FastAPI, Uvicorn
- **ORM & Database**: PostgreSQL 17, pgvector extension, SQLAlchemy 2.0 (asyncio + asyncpg), Alembic
- **Background Tasks**: Redis, Python RQ (Redis Queue)
- **AI & Embeddings**: Google Gemini (`gemini-2.5-flash`, `models/gemini-embedding-001`), LangChain, OpenRouter
- **Storage**: PostgreSQL + pgvector, Redis, Cloudflare R2 (`boto3`)
- **Scraping**: Firecrawl API, `undetected-chromedriver`, Selenium, BeautifulSoup4

### Frontend
- **Framework**: React 19, TanStack Start (Router + Nitro SSR)
- **State & Data**: TanStack Query (React Query)
- **Styling**: Tailwind CSS v4, Lucide Icons, OKLCH Color Tokens
- **Auth**: Auth0 React SPA SDK with PKCE & JWKS token verification

### DevOps & Infrastructure
- **Containerization**: Docker, Docker Compose (multi-stage builds, non-root users)
- **Reverse Proxy**: Nginx (gzip compression, single host port exposure, internal network isolation)
- **Provisioning**: Ansible (automated system setup, Docker installation, systemd daemonization, and migrations)

---

## 🚀 Getting Started

### 🐳 Option A: Production Docker Deployment (Recommended)

Run the complete multi-service stack with a single command:

1. **Configure environment variables**:
   ```bash
   cp .env.docker.example .env
   cp backend/.env.example backend/.env
   # Edit backend/.env with your Supabase DATABASE_URL, GEMINI_API_KEYS, etc.
   ```

2. **Launch with Docker Compose**:
   ```bash
   docker compose up -d --build
   ```

3. **Run database migrations inside the container**:
   ```bash
   docker compose exec backend alembic upgrade head
   ```

The application is now accessible via Nginx at `http://localhost` (or your configured `PORT`). Only Nginx is exposed to the host; the backend, Redis, and workers communicate over an isolated internal network.

See [DOCKER.md](file:///Users/luckyverma/Desktop/Development/OpportuneAI/DOCKER.md) for full architecture and operational commands.

---

### 🚀 Option B: 1-Click Manual CI/CD Deployment Script

If you run on a Self-hosted server/Linux server/VPS, deploy or update with zero downtime via the automated shell pipeline:

```bash
# Run the deployment pipeline
./scripts/deploy.sh
```

**What this script does:**
1. Stashes uncommitted local changes.
2. Pulls the latest commits from `main`.
3. Verifies Docker engine health.
4. Performs an in-place rolling update: `docker compose up -d --build --remove-orphans`.
5. Runs database migrations: `docker compose exec -T backend alembic upgrade head`.
6. Restarts and validates the `opportuneai.service` systemd unit (if installed).
7. Verifies HTTP health at `http://127.0.0.1/health`.
8. Logs all timestamped output to `~/deploy-opportuneai.log` (configurable via `$LOG_FILE`).

---

### 🛠️ Option C: Automated Ansible Deployment

Deploy and provision a remote Ubuntu/Debian server automatically:

```bash
# 1. Configure target server in inventory
cp ansible/inventory.ini.example ansible/inventory.ini

# 2. Run the deployment playbook
ansible-playbook -i ansible/inventory.ini ansible/playbook.yml
```

See [ansible/README.md](file:///Users/luckyverma/Desktop/Development/OpportuneAI/ansible/README.md) for full parameters and systemd unit management.

---

### 💻 Option D: Manual Local Development

#### 1. Prerequisites
- **Python 3.11+**
- **Node.js 22+** & **npm**
- **PostgreSQL 15+** with **pgvector**
- **Redis 7+**
- **Google Chrome** (for undetected-chromedriver crawler)

---

#### 2. Backend Setup

1. **Navigate to the backend directory and create a virtual environment**:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   *Fill in your PostgreSQL URL, Redis host, Google AI Studio keys (`GEMINI_API_KEYS`), and Auth0 credentials.*

4. **Run database migrations**:
   ```bash
   alembic upgrade head
   ```

5. **(Optional) Backfill embeddings for existing jobs**:
   ```bash
   python -m services.backfill_embeddings
   ```

6. **(Optional) Seed demo jobs**:
   ```bash
   python database/seed.py
   ```

7. **Start the FastAPI backend server**:
   ```bash
   uvicorn app:app --reload --port 8000
   ```

8. **Start background workers (in separate terminal tabs)**:
   ```bash
   # AI Job Processing Worker
   rq worker ai-processing

   # Resume Analysis Worker
   rq worker resume-processing
   ```

---

#### 3. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

---

## 🔗 Apply Link & Autonomous Contact Finder

Every job card resolves a direct application path using a three-tier priority chain:

```
1. apply_url extracted by Gemini LLM from job description
       (Greenhouse, Lever, Ashby, Workday, careers pages, Google Forms)
         ↓ if absent
2. apply_url read directly from scraper raw_payload
       (e.g. RemoteOK API returns apply_url natively)
         ↓ if absent
3. Autonomous Contact Finder Agent triggered:
   ├─ Search: DuckDuckGo HTML (zero cost, no API key)
   │    Query 1: site:linkedin.com/in "<Company>" AND ("recruiter" OR "founder" OR "HR")
   │    Query 2: "<Company>" email "@<domain>" (contact OR careers OR hiring)
   ├─ LLM Synthesis: Gemini extracts name, role, email or derives
   │    email from common patterns (firstname@domain, firstname.lastname@domain)
   ├─ DNS MX Validation: async socket check confirms domain accepts email
   └─ Cache: stored in company_contacts table — reused for all future jobs
              from the same company (zero repeat searches)
```

**Frontend CTA rendering:**

| Condition | UI |
|:---|:---|
| `applyUrl` available | **Apply now** — opens direct URL in new tab, records `apply` event |
| `contactEmail` found | **Email [Role]** — `mailto:` with pre-composed cold-outreach draft + contact card with one-click copy |
| Neither available | Tracked apply button (fires `POST /api/v1/events/jobs`) |

---

## 🧪 Testing & Code Quality

### Backend Tests & Linting
```bash
cd backend

# Run complete pytest test suite
pytest

# Run tests with clean output
pytest -p no:warnings

# Run a specific suite
pytest tests/ai/test_contact_finder.py  # Contact Finder Agent tests
pytest tests/test_apply_link.py         # Apply link extraction tests

# Run Ruff linter and formatter
ruff check .
ruff format . --check
```

### Frontend Typecheck & Build
```bash
cd frontend

# Build SSR and client bundles
npm run build
```

---

## 📄 License & Documentation

- [GEMINI.md](GEMINI.md) — Multi-API-Key Pooling & Structured Output Details
- [CLAUDE.md](CLAUDE.md) — Coding Standards & Development Guidelines
- [docs/context.md](docs/context.md) — Architectural Memory & System Invariants
- [docs/current_state.md](docs/current_state.md) — Feature implementation state & migration log