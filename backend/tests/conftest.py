import pytest


@pytest.fixture
def anyio_backend() -> str:
    """Run AnyIO tests using the asyncio backend only."""
    return "asyncio"
