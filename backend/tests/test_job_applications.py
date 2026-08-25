from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app import app
from database.models.job_application import JobApplication
from database.models.processed_job import ProcessedJob
from database.models.raw_job import ProcessingStatus, RawJob
from database.models.user import User
from database.repositories.job_application_repository import JobApplicationRepository
from database.session import get_db
from utils.auth import get_current_user


@pytest.fixture
def mock_user():
    return User(
        id=1,
        auth0_sub="auth0|test_user_1",
        email="test@opportune.ai",
        name="Test User",
        role="user",
    )


@pytest.fixture
def mock_job():
    raw_job = RawJob(
        id=1,
        source="linkedin",
        external_id="ext-1",
        link="https://linkedin.com/jobs/view/1",
        title="Full Stack Engineer",
        company="Linear Labs",
        location="Remote",
        content_hash="hash1",
        raw_payload={},
        processing_status=ProcessingStatus.PROCESSED,
        scraped_at=datetime.utcnow(),
    )
    return ProcessedJob(
        id=10,
        raw_job_id=1,
        job_title="Full Stack Engineer",
        company="Linear Labs",
        location="Remote",
        skills=["React", "TypeScript", "Python"],
        salary="$150,000 - $180,000",
        employment_type="Full-time",
        experience_years=4,
        job_description="Great role",
        raw_job=raw_job,
        processed_at=datetime.utcnow(),
    )


@pytest.mark.anyio
async def test_job_application_repository_crud(mock_user, mock_job):
    mock_session = AsyncMock()
    repo = JobApplicationRepository(mock_session)

    # Test create
    mock_execute_result = MagicMock()
    mock_execute_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_execute_result

    app_instance = JobApplication(
        id=1,
        user_id=mock_user.id,
        job_id=mock_job.id,
        status="applied",
        notes="Applied via direct portal",
        applied_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        job=mock_job,
    )

    with patch.object(repo, "get_by_id", return_value=app_instance):
        created = await repo.create_or_update(
            user_id=mock_user.id,
            job_id=mock_job.id,
            status="applied",
            notes="Applied via direct portal",
        )
        assert created.status == "applied"
        assert created.notes == "Applied via direct portal"

    # Test list_by_user
    mock_list_result = MagicMock()
    mock_list_result.scalars.return_value.all.return_value = [app_instance]
    mock_session.execute.return_value = mock_list_result

    apps = await repo.list_by_user(user_id=mock_user.id)
    assert len(apps) == 1
    assert apps[0].job_id == mock_job.id

    # Test get_applied_job_ids
    mock_ids_result = MagicMock()
    mock_ids_result.scalars.return_value.all.return_value = [mock_job.id]
    mock_session.execute.return_value = mock_ids_result

    ids = await repo.get_applied_job_ids(user_id=mock_user.id)
    assert ids == {mock_job.id}


@pytest.mark.anyio
async def test_applications_api_endpoints(mock_user, mock_job):
    mock_db = AsyncMock()

    app_record = JobApplication(
        id=101,
        user_id=mock_user.id,
        job_id=mock_job.id,
        status="applied",
        notes="First interview scheduled",
        applied_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        job=mock_job,
    )

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Test GET /api/applications
            with patch(
                "routes.applications.JobApplicationRepository.list_by_user",
                new_callable=AsyncMock,
                return_value=[app_record],
            ):
                response = await client.get("/api/applications")
                assert response.status_code == 200
                data = response.json()
                assert len(data) == 1
                assert data[0]["id"] == "app-101"
                assert data[0]["jobId"] == "job-10"
                assert data[0]["status"] == "applied"
                assert data[0]["notes"] == "First interview scheduled"
                assert data[0]["job"]["title"] == "Full Stack Engineer"

            # 2. Test POST /api/applications
            with (
                patch(
                    "routes.applications.ProcessedJobRepository.get_by_id_with_raw",
                    new_callable=AsyncMock,
                    return_value=mock_job,
                ),
                patch(
                    "routes.applications.JobApplicationRepository.create_or_update",
                    new_callable=AsyncMock,
                    return_value=app_record,
                ),
            ):
                create_res = await client.post(
                    "/api/applications",
                    json={"job_id": 10, "status": "applied", "notes": "New note"},
                )
                assert create_res.status_code == 201
                assert create_res.json()["id"] == "app-101"

            # 3. Test PATCH /api/applications/{id}
            app_updated = JobApplication(
                id=101,
                user_id=mock_user.id,
                job_id=mock_job.id,
                status="interviewing",
                notes="Passed round 1",
                applied_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                job=mock_job,
            )
            with patch(
                "routes.applications.JobApplicationRepository.update_status_or_notes",
                new_callable=AsyncMock,
                return_value=app_updated,
            ):
                patch_res = await client.patch(
                    "/api/applications/app-101",
                    json={"status": "interviewing", "notes": "Passed round 1"},
                )
                assert patch_res.status_code == 200
                assert patch_res.json()["status"] == "interviewing"

            # 4. Test DELETE /api/applications/{id}
            with (
                patch(
                    "routes.applications.JobApplicationRepository.get_by_id",
                    new_callable=AsyncMock,
                    return_value=app_record,
                ),
                patch(
                    "routes.applications.JobApplicationRepository.delete",
                    new_callable=AsyncMock,
                    return_value=True,
                ),
            ):
                del_res = await client.delete("/api/applications/app-101")
                assert del_res.status_code == 204

    finally:
        app.dependency_overrides.clear()
