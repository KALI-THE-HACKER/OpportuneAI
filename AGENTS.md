# Coding Agent Instructions

This document acts as an instruction guide and rulebook for AI coding agents working on the OpportuneAI codebase.

---

## 1. Project Overview & Architecture Summary

OpportuneAI is an AI-powered job discovery and application tracking copilot. It aggregates listings from LinkedIn, Naukri, Wellfound, and RemoteOK, enriches data using Gemini LLMs, scores suitability, and exposes a React frontend (built on TanStack Start) for job search and tracking.

### Architecture Pillars
- **Ingestion Pipeline**: Scrapers fetch postings, compute content hashes, check for duplicates, and save unique entries to `raw_jobs` as `pending`.
- **Background Worker**: Insertions trigger a Redis Queue (RQ) worker task named `ai-processing`. Workers extract metadata using Gemini models and store it in `processed_jobs`.
- **API Service**: FastAPI app running stateless JWT check validation via Auth0 JWKS caching, syncing local user profiles.
- **Frontend App**: Multi-page React 19 client app built on TanStack Start with Vite/Nitro, prefetching layout details and storing state with React Query.

---

## 2. Codebase Conventions

### 2.1 Folder Structure
- `backend/`: All backend logic.
  - `ai/`: Providers interfaces, prompts, schemas, Gemini client pools.
  - `database/`: SQLAlchemy ORM schemas and transactional repository classes.
  - `ingestion/`: Ingestion orchestrator coordination.
  - `providers/`: Adapter classes normalizing scraper payloads.
  - `scrapers/`: Individual web crawling algorithms and Selenium setups.
  - `workers/`: Background Redis RQ workers and enqueueing helpers.
- `frontend/`: React web app client.
  - `src/routes/`: Route pages mapping directory hierarchies (TanStack Start).
  - `src/components/`: UI components (shadcn/ui + Radix primitives).
  - `src/lib/api/`: Typed API client adapters.

### 2.2 Coding Styles
- **Backend (Python)**:
  - Format/Lint: Target Python 3.11+. Use Ruff for formatting and lint checks.
  - Typing: Use Python type annotations. Use Union types (`str | None`) instead of `Optional[str]`.
  - SQLAlchemy: Use modern declarative styles (`Mapped[type] = mapped_column(...)`) and `select()` constructions.
  - Async: Prefer async database sessions (`AsyncSession` from SQLAlchemy) and HTTP clients (`AsyncClient` from `httpx`).
- **Frontend (TypeScript)**:
  - Route declarations: File-based routing (TanStack Router). Run code generator to recompile paths.
  - Styling: Vanilla CSS with Tailwind CSS v4 variables.
  - State: React Query (`useQuery`, `useMutation`) for server responses.

---

## 3. Operations & Tooling Commands

Execute all command actions from the `backend/` directory with an active virtual environment:

### Run Dev Backend
```bash
# Start FastAPI App
uvicorn app:app --reload

# Start RQ Background Worker
rq worker ai-processing
```

### Database Migrations
```bash
# Apply pending migrations
alembic upgrade head

# Generate a new migration revision automatically
alembic revision --autogenerate -m "migration description"

# Rollback last migration
alembic downgrade -1
```

### Testing
```bash
# Run complete test suite
pytest

# Run tests and suppress warnings
pytest -p no:warnings

# Run a specific test suite
pytest tests/ai/test_gemini.py
```

### Formatting & Linting
```bash
# Reformat python files
ruff format

# Lint check files
ruff check

# Fix auto-fixable lint issues
ruff check --fix
```

---

## 4. Key Architectural Invariants

- **Deduplication Hash**: Raw job fingerprinting computes hashes using SHA-256 over: `title|company|date_posted|location` (truncated to 16 characters). Never modify this signature format.
- **Relational Integrity**: `ProcessedJob` maps 1:1 with `RawJob` via `raw_job_id` containing a unique foreign key constraint and `ondelete="CASCADE"`.
- **JWT Guards**: Backend route handlers matching `/api/*` (except login/register endpoints) must require verification check headers (`Authorization: Bearer <jwt>`) parsed by the `get_current_user` dependency.
- **Mock Mode**: Setting `AUTH0_CLIENT_ID=mock_client_id` activates mock auth routines. Tokens prefixed with `mock-` bypass server verifications.

---

## 5. Development Rulebook

### 5.1 Implementing New Features
1. Modify database mappers first. Update tables, run migrations, and commit changes.
2. Build CRUD logic inside separate repositories.
3. Expose API controllers using FastAPI routers.
4. Replace frontend API client mock structures with real `apiCall` execution.
5. Create frontend view components loading state variables from React Query hook calls.

### 5.2 Modifying Databases & Migrations
- Never manually edit migration files after they have been committed or applied. Generate a new revision.
- Ensure that `ALEMBIC_DATABASE_URL` (sync connection URL) is properly configured in settings alongside `DATABASE_URL` (async connection URL).
- Add cascading deletes (`ondelete="CASCADE"`) to foreign keys when mapping parent-child relations to prevent orphan rows.

### 5.3 Modifying APIs
- Maintain request/response body schemas utilizing Pydantic models.
- Standardize REST response conventions. Paginated lists should return `Paginated[T]` models containing `items`, `total`, `page`, and `pageSize`.
- Document new endpoints inside `docs/api.md` before coding.

### 5.4 Refactoring
- Keep code coverage high. When updating core abstractions (like AI providers or repository mappers), run `pytest` to confirm backward compatibility.
- Retain docstrings and comment explanations.

---

## 6. Definition of Done

A task is considered complete ONLY when:
1. All Python imports are sorted, code is formatted, and lint verification checks pass (`ruff check` and `ruff format` output zero errors).
2. Existing tests pass and new features have unit tests.
3. Database migrations (if schemas changed) are generated and successfully applied (`alembic upgrade head`).
4. Documentation is updated to reflect new states.

Whenever you complete a meaningful feature, update docs/context.md and docs/current_state.md before considering the task complete.
