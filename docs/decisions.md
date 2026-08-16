# Architectural Decisions

This document details the key architectural decisions, rationales, and tradeoffs made in OpportuneAI.

---

## 1. Primary Database: PostgreSQL & SQLAlchemy 2.0 Async
### Decision
Use PostgreSQL as the primary transactional database, with SQLAlchemy 2.0 as the Object-Relational Mapper (ORM) using the `asyncpg` asynchronous driver.

### Reason
- **Structured Schema Requirements**: Jobs and user data require strict relations, structured metadata, arrays, and JSON payloads (e.g. lists of skills). PostgreSQL natively supports relational tables, indexes, and optimized JSON/JSONB operations.
- **Concurrency**: Asynchronous I/O is critical for handling high throughput scraping ingestion and simultaneous API requests. Using the `asyncpg` driver with SQLAlchemy `AsyncSession` prevents database transactions from blocking FastAPI's event loop.
- **Type Safety**: SQLAlchemy 2.0 offers type-safe declarative mappings (`Mapped[type]`) and select-construct queries, reducing query errors.

### Tradeoffs
- **Complexity**: Setting up async session managers, database engine pooling, and manual session commits/rollbacks in background workers increases code complexity compared to sync ORMs or simple document databases.
- **Schema Migrations**: Schema updates require Alembic migrations, which need to be generated and run in correct order.

---

## 2. Background Worker System: Redis & Python RQ
### Decision
Use Python RQ (Redis Queue) with a Redis broker as the background worker system for processing raw scraped jobs and parsing uploaded resumes.

### Reason
- **Simplicity**: Python RQ is lightweight, easy to understand, and integrates seamlessly with Redis. It avoids the large dependency stack and setup overhead of Celery.
- **Task Tracking**: Provides native worker inspection, job registries, failure tracking, and dashboard integration.
- **Worker Isolation**: Scraper parsing and AI extraction run in separate background processes, keeping the FastAPI web server responsive and safe from resource exhaustion or scraper failures.

### Tradeoffs
- **Python Only**: Python RQ is strictly for Python. If other microservices are introduced in different languages, they cannot easily consume or publish tasks using RQ.
- **No Native Workflows**: Complex task chains, chords, or groups are harder to implement in RQ than in Celery.

---

## 3. User Identity: Auth0 + Local PG Cache
### Decision
Delegate core identity management, password registration, credentials hashing, and session management to Auth0, while caching and extending user profiles in a local PostgreSQL `users` table.

### Reason
- **Security**: Storing raw credentials, resetting passwords, and validating emails are security-sensitive. Auth0 handles these securely and supports social login integrations out-of-the-box.
- **JWT Verification**: FastAPI can verify tokens stateless and fast by fetching the public JWKS (JSON Web Key Set) once and caching it.
- **Data Enrichment**: Storing custom profiles (skills, target salaries, preferred roles) directly in our PostgreSQL database allows fast join operations and match-score computations without making external calls to Auth0.

### Tradeoffs
- **Data Synchronization**: Auth0 profile changes (like email verification status or avatar updates) must be synchronized with our local database, requiring syncing routines at login/authentication.
- **Third-Party Dependency**: Outages or API changes on Auth0 directly affect user authentication.

---

## 4. AI Engine: LangChain + Google Gemini Client Key Pool
### Decision
Use Google Gemini 2.5 Flash as the primary model via LangChain, utilizing a custom `GeminiClientPool` that cycles through multiple API keys.

### Reason
- **Cost and Latency**: Gemini 2.5 Flash offers low latency and high throughput for structured text extraction tasks.
- **Structured Outputs**: Native support for Pydantic schema constraints (`.with_structured_output(JobExtraction)`) guarantees that extracted job details conform to database tables.
- **Key Cycling**: Free-tier Gemini keys have strict rate limits. Cycling keys via a thread-safe `GeminiClientPool` utilizing an `itertools.cycle` mechanism distributes the workload across multiple keys, increasing throughput without cost.

### Tradeoffs
- **Rate Limit State Management**: Key tracking and lock synchronization are required to handle rate-limiting cooldowns safely in multi-threaded RQ workers.
- **Vendor Lock-in**: LangChain helps, but model-specific formatting (system prompts, response schema interfaces) still binds us to Google Gemini APIs, though OpenRouter remains a fallback.

---

## 5. Web Framework: TanStack Start (React 19)
### Decision
Build the web application using React 19 and TanStack Start, which wraps TanStack Router and Nitro.

### Reason
- **Type Safety**: TanStack Router provides full type-safety for route paths, search parameters, layout loader states, and link targets.
- **Performance**: Integrated server-side rendering (SSR) capabilities and Nitro bundler allow lightning-fast initial page loads.
- **Tailwind CSS v4 Integration**: Leverages the latest utility styling engine with smaller bundles and native CSS variables support.

### Tradeoffs
- **Bleeding Edge**: React 19 and TanStack Start are relatively new frameworks. Docs and packages can occasionally undergo changes or require specific configurations.

---

## 6. Private Document Storage: Cloudflare R2 + In-Memory Text Extraction
### Decision
Store user resume PDF documents in private Cloudflare R2 object storage with S3-compatible APIs (`boto3`) and perform PDF text extraction directly in-memory using `pypdf` before background parsing.

### Reason
- **Zero Egress Fees**: Cloudflare R2 does not charge egress fees for object retrieval.
- **Security & Privacy**: Resumes contain sensitive PII. The bucket is strictly private; downloads are generated through short-lived pre-signed URLs (`GET /api/resume/download-url`).
- **Stateless Web Nodes**: In-memory text extraction avoids writing temporary files to server disk.

### Tradeoffs
- **Memory Footprint**: Multi-page PDFs reside in memory during upload text extraction (mitigated by a strict 5MB upload size limit).

---

## 7. Frontend Design System: OKLCH Semantic Tokens & Flash-Free Theme Architecture
### Decision
Implement a custom design token architecture utilizing OKLCH color spaces, semantic CSS variables, a directional shimmer skeleton system, and a blocking `<head>` theme script.

### Reason
- **Perceptual Uniformity**: OKLCH provides uniform lightness and chroma scaling, eliminating muddy color transitions in dark mode.
- **Porcelain & Obsidian Visual Tone**: Tailored warm porcelain light canvas (`oklch(0.985 0.003 95)`) and deep OLED obsidian dark canvas (`oklch(0.10 0.005 275)`).
- **Zero Flash on Reload (FOUC)**: A tiny inline script executed in `<head>` applies `.dark` before HTML painting occurs, completely eliminating light theme flash during SSR/hydration.
- **Fixed Shell Ergonomics**: Desktop navigation sidebar uses `sticky top-0 h-screen` with independent main content scrolling to prevent viewport jitter.

### Tradeoffs
- **Browser Compatibility**: OKLCH requires modern browser engines (supported in all evergreen browsers since 2023).
