# ==============================================================================
# Stage 1: Builder - Build dependencies and wheels in an isolated virtualenv
# ==============================================================================
FROM python:3.11-slim-bookworm AS builder

# Prevent interactive prompts and Python bytecode generation
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Install compiler toolchain and native database client libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    python3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install wheel and pip upgrades first
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install dependencies from requirements.txt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# ==============================================================================
# Stage 2: Production Runner - Minimal, secure runtime container
# ==============================================================================
FROM python:3.11-slim-bookworm AS runner

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=8000

WORKDIR /app

# Install runtime system dependencies:
# - libpq5 for PostgreSQL asyncpg/psycopg2 native client bindings
# - curl for Docker HEALTHCHECK
# - chromium & chromium-driver for headless Selenium scraping jobs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    ca-certificates \
    chromium \
    chromium-driver \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv

# Create an unprivileged system user and group for security
RUN groupadd --system --gid 10001 opportune && \
    useradd --system --uid 10001 --gid 10001 --create-home --home-dir /home/opportune opportune

# Copy application source code and adjust file ownership
COPY --chown=opportune:opportune . /app

# Ensure logs and storage directories exist and are writable
RUN mkdir -p /app/logs /app/scratch /app/storage && \
    chown -R opportune:opportune /app/logs /app/scratch /app/storage

# Switch to non-root user
USER opportune

# Expose FastAPI default application port
EXPOSE 8000

# Container healthcheck testing the FastAPI /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command starts Uvicorn production server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
