import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app import app
from database.models.activity import UserActivity
from database.models.processed_job import ProcessedJob
from database.models.raw_job import RawJob
from database.repositories.activity_repository import ActivityRepository
from database.repositories.user_repository import UserRepository
from database.session import AsyncSessionLocal


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_activity_repository_unit():
    db = AsyncMock()
    db.add = MagicMock()

    activity = UserActivity(
        id=1,
        user_id=42,
        activity_type="system",
        title="Test Notification",
        body="This is a test notification body",
        read=False,
        created_at=datetime.utcnow(),
    )

    repo = ActivityRepository(db)

    # Test create
    res = await repo.create(
        user_id=42,
        activity_type="save",
        title="Saved job",
        body="Saved engineer",
    )
    assert res.user_id == 42
    assert res.activity_type == "save"
    assert res.title == "Saved job"
    db.add.assert_called_once()
    db.commit.assert_awaited()
    db.refresh.assert_awaited()

    # Test list_by_user
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [activity]
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    db.execute.return_value = mock_result

    activities = await repo.list_by_user(user_id=42, limit=10)
    assert len(activities) == 1
    assert activities[0].title == "Test Notification"

    # Test mark_read
    mock_update_res = MagicMock()
    mock_update_res.rowcount = 1
    db.execute.return_value = mock_update_res

    read_success = await repo.mark_read(user_id=42, activity_id=1)
    assert read_success is True

    # Test mark_all_read
    mock_update_res.rowcount = 5
    count = await repo.mark_all_read(user_id=42)
    assert count == 5


@pytest.mark.anyio
async def test_notifications_api_endpoints(dispose_db_engine):
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
            name="Notif Tester",
            role="user",
        )
        activity_repo = ActivityRepository(db)
        act1 = await activity_repo.create(
            user_id=user.id,
            activity_type="application",
            title="Applied to Staff Engineer",
            body="Application submitted for Staff Engineer at Acme.",
            read=False,
        )
        await activity_repo.create(
            user_id=user.id,
            activity_type="save",
            title="Saved job: Frontend Dev",
            body="Saved Frontend Dev at Beta Corp.",
            read=False,
        )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. GET /api/notifications
        res = await client.get(
            "/api/notifications", headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        notifs = res.json()
        assert len(notifs) >= 2
        titles = [n["title"] for n in notifs]
        assert "Applied to Staff Engineer" in titles
        assert "Saved job: Frontend Dev" in titles

        # Verify response structure
        first = notifs[0]
        assert "id" in first
        assert "type" in first
        assert "title" in first
        assert "body" in first
        assert "createdAt" in first
        assert "read" in first

        # 2. POST /api/notifications/{id}/read
        read_res = await client.post(
            f"/api/notifications/{act1.id}/read",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert read_res.status_code == 200
        assert read_res.json().get("success") is True

        # 3. POST /api/notifications/read-all
        all_read_res = await client.post(
            "/api/notifications/read-all",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert all_read_res.status_code == 200
        assert "updated" in all_read_res.json()


@pytest.mark.anyio
async def test_job_event_creates_activity(dispose_db_engine):
    from config.settings import settings

    settings.auth0_client_id = "mock_client_id"

    unique_sub = f"mock-user-{uuid.uuid4().hex[:8]}"
    unique_email = f"user_{uuid.uuid4().hex[:8]}@opportune.ai"
    token = (
        f"mock-{unique_sub};{unique_email};Event Tester;https://example.com/avatar.png"
    )

    async with AsyncSessionLocal() as db:
        user_repo = UserRepository(db)
        await user_repo.create(
            auth0_sub=unique_sub,
            email=unique_email,
            name="Event Tester",
            role="user",
        )

        # Create a raw job and processed job
        raw_job = RawJob(
            source="linkedin",
            title="Senior Platform Engineer",
            company="CloudTech",
            location="Remote",
            link="https://linkedin.com/jobs/view/123",
            content_hash=uuid.uuid4().hex[:16],
            raw_payload={"desc": "Building distributed systems"},
        )
        db.add(raw_job)
        await db.commit()
        await db.refresh(raw_job)

        processed_job = ProcessedJob(
            raw_job_id=raw_job.id,
            job_title="Senior Platform Engineer",
            company="CloudTech",
            location="Remote",
            skills=["Kubernetes", "Go", "AWS"],
            job_description="Building cloud infrastructure and platform tools.",
        )
        db.add(processed_job)
        await db.commit()
        await db.refresh(processed_job)
        job_id = processed_job.id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # POST /api/v1/events/jobs with apply
        apply_res = await client.post(
            "/api/v1/events/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "job_id": job_id,
                "event_type": "apply",
                "source": "job_detail",
            },
        )
        assert apply_res.status_code == 201

        # Check notifications endpoint has the newly generated activity
        notifs_res = await client.get(
            "/api/notifications", headers={"Authorization": f"Bearer {token}"}
        )
        assert notifs_res.status_code == 200
        notifs = notifs_res.json()
        assert any(
            "Senior Platform Engineer" in n["title"] and n["type"] == "application"
            for n in notifs
        )
