import pytest
from fastapi import HTTPException

from database.models.user import User
from database.session import AsyncSessionLocal
from routes.admin import (
    get_admin_providers,
    get_admin_queue,
    get_admin_stats,
    get_admin_workers,
)
from utils.auth import require_admin


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_require_admin_guard():
    """Test require_admin rejects non-admin users and allows admin users."""
    normal_user = User(
        id=101,
        auth0_sub="auth0|normal-101",
        email="normal@example.com",
        name="Normal User",
        role="user",
    )

    admin_user = User(
        id=102,
        auth0_sub="auth0|admin-102",
        email="admin@opportuneai.com",
        name="Admin User",
        role="admin",
    )

    # 1. Normal user should raise HTTP 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        await require_admin(user=normal_user)
    assert exc_info.value.status_code == 403
    assert "Admin privileges required" in exc_info.value.detail

    # 2. Admin user should pass through
    result_user = await require_admin(user=admin_user)
    assert result_user.role == "admin"
    assert result_user.id == 102


@pytest.mark.anyio
async def test_admin_endpoints(dispose_db_engine):
    """Test admin endpoint responses when invoked with admin user."""
    admin_user = User(
        id=103,
        auth0_sub="auth0|admin-103",
        email="admin@opportune.ai",
        name="Admin User",
        role="admin",
    )

    async with AsyncSessionLocal() as db:
        stats = await get_admin_stats(admin=admin_user, db=db)
        assert stats.totalJobs >= 0
        assert stats.totalUsers >= 1
        assert stats.uptimePct > 0

    providers = await get_admin_providers(admin=admin_user)
    assert len(providers) > 0
    assert any(p.name == "LinkedIn Raw" for p in providers)

    workers = await get_admin_workers(admin=admin_user)
    assert len(workers) == 12

    queue = await get_admin_queue(admin=admin_user)
    assert len(queue) == 8
