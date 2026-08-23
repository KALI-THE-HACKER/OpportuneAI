import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from ai.embeddings.canonical import (
    build_job_embedding_text,
    build_user_preference_embedding_text,
)
from ai.embeddings.service import EmbeddingService
from database.models.processed_job import ProcessedJob
from database.models.raw_job import ProcessingStatus, RawJob
from database.models.user import User
from database.repositories.user_repository import UserRepository
from database.session import AsyncSessionLocal
from services.backfill_embeddings import backfill_job_embeddings
from services.user_embedding_service import UserEmbeddingService


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_build_job_embedding_text():
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    job = ProcessedJob(
        id=1,
        raw_job_id=10,
        job_title="Senior Python Backend Engineer",
        company="FastCorp",
        skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
        location="Remote",
        salary="$140,000 - $180,000",
        experience_years=5,
        employment_type="full-time",
        job_description="Build distributed microservices with FastAPI and PostgreSQL.",
        processed_at=now,
    )

    text = build_job_embedding_text(job)
    assert "Title: Senior Python Backend Engineer" in text
    assert "Company: FastCorp" in text
    assert "Skills: Python, FastAPI, PostgreSQL, Docker" in text
    assert "Location: Remote" in text
    assert "Work Mode: Remote" in text
    assert "Experience: 5 years" in text
    assert "Description: Build distributed microservices" in text
    # Internal IDs or hashes should NOT be in the text
    assert "raw_job_id" not in text
    assert "id: 1" not in text


def test_build_user_preference_embedding_text_with_preferences():
    user = User(
        id=1,
        auth0_sub="auth0|123",
        email="dev@opportune.ai",
        title="Backend Engineer",
        skills=["Python", "PostgreSQL"],
        preferred_roles=["Senior Backend Engineer", "Python Developer"],
        location="Bangalore",
        preferred_locations=["Remote", "Bangalore"],
        work_modes=["remote", "hybrid"],
        years_of_experience=4,
        resume_extracted_skills=["FastAPI", "Docker", "Python"],  # Python is duplicate
        resume_experience_level="Senior",
    )

    text = build_user_preference_embedding_text(user)
    assert text is not None
    assert "Skills: Python, PostgreSQL, FastAPI, Docker" in text
    assert (
        "Interested roles: Backend Engineer, Senior Backend Engineer, Python Developer"
        in text
    )
    assert "Preferred locations: Bangalore, Remote" in text
    assert "Preferred work modes: Remote, Hybrid" in text
    assert "Experience: 4 years (Senior)" in text


def test_build_user_preference_embedding_text_cold_start():
    # Empty profile with no preferences
    user = User(
        id=2,
        auth0_sub="auth0|empty",
        email="empty@opportune.ai",
        title="",
        location="",
        skills=[],
        preferred_roles=[],
        preferred_locations=[],
        work_modes=[],
        years_of_experience=0,
        resume_extracted_skills=[],
        resume_experience_level=None,
    )

    text = build_user_preference_embedding_text(user)
    assert text is None


def test_embedding_service_mock():
    mock_values = [0.1 * i for i in range(768)]

    with patch("ai.embeddings.service.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_response = MagicMock()
        mock_embedding = MagicMock()
        mock_embedding.values = mock_values
        mock_response.embeddings = [mock_embedding]
        mock_instance.models.embed_content.return_value = mock_response
        mock_client_cls.return_value = mock_instance

        service = EmbeddingService(api_keys=["mock-key"], dimension=768)
        vec = service.embed_text("Test query text")
        assert len(vec) == 768
        assert vec[0] == 0.0


@pytest.mark.anyio
async def test_user_embedding_sync_and_invalidation(dispose_db_engine):
    mock_vec = [0.05] * 768

    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        unique_email = f"emb_user_{uuid.uuid4().hex[:6]}@opportune.ai"
        user = await repo.create(
            auth0_sub=f"auth0|{uuid.uuid4()}",
            email=unique_email,
            name="Embedding Tester",
        )
        await repo.update(
            user,
            skills=["Python", "FastAPI"],
            preferred_roles=["Backend Engineer"],
            years_of_experience=3,
        )

        user_emb_service = UserEmbeddingService(db)
        with patch.object(
            user_emb_service.embedding_service, "aembed_text", return_value=mock_vec
        ):
            has_emb = await user_emb_service.sync_user_preference_embedding(user)
            assert has_emb is True
            assert user.preference_embedding is not None
            assert len(user.preference_embedding) == 768
            assert user.preference_embedding_model is not None

        # Test empty profile clears embedding
        await repo.update(
            user,
            skills=[],
            preferred_roles=[],
            preferred_locations=[],
            work_modes=[],
            years_of_experience=0,
            title="",
            location="",
        )
        has_emb_cleared = await user_emb_service.sync_user_preference_embedding(user)
        assert has_emb_cleared is False
        assert user.preference_embedding is None


@pytest.mark.anyio
async def test_backfill_job_embeddings(dispose_db_engine):
    mock_vec = [0.02] * 768
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    async with AsyncSessionLocal() as db:
        raw_job = RawJob(
            source="test",
            title="DevOps Cloud Architect",
            company="CloudCo",
            link="https://example.com/devops",
            content_hash=f"hash-{uuid.uuid4()}",
            raw_payload={},
            scraped_at=now,
            processing_status=ProcessingStatus.PROCESSED,
        )
        db.add(raw_job)
        await db.flush()

        pj = ProcessedJob(
            raw_job_id=raw_job.id,
            job_title="DevOps Cloud Architect",
            company="CloudCo",
            skills=["Terraform", "Kubernetes", "AWS"],
            location="Remote",
            experience_years=6,
            employment_type="full-time",
            job_description="Scale Kubernetes clusters across cloud providers.",
            processed_at=now,
            embedding=None,  # Needs backfill
            embedding_model=None,
        )
        db.add(pj)
        await db.commit()

        with patch(
            "ai.embeddings.service.EmbeddingService.aembed_text",
            return_value=mock_vec,
        ):
            processed_count, err_count = await backfill_job_embeddings(batch_size=10)
            assert processed_count >= 1
            assert err_count == 0

        # Verify job now has embedding in DB
        await db.refresh(pj)
        assert pj.embedding is not None
        assert len(pj.embedding) == 768
