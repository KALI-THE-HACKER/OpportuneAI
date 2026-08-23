import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app import app
from database.repositories.user_repository import UserRepository
from database.session import AsyncSessionLocal


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_feed_api_endpoints(dispose_db_engine):
    from config.settings import settings

    settings.auth0_client_id = "mock_client_id"

    unique_sub = f"mock-user-{uuid.uuid4().hex[:8]}"
    unique_email = f"user_{uuid.uuid4().hex[:8]}@opportune.ai"
    token = f"mock-{unique_sub};{unique_email};Test User;https://example.com/avatar.png"

    async with AsyncSessionLocal() as db:
        user_repo = UserRepository(db)
        user = await user_repo.create(
            auth0_sub=unique_sub,
            email=unique_email,
            name="Feed Tester",
            role="user",
        )
        await user_repo.update(
            user,
            skills=["Python", "FastAPI", "PostgreSQL"],
            preferred_roles=["Backend Engineer"],
        )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test GET /api/feed
        res = await client.get(
            "/api/feed?limit=5", headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) <= 5
        assert data["total"] >= 1

        first_job = data["items"][0]
        assert "id" in first_job
        assert "title" in first_job
        assert "company" in first_job
        assert "matchScore" in first_job
        assert "skills" in first_job
        assert "salaryMin" in first_job
        assert "workMode" in first_job

        # 2. Test GET /api/jobs/{job_id}
        job_id = first_job["id"]
        detail_res = await client.get(
            f"/api/jobs/{job_id}", headers={"Authorization": f"Bearer {token}"}
        )
        assert detail_res.status_code == 200
        detail_data = detail_res.json()
        assert detail_data["id"] == job_id
        assert detail_data["title"] == first_job["title"]
        assert detail_data["company"] == first_job["company"]

        # 3. Test cursor pagination if total > 5
        if data.get("next_cursor"):
            cursor = data["next_cursor"]
            next_res = await client.get(
                f"/api/feed?limit=5&cursor={cursor}",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert next_res.status_code == 200
            next_data = next_res.json()
            assert len(next_data["items"]) >= 1
            # IDs on page 2 should not match page 1 first item
            assert next_data["items"][0]["id"] != first_job["id"]

        # 4. Test 404 for non-existent job
        not_found_res = await client.get(
            "/api/jobs/999999", headers={"Authorization": f"Bearer {token}"}
        )
        assert not_found_res.status_code == 404
