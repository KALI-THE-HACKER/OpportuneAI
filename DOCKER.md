# Production Docker Architecture & Deployment Guide

This guide documents the Dockerization of OpportuneAI, including multi-stage container builds, network isolation, service orchestration, and security invariants.

---

## Architecture Overview

```
                          Internet / Host
                                │
                                ▼ (Port 80)
                     ┌─────────────────────┐
                     │    Nginx Ingress    │  (ONLY exposed port)
                     └──────────┬──────────┘
                                │
            ┌───────────────────┴───────────────────┐
            │ internal bridge: opportune_net        │
            ▼                                       ▼
 ┌─────────────────────┐                 ┌─────────────────────┐
 │    Frontend SSR     │                 │     FastAPI API     │
 │    (Node 20 Alpine) │                 │    (Python 3.11)    │
 │    port 3000        │                 │      port 8000      │
 └─────────────────────┘                 └──────────┬──────────┘
                                                    │
                                                    ▼
 ┌─────────────────────┐                 ┌─────────────────────┐
 │  RQ Workers (AI &   │                 │     Redis Cache     │
 │  Resume Processing) │────────────────▶│     (Port 6379)     │
 └─────────────────────┘                 └─────────────────────┘
```

### Key Production Invariants

1. **Strict Port Isolation**:
   - **Only Nginx** publishes a port to the external host (`PORT=80` by default).
   - FastAPI Backend (`8000`), Node Frontend (`3000`), and Redis (`6379`) do **not** publish any ports to the host. They communicate strictly over the internal Docker bridge network (`opportune_net`).
2. **Zero Secret Leakage**:
   - Docker build stages do not bake in secrets.
   - `.dockerignore` files prevent local `.env`, `certs/`, and `venv/` from entering image layers.
   - Secrets and environment variables are injected via `docker-compose.yml` (`env_file`) or orchestrator secrets.
3. **Multi-Stage Builds**:
   - **Backend**: Builder stage compiles native C/PostgreSQL extensions and wheels; runtime stage contains only minimal runtime libraries (`libpq5`, `chromium`, `chromium-driver`) and runs under an unprivileged user (`opportune:opportune`).
   - **Frontend**: Dependencies stage caches `node_modules`; builder runs `NITRO_PRESET=node-server npm run build`; runner stage copies only `.output/` onto lean `node:20-alpine` under non-root user `opportune`.
4. **Resilience & Health Checks**:
   - Nginx waits for frontend and backend health checks before routing.
   - Backend health check: `curl -f http://localhost:8000/health || exit 1`.
   - Redis health check: `redis-cli ping`.
   - Redis persistence enabled with `--appendonly yes`.

---

## Quick Start (Docker Compose)

### 1. Configure Environment Files

Ensure your backend `.env` exists:
```bash
cp backend/.env.example backend/.env
# Update DATABASE_URL, GEMINI_API_KEYS, etc.
```

(Optional) Create `.env` in the root directory:
```bash
cp .env.docker.example .env
```

### 2. Build and Start the Stack

```bash
# Build images and start in background
docker compose up -d --build
```

### 3. Check Service Status

```bash
docker compose ps
```

### 4. View Container Logs

```bash
# All logs
docker compose logs -f

# Specific services
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f rq-worker-ai
docker compose logs -f rq-worker-resume
```

### 5. Run Database Migrations

```bash
docker compose exec backend alembic upgrade head
```

### 6. Stop the Stack

```bash
docker compose down
```

---

## Service Catalog

| Service | Image / Base | Internal Port | Description |
| :--- | :--- | :--- | :--- |
| **`nginx`** | `nginx:1.27-alpine` | `80` (mapped to host) | Reverse proxy, static asset compression, security headers. |
| **`frontend`** | `node:20-alpine` (multi-stage) | `3000` | TanStack Start / React 19 SSR runtime. |
| **`backend`** | `python:3.11-slim` (multi-stage) | `8000` | FastAPI application serving `/api/*` and `/health`. |
| **`rq-worker-ai`** | `python:3.11-slim` (backend image) | None | Consumes `ai-processing` Redis queue for Gemini extraction. |
| **`rq-worker-resume`** | `python:3.11-slim` (backend image) | None | Consumes `resume-processing` Redis queue for PDF parsing. |
| **`redis`** | `redis:7.4-alpine` | `6379` | In-memory queue broker and feed cache with AOF persistence. |
