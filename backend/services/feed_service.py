import base64
import json
import logging
from datetime import datetime, timezone

from redis import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from config.settings import settings
from database.models.processed_job import ProcessedJob
from database.models.user import User
from database.repositories.processed_job_repository import ProcessedJobRepository
from services.scoring import (
    ScoringEngine,
    infer_experience_level,
    infer_job_type,
    infer_work_mode,
    parse_salary_range,
)

logger = logging.getLogger("feed_service")

# Thread-safe Redis client for feed caching
_redis_client: Redis | None = None


def get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            db=settings.redis_db,
            decode_responses=True,
        )
    return _redis_client


def compute_cosine_similarity(
    vec1: list[float] | None, vec2: list[float] | None
) -> float | None:
    """Compute cosine similarity between two float vectors."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return None
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a * a for a in vec1) ** 0.5
    norm2 = sum(b * b for b in vec2) ** 0.5
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (norm1 * norm2)))


class FeedService:
    def __init__(self, db: AsyncSession, redis: Redis | None = None):
        self.db = db
        self.repo = ProcessedJobRepository(db)
        self.redis = redis or get_redis_client()

    @staticmethod
    def get_feed_cache_key(user_id: int) -> str:
        return f"feed:user:{user_id}"

    def invalidate_feed(self, user_id: int) -> None:
        """Invalidate the cached personalized feed for a user."""
        try:
            cache_key = self.get_feed_cache_key(user_id)
            self.redis.delete(cache_key)
            logger.info("Invalidated feed cache for user %s", user_id)
        except Exception as e:
            logger.warning(
                "Failed to invalidate feed cache for user %s: %s", user_id, e
            )

    async def generate_feed(self, user: User | None) -> list[int]:
        """Generate personalized hybrid-ranked feed.

        Stage 1 (Candidate Retrieval):
            - If user has preference_embedding: retrieve top N semantically similar candidates using pgvector.
            - If no preference_embedding or empty candidates: fallback to eligible jobs (cold start).
        Stage 2 (Structured Reranking):
            - Score candidates using ScoringEngine.score_job()
            - Calculate hybrid score:
                hybrid_score = SEMANTIC_WEIGHT * (semantic_similarity * 100.0) + STRUCTURED_WEIGHT * structured_score
            - Sort deterministically: (final_score, processed_at, id) desc.
        Stage 3 (Caching):
            - Store ranked IDs in Redis under feed:user:{user_id}.
        """
        scored_jobs: list[tuple[ProcessedJob, float]] = []
        has_preference_embedding = bool(user and user.preference_embedding is not None)

        # Stage 1: Candidate Retrieval
        if has_preference_embedding and user:
            user_vec = list(user.preference_embedding)  # type: ignore[union-attr]
            candidates = await self.repo.get_semantic_candidates(
                user_embedding=user_vec,
                limit=settings.candidate_pool_size,
            )

            if candidates:
                # Stage 2: Structured Reranking for semantic candidates
                for job, semantic_similarity in candidates:
                    structured_score, _, _ = ScoringEngine.score_job(user, job)
                    semantic_score_100 = semantic_similarity * 100.0

                    hybrid_score = (
                        settings.hybrid_semantic_weight * semantic_score_100
                        + settings.hybrid_structured_weight * structured_score
                    )
                    scored_jobs.append((job, hybrid_score))

        # Fallback / Cold Start (user is guest, empty profile, or no semantic candidates)
        if not scored_jobs:
            eligible_jobs = await self.repo.get_all_eligible(
                limit=settings.candidate_pool_size
            )
            if not eligible_jobs:
                return []

            for job in eligible_jobs:
                score, _, _ = ScoringEngine.score_job(user, job)
                scored_jobs.append((job, score))

        # Deterministic sorting: score desc, processed_at desc, id desc
        scored_jobs.sort(
            key=lambda item: (
                item[1],
                item[0].processed_at or datetime.min,
                item[0].id,
            ),
            reverse=True,
        )

        ranked_job_ids = [job.id for job, _ in scored_jobs]

        # Cache in Redis if user exists
        if user and user.id:
            try:
                cache_key = self.get_feed_cache_key(user.id)
                payload = json.dumps(
                    {
                        "job_ids": ranked_job_ids,
                        "generated_at": datetime.now(timezone.utc).isoformat(),
                        "version": 1,
                    }
                )
                self.redis.set(cache_key, payload, ex=settings.feed_cache_ttl)
                logger.info(
                    "Cached %d ranked jobs for user %s in Redis (TTL: %ds, hybrid=%s)",
                    len(ranked_job_ids),
                    user.id,
                    settings.feed_cache_ttl,
                    has_preference_embedding,
                )
            except Exception as e:
                logger.warning("Redis cache write failed for user %s: %s", user.id, e)

        return ranked_job_ids

    @staticmethod
    def encode_cursor(offset: int) -> str:
        data = json.dumps({"offset": offset}).encode("utf-8")
        return base64.urlsafe_b64encode(data).decode("utf-8")

    @staticmethod
    def decode_cursor(cursor: str | None) -> int:
        if not cursor:
            return 0
        try:
            raw = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
            data = json.loads(raw)
            return max(0, int(data.get("offset", 0)))
        except Exception:
            # Fallback to direct integer string if provided
            try:
                return max(0, int(cursor))
            except Exception:
                return 0

    @staticmethod
    def format_job_card(
        job: ProcessedJob, user: User | None = None, is_saved: bool = False
    ) -> dict:
        """Format a ProcessedJob into the complete job card representation expected by the frontend."""
        structured_score, matched_skills, missing_skills = ScoringEngine.score_job(
            user, job
        )

        final_score = structured_score
        if user and user.preference_embedding is not None and job.embedding is not None:
            user_vec = list(user.preference_embedding)
            job_vec = list(job.embedding)
            sim = compute_cosine_similarity(user_vec, job_vec)
            if sim is not None:
                final_score = (
                    settings.hybrid_semantic_weight * (sim * 100.0)
                    + settings.hybrid_structured_weight * structured_score
                )

        salary_min, salary_max, currency = parse_salary_range(job.salary)
        work_mode = infer_work_mode(job.location, job.employment_type)
        experience_lvl = infer_experience_level(job.experience_years)
        job_type = infer_job_type(job.employment_type)

        posted_at = (
            job.processed_at.isoformat()
            if job.processed_at
            else datetime.now(timezone.utc).isoformat()
        )
        if job.raw_job and job.raw_job.date_posted:
            posted_at = job.raw_job.date_posted
        elif job.raw_job and job.raw_job.scraped_at:
            posted_at = job.raw_job.scraped_at.isoformat()

        # Split description into basic responsibilities/requirements if multi-line
        desc_lines = [
            line.strip().lstrip("•-* ")
            for line in (job.job_description or "").split("\n")
            if len(line.strip()) > 10
        ]
        responsibilities = (
            desc_lines[:4]
            if desc_lines
            else ["Deliver high quality solutions end-to-end"]
        )
        requirements = (
            desc_lines[4:8]
            if len(desc_lines) > 4
            else ["Demonstrated experience in technical stack"]
        )

        clamped_match_score = max(5, min(99, int(round(final_score))))

        return {
            "id": str(job.id),
            "title": job.job_title,
            "company": job.company,
            "companyLogo": None,
            "location": job.location,
            "workMode": work_mode,
            "type": job_type,
            "salaryMin": salary_min,
            "salaryMax": salary_max,
            "currency": currency,
            "postedAt": posted_at,
            "description": job.job_description,
            "responsibilities": responsibilities,
            "requirements": requirements,
            "skills": job.skills or [],
            "matchScore": clamped_match_score,
            "missingSkills": missing_skills,
            "matchedSkills": matched_skills,
            "experienceLevel": experience_lvl,
            "saved": is_saved,
            "link": job.raw_job.link if job.raw_job else None,
            "lastDateToApply": (
                job.last_date_to_apply.isoformat() if job.last_date_to_apply else None
            ),
            "applyUrl": job.apply_url,
            "contactEmail": job.contact_email,
            "contactName": job.contact_name,
            "contactRole": job.contact_role,
        }

    async def get_feed(
        self,
        user: User | None,
        limit: int = 20,
        cursor: str | None = None,
    ) -> dict:
        """Retrieve a paginated page of the personalized feed."""
        limit = max(1, min(limit, 100))
        offset = self.decode_cursor(cursor)

        cached_job_ids: list[int] = []

        if user and user.id:
            try:
                cache_key = self.get_feed_cache_key(user.id)
                cached_data = self.redis.get(cache_key)
                if cached_data:
                    parsed = json.loads(cached_data)
                    cached_job_ids = parsed.get("job_ids", [])
                    logger.debug(
                        "Redis feed cache hit for user %s (%d IDs)",
                        user.id,
                        len(cached_job_ids),
                    )
            except Exception as e:
                logger.warning("Redis cache read error for user %s: %s", user.id, e)

        # Cache miss or new feed generation
        if not cached_job_ids:
            logger.debug(
                "Feed cache miss for user %s, generating fresh feed",
                user.id if user else "guest",
            )
            cached_job_ids = await self.generate_feed(user)

        total_count = len(cached_job_ids)
        target_ids = cached_job_ids[offset : offset + limit]

        if not target_ids:
            return {
                "items": [],
                "next_cursor": None,
                "total": total_count,
            }

        # 1 Single Batch DB query for all target job IDs
        jobs = await self.repo.get_by_ids(target_ids)
        jobs_by_id = {job.id: job for job in jobs}

        # Restore exact Redis ranking order and gracefully skip missing records
        ordered_jobs: list[ProcessedJob] = [
            jobs_by_id[jid] for jid in target_ids if jid in jobs_by_id
        ]

        items = [self.format_job_card(job, user=user) for job in ordered_jobs]

        has_more = (offset + limit) < total_count
        next_cursor = self.encode_cursor(offset + limit) if has_more else None

        return {
            "items": items,
            "next_cursor": next_cursor,
            "total": total_count,
        }
