import pytest
from database.session import engine


@pytest.fixture
def anyio_backend() -> str:
    """Run AnyIO tests using the asyncio backend only."""
    return "asyncio"


@pytest.fixture
async def dispose_db_engine():
    """Dispose the database engine at the end of each test to avoid event loop reuse issues with connection pools."""
    yield
    await engine.dispose()
