# CLAUDE.md — Developer Reference

This document summarizes typical build, test, run commands, and style/conventions for OpportuneAI development.

---

## Development Commands

Run all command lines from within the `backend/` folder. Ensure your virtual environment is active.

### 1. Build and Run Server
- **Start FastAPI Dev Server**:
  ```bash
  uvicorn app:app --reload
  ```
- **Start background RQ worker**:
  ```bash
  rq worker ai-processing
  ```

### 2. Database Migrations
- **Run migrations**:
  ```bash
  alembic upgrade head
  ```
- **Create automatic migration schema revision**:
  ```bash
  alembic revision --autogenerate -m "create new table"
  ```
- **Rollback last migration**:
  ```bash
  alembic downgrade -1
  ```

### 3. Testing
- **Run all tests**:
  ```bash
  pytest
  ```
- **Run a specific test file**:
  ```bash
  pytest tests/ai/test_gemini.py
  ```
- **Run only unit tests**:
  ```bash
  pytest tests/ai
  ```
- **Run integration tests**:
  ```bash
  pytest tests/integration
  ```
- **Run tests and suppress warnings**:
  ```bash
  pytest -p no:warnings
  ```

### 4. Code Formatting & Linting
- **Linting check using Ruff**:
  ```bash
  ruff check
  ```
- **Automatically fix Ruff issues**:
  ```bash
  ruff check --fix
  ```
- **Reformat all python files**:
  ```bash
  ruff format
  ```

---

## Coding Style & Conventions

- **Python Version**: Target Python 3.11+.
- **Typing**: Use standard Python type hinting annotations. Prefer Union operator `str | None` rather than `Optional[str]`.
- **Indentation**: Use 4 spaces for Python formatting.
- **Import Ordering**: Keep imports sorted automatically via `ruff format` and `ruff check`. Standard library imports first, third-party libraries second, and local modules last.
- **Async Programming**: Prefer async database and http clients (`AsyncSession` from SQLAlchemy, `AsyncClient` from `httpx`). Make sure connection resources are properly closed.
- **SQLAlchemy 2.0 Syntax**:
  - Use `Mapped[type] = mapped_column(...)` declarative mapping patterns.
  - Execute queries using `select()` constructs and session execution, rather than legacy query methods.
- **Error Handling**: Log failures with appropriate level detail. In background tasks, ensure database sessions rollback on failure.
- **Testing**: Write fixtures with clear scopes. Run tests inside AnyIO fixture wrappers where async execution is required.
