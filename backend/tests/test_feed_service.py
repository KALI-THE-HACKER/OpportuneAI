import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from database.models.processed_job import ProcessedJob
from database.models.raw_job import ProcessingStatus, RawJob
from database.repositories.processed_job_repository import ProcessedJobRepository
from database.repositories.user_repository import UserRepository
from database.session import AsyncSessionLocal
from services.feed_service import FeedService
from services.scoring import ScoringEngine


@pytest.fixture
def anyio_backend():
    return "asyncio"


class MockRedis:
    def __init__(self):
        self.store = {}
        self.sets = {}

    def get(self, key: str):
        return self.store.get(key)

    def set(self, key: str, value: str, ex: int | None = None):
        self.store[key] = value
        return True

    def delete(self, key: str):
        self.store.pop(key, None)
        self.sets.pop(key, None)
        return True

    def sadd(self, key: str, *members: str):
        if key not in self.sets:
            self.sets[key] = set()
        for m in members:
            self.sets[key].add(str(m))
        return len(members)

    def smembers(self, key: str):
        return set(self.sets.get(key, set()))

    def srem(self, key: str, *members: str):
        s = self.sets.get(key, set())
        removed = 0
        for m in members:
            if str(m) in s:
                s.remove(str(m))
                removed += 1
        return removed


def test_scoring_variable_length_skills():
    # User has 3 skills
    user_skills = ["python", "fastapi", "postgresql"]

    # Job A has 3 matching skills out of 4 skills
    job_a_skills = ["python", "fastapi", "postgresql", "docker"]
    score_a, matched_a, missing_a = ScoringEngine.calculate_skill_score(
        user_skills, job_a_skills
    )
    assert len(matched_a) == 3
    assert "docker" in missing_a
    assert score_a > 25.0

    # Job B has 20 skills (skill dump), only 1 match
    job_b_skills = ["python"] + [f"random_skill_{i}" for i in range(19)]
    score_b, matched_b, missing_b = ScoringEngine.calculate_skill_score(
        user_skills, job_b_skills
    )
    assert len(matched_b) == 1
    # Skill dump with 1 match should score significantly lower than high-overlap job A
    assert score_a > score_b * 2.0


def test_scoring_role_matching():
    # Exact role match
    score_exact = ScoringEngine.calculate_role_score(
        "Backend Engineer", ["Python Developer"], "Senior Backend Engineer"
    )
    assert score_exact > 20.0

    # Token overlap
    score_partial = ScoringEngine.calculate_role_score(
        "Software Architect", [], "Cloud Platform Architect"
    )
    assert score_partial > 10.0

    # Unrelated role
    score_unrelated = ScoringEngine.calculate_role_score(
        "Product Designer", ["UI/UX Designer"], "DevOps Engineer"
    )
    assert score_unrelated == 0.0


def test_scoring_location_matching():
    # 1. User preferred locations include "remote" & job is remote -> full match without comparing physical locs
    score_remote = ScoringEngine.calculate_location_score(
        user_location="London, UK",
        preferred_locations=["Remote", "Berlin, Germany"],
        job_location="Remote",
        work_mode="remote",
        user_work_modes=["remote", "hybrid"],
        willing_to_relocate=False,
    )
    assert score_remote == 15.0

    # 2. User willing to relocate -> full match regardless of physical location mismatch
    score_relocate = ScoringEngine.calculate_location_score(
        user_location="London, UK",
        preferred_locations=["London, UK"],
        job_location="Tokyo, Japan",
        work_mode="on-site",
        user_work_modes=["on-site"],
        willing_to_relocate=True,
    )
    assert score_relocate == 15.0

    # 3. User not willing to relocate and locations do not match -> low score
    score_mismatch = ScoringEngine.calculate_location_score(
        user_location="London, UK",
        preferred_locations=["London, UK"],
        job_location="Tokyo, Japan",
        work_mode="on-site",
        user_work_modes=["on-site"],
        willing_to_relocate=False,
    )
    assert score_mismatch == 3.0  # 0.2 * 15.0

    # 4. User physical location match -> full match
    score_physical_match = ScoringEngine.calculate_location_score(
        user_location="London, UK",
        preferred_locations=["Berlin, Germany"],
        job_location="Berlin, Germany",
        work_mode="hybrid",
        user_work_modes=["hybrid"],
        willing_to_relocate=False,
    )
    assert score_physical_match == 15.0


def test_cold_start_score():
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    job = ProcessedJob(
        id=101,
        raw_job_id=1,
        job_title="Software Engineer",
        company="Tech Corp",
        skills=["Python", "FastAPI"],
        location="Remote",
        salary="$120,000 - $150,000",
        experience_years=3,
        employment_type="full-time",
        job_description="Great role building software for modern platforms with interesting challenges.",
        processed_at=now,
    )
    score, matched, missing = ScoringEngine.score_job(None, job)
    assert score >= 50.0
    assert len(missing) == 2


@pytest.mark.anyio
async def test_feed_service_personalized_ranking_and_caching(dispose_db_engine):
    mock_redis = MockRedis()

    async with AsyncSessionLocal() as db:
        user_repo = UserRepository(db)

        # Create unique test user with Python/FastAPI preference
        unique_email = f"dev_{uuid.uuid4().hex[:8]}@opportune.ai"
        user = await user_repo.create(
            auth0_sub=f"auth0|{uuid.uuid4()}",
            email=unique_email,
            name="Python Master",
            role="user",
        )
        await user_repo.update(
            user,
            skills=["Python", "FastAPI", "PostgreSQL"],
            preferred_roles=["Backend Engineer"],
            location="Remote",
            work_modes=["remote"],
            years_of_experience=4,
        )

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Create RawJob & ProcessedJob for Python (High match)
        raw_py = RawJob(
            source="test",
            title="Senior Backend Python Engineer",
            company="PyCorp",
            link="https://example.com/py",
            content_hash=f"hash-{uuid.uuid4()}",
            raw_payload={},
            scraped_at=now,
            processing_status=ProcessingStatus.PROCESSED,
        )
        db.add(raw_py)
        await db.flush()

        pj_py = ProcessedJob(
            raw_job_id=raw_py.id,
            job_title="Senior Backend Python Engineer",
            company="PyCorp",
            skills=["Python", "FastAPI", "PostgreSQL", "Redis"],
            location="Remote",
            salary="$150,000",
            experience_years=4,
            employment_type="full-time",
            last_date_to_apply=now + timedelta(days=30),
            job_description="Join us building FastAPI services.",
            processed_at=now,
        )
        db.add(pj_py)

        # Create RawJob & ProcessedJob for React (Low match)
        raw_react = RawJob(
            source="test",
            title="Frontend React UI Specialist",
            company="ReactLabs",
            link="https://example.com/react",
            content_hash=f"hash-{uuid.uuid4()}",
            raw_payload={},
            scraped_at=now,
            processing_status=ProcessingStatus.PROCESSED,
        )
        db.add(raw_react)
        await db.flush()

        pj_react = ProcessedJob(
            raw_job_id=raw_react.id,
            job_title="Frontend React UI Specialist",
            company="ReactLabs",
            skills=["React", "TypeScript", "Tailwind CSS"],
            location="San Francisco, CA",
            salary="$130,000",
            experience_years=3,
            employment_type="full-time",
            last_date_to_apply=now + timedelta(days=30),
            job_description="Build modern React frontends.",
            processed_at=now,
        )
        db.add(pj_react)
        await db.commit()

        feed_service = FeedService(db, redis=mock_redis)

        # 1. First fetch (Cache Miss -> Generates & Caches)
        feed_res = await feed_service.get_feed(user=user, limit=10)
        assert len(feed_res["items"]) >= 2
        top_job = feed_res["items"][0]
        assert top_job["title"] == "Senior Backend Python Engineer"
        assert top_job["matchScore"] > 80
        assert "Python" in top_job["matchedSkills"]

        # Verify cached in MockRedis
        cache_key = feed_service.get_feed_cache_key(user.id)
        assert mock_redis.get(cache_key) is not None

        # 2. Second fetch (Cache Hit)
        cached_res = await feed_service.get_feed(user=user, limit=10)
        assert cached_res["items"][0]["id"] == str(pj_py.id)

        # 3. Invalidation
        feed_service.invalidate_feed(user.id)
        assert mock_redis.get(cache_key) is None

        # 4. Expiry check: Expired jobs must be excluded from feed
        pj_py.last_date_to_apply = now - timedelta(days=1)
        await db.commit()

        expired_check_res = await feed_service.get_feed(user=user, limit=10)
        expired_ids = [item["id"] for item in expired_check_res["items"]]
        assert str(pj_py.id) not in expired_ids

        # 5. Applied check: Applied jobs must be excluded from feed
        mock_redis.sadd(f"user:{user.id}:applied_jobs", str(pj_react.id))
        feed_service.invalidate_feed(user.id)
        applied_check_res = await feed_service.get_feed(user=user, limit=10)
        applied_check_ids = [item["id"] for item in applied_check_res["items"]]
        assert str(pj_react.id) not in applied_check_ids


@pytest.mark.anyio
async def test_feed_service_hybrid_ranking_with_embeddings(dispose_db_engine):
    mock_redis = MockRedis()

    async with AsyncSessionLocal() as db:
        user_repo = UserRepository(db)
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Create user with preference embedding
        # User vector: high on first dimension [1.0, 0.0, ...]
        user_embedding = [0.0] * 768
        user_embedding[0] = 1.0

        user = await user_repo.create(
            auth0_sub=f"auth0|hybrid-{uuid.uuid4()}",
            email=f"hybrid_{uuid.uuid4().hex[:6]}@opportune.ai",
            name="Hybrid User",
        )
        await user_repo.update(
            user,
            skills=["Python", "FastAPI"],
            preferred_roles=["Backend Engineer"],
            location="Remote",
            work_modes=["remote"],
            years_of_experience=3,
        )
        user.preference_embedding = user_embedding
        user.preference_embedding_model = "models/gemini-embedding-001"
        await db.commit()

        # Job 1: High semantic similarity vector (0.98 similarity)
        job1_vec = [0.0] * 768
        job1_vec[0] = 0.98

        raw1 = RawJob(
            source="test",
            title="FastAPI Cloud Engineer",
            company="CloudHQ",
            link="https://example.com/j1",
            content_hash=f"hash-{uuid.uuid4()}",
            raw_payload={},
            scraped_at=now,
            processing_status=ProcessingStatus.PROCESSED,
        )
        db.add(raw1)
        await db.flush()

        pj1 = ProcessedJob(
            raw_job_id=raw1.id,
            job_title="FastAPI Cloud Engineer",
            company="CloudHQ",
            skills=["Python", "FastAPI"],
            location="Remote",
            experience_years=3,
            employment_type="full-time",
            job_description="FastAPI cloud engineering.",
            processed_at=now,
            embedding=job1_vec,
            embedding_model="models/gemini-embedding-001",
        )
        db.add(pj1)

        # Job 2: Low semantic similarity vector (orthogonal vector)
        job2_vec = [0.0] * 768
        job2_vec[1] = 1.0

        raw2 = RawJob(
            source="test",
            title="Graphic Designer",
            company="DesignHQ",
            link="https://example.com/j2",
            content_hash=f"hash-{uuid.uuid4()}",
            raw_payload={},
            scraped_at=now,
            processing_status=ProcessingStatus.PROCESSED,
        )
        db.add(raw2)
        await db.flush()

        pj2 = ProcessedJob(
            raw_job_id=raw2.id,
            job_title="Graphic Designer",
            company="DesignHQ",
            skills=["Photoshop", "Illustrator"],
            location="New York, NY",
            experience_years=3,
            employment_type="full-time",
            job_description="Design high quality brand visuals.",
            processed_at=now,
            embedding=job2_vec,
            embedding_model="models/gemini-embedding-001",
        )
        db.add(pj2)
        await db.commit()

        feed_service = FeedService(db, redis=mock_redis)
        with patch.object(
            ProcessedJobRepository,
            "get_semantic_candidates",
            return_value=[(pj1, 0.98), (pj2, 0.0)],
        ):
            feed_res = await feed_service.get_feed(user=user, limit=10)

        # High similarity job must rank first
        assert len(feed_res["items"]) >= 2
        items = feed_res["items"]
        assert items[0]["id"] == str(pj1.id)
        assert items[0]["matchScore"] > items[1]["matchScore"]
