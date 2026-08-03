# Engineering Task Backlog

This document outlines the priority tasks required to complete OpportuneAI.

---

## 1. High Priority Tasks

### 1.1 Implement Job Search & Recommendations API Endpoints
- **Description**: Add FastAPI route controllers to serve paginated job lists, details, and matches.
- **Affected Modules**: 
  - `backend/routes/` (New routes e.g. `jobs.py`)
  - `backend/database/repositories/processed_job_repository.py` (Add pagination and filter query methods)
  - `backend/app.py` (Register routers)
- **Complexity**: Medium
- **Dependencies**: Database models (`ProcessedJob`), SQLAlchemy async mappers.

### 1.2 Connect Frontend API Client to Backend Endpoints
- **Description**: Replace mock delayed responses in the frontend API client layer with real fetch calls.
- **Affected Modules**:
  - `frontend/src/lib/api/jobs.ts`
  - `frontend/src/lib/api/user.ts`
  - `frontend/src/lib/api/admin.ts`
  - `frontend/src/lib/api/notifications.ts`
- **Complexity**: Medium
- **Dependencies**: High-priority backend API endpoints (1.1).

### 1.3 Add Scheduler for Ingestion Pipeline
- **Description**: Build an execution runner (using APScheduler or cron tasks) to trigger the job crawling and deduplication pipeline at scheduled intervals.
- **Affected Modules**:
  - `backend/scheduler.py` (New script)
  - `backend/ingestion/pipeline.py`
- **Complexity**: Low
- **Dependencies**: Ingestion pipeline configuration settings.

---

## 2. Medium Priority Tasks

### 2.1 Implement Job Save & Apply Database Tables and Routes
- **Description**: Add support for saving jobs and tracking application statuses.
- **Affected Modules**:
  - `backend/database/models/` (New tables: `saved_jobs` and `applications` linked to `users` and `processed_jobs`)
  - `backend/routes/` (Endpoints: `/api/saved` and `/api/applied`)
  - `frontend/src/lib/api/jobs.ts` (Connect save/apply calls)
- **Complexity**: Medium
- **Dependencies**: Database base engine, FastAPI routing rules.

### 2.2 Implement Resume PDF Upload & AI Processing
- **Description**: Integrate the resume parsing engine. Let users upload PDFs, extract text, run a Gemini prompt parser to structure skills and work history, and automatically update user profiles.
- **Affected Modules**:
  - `backend/resume/extractors/pdf.py` (Connect to AI extraction)
  - `backend/routes/` (New route `/api/resume/upload` and `/api/resume/parse`)
  - `frontend/src/routes/app.resume.tsx`
- **Complexity**: High
- **Dependencies**: `pdfplumber` or `pymupdf` library, Gemini model api client.

### 2.3 Match Score Recalculation Task
- **Description**: Run calculations in the background to refresh match scores whenever a user modifies their skills, target salary, or locations.
- **Affected Modules**:
  - `backend/workers/ai_worker.py` (Create matching task)
  - `backend/routes/auth.py` (Enqueue matching task when profile changes)
- **Complexity**: Medium
- **Dependencies**: RQ connection, Redis broker.

---

## 3. Low Priority Tasks

### 3.1 Setup Docker Dev Environment
- **Description**: Create containers for PostgreSQL, Redis, FastAPI, RQ Workers, and TanStack Start, coordinating them with docker-compose.
- **Affected Modules**:
  - `Dockerfile` (New backend and frontend Dockerfiles)
  - `docker-compose.yml` (New compose layout)
- **Complexity**: Medium
- **Dependencies**: Installed Docker system daemon.

### 3.2 Add Rate Limiting Middleware
- **Description**: Implement rate limiting on API endpoints to prevent scraper abuse and brute force attempts.
- **Affected Modules**:
  - `backend/app.py`
- **Complexity**: Low
- **Dependencies**: Redis cache storage.

### 3.3 CI/CD Integration & Automated Tests Coverage
- **Description**: Configure GitHub Actions to automatically run Ruff format checks, pytest test suites, and compile Vite builds on pull requests.
- **Affected Modules**:
  - `.github/workflows/` (New workflows configuration)
- **Complexity**: Low
- **Dependencies**: pytest tests structure.
