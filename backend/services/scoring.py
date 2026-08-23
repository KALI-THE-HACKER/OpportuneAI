import re
from datetime import datetime

from database.models.processed_job import ProcessedJob
from database.models.user import User

# Centralized Scoring Weights (Sum = 100.0)
ROLE_WEIGHT = 30.0
SKILL_WEIGHT = 35.0
LOCATION_WEIGHT = 15.0
WORK_MODE_WEIGHT = 10.0
EXPERIENCE_WEIGHT = 10.0


def _tokenize(text: str) -> set[str]:
    """Tokenize text into lowercase alphanumeric words."""
    if not text:
        return set()
    return set(re.findall(r"\b[a-zA-Z0-9+#.-]+\b", text.lower()))


def infer_work_mode(location: str, employment_type: str | None = None) -> str:
    """Infer work mode ('remote', 'hybrid', 'on-site') from location and employment type."""
    loc = (location or "").lower()
    emp = (employment_type or "").lower()
    if "remote" in loc or "remote" in emp:
        return "remote"
    if "hybrid" in loc or "hybrid" in emp:
        return "hybrid"
    return "on-site"


def infer_experience_level(years: int | None) -> str:
    """Map years of experience to standard seniority levels."""
    if years is None or years <= 2:
        return "Entry"
    if years <= 5:
        return "Mid"
    if years <= 8:
        return "Senior"
    if years <= 11:
        return "Lead"
    return "Principal"


def infer_job_type(employment_type: str | None) -> str:
    """Map raw employment type string to frontend JobType."""
    if not employment_type:
        return "full-time"
    emp = employment_type.lower()
    if "contract" in emp:
        return "contract"
    if "part" in emp:
        return "part-time"
    if "intern" in emp:
        return "internship"
    return "full-time"


def parse_salary_range(salary_str: str | None) -> tuple[int, int, str]:
    """Parse a salary string into (min_salary, max_salary, currency)."""
    if not salary_str:
        return (0, 0, "USD")

    # Extract all numbers/k-values
    # e.g. "$120,000 - $160,000", "$100k - $140k", "120k"
    matches = re.findall(r"(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|K)?", salary_str)
    nums = []
    for raw_num, k in matches:
        val = float(raw_num.replace(",", ""))
        if k:
            val *= 1000
        elif val < 1000 and "k" in salary_str.lower():
            val *= 1000
        nums.append(int(val))

    if len(nums) >= 2:
        return (min(nums[0], nums[1]), max(nums[0], nums[1]), "USD")
    if len(nums) == 1:
        return (nums[0], int(nums[0] * 1.3), "USD")
    return (0, 0, "USD")


class ScoringEngine:
    @staticmethod
    def calculate_skill_score(
        user_skills: list[str], job_skills: list[str]
    ) -> tuple[float, list[str], list[str]]:
        """Calculate skill overlap with variable-length array normalization.

        Returns (score, matched_skills, missing_skills).
        """
        if not job_skills:
            return (0.5 * SKILL_WEIGHT if not user_skills else 0.0, [], [])
        if not user_skills:
            return (0.5 * SKILL_WEIGHT, [], list(job_skills))

        user_skills_map = {s.lower().strip(): s for s in user_skills if s}
        user_skills_set = set(user_skills_map.keys())

        matched: list[str] = []
        missing: list[str] = []

        for skill in job_skills:
            cleaned = skill.lower().strip()
            if cleaned in user_skills_set:
                matched.append(skill)
            else:
                missing.append(skill)

        overlap_count = len(matched)
        if overlap_count == 0:
            return (0.0, matched, missing)

        # Normalization factor avoids penalizing short candidate skill lists
        # while preventing jobs with huge numbers of skills from dominating unfairly
        norm_factor = (len(job_skills) * len(user_skills_set)) ** 0.5
        overlap_ratio = min(1.0, (overlap_count / norm_factor) * 1.25)
        score = overlap_ratio * SKILL_WEIGHT
        return (score, matched, missing)

    @staticmethod
    def calculate_role_score(
        user_title: str, preferred_roles: list[str], job_title: str
    ) -> float:
        """Calculate role compatibility based on title and preferred roles."""
        job_tokens = _tokenize(job_title)
        if not job_tokens:
            return 0.0

        roles = [r for r in ([user_title] + preferred_roles) if r]
        if not roles:
            return 0.5 * ROLE_WEIGHT  # Neutral score for cold start/unspecified

        job_title_lower = job_title.lower()
        max_ratio = 0.0

        for role in roles:
            role_lower = role.lower()
            if role_lower in job_title_lower or job_title_lower in role_lower:
                max_ratio = max(max_ratio, 1.0)
                break
            role_tokens = _tokenize(role)
            if role_tokens:
                common = role_tokens & job_tokens
                ratio = len(common) / max(len(role_tokens), 1)
                max_ratio = max(max_ratio, ratio)

        return max_ratio * ROLE_WEIGHT

    @staticmethod
    def calculate_location_score(
        user_location: str,
        preferred_locations: list[str],
        job_location: str,
        work_mode: str,
        user_work_modes: list[str],
    ) -> float:
        """Calculate location and remote work compatibility."""
        user_modes_lower = [m.lower() for m in user_work_modes]
        if work_mode == "remote" and (
            "remote" in user_modes_lower or not user_work_modes
        ):
            return LOCATION_WEIGHT

        locs = [loc.lower() for loc in ([user_location] + preferred_locations) if loc]
        if not locs:
            return 0.5 * LOCATION_WEIGHT  # Neutral

        job_loc_lower = (job_location or "").lower()
        for loc in locs:
            if loc in job_loc_lower or job_loc_lower in loc:
                return LOCATION_WEIGHT

        return 0.2 * LOCATION_WEIGHT

    @staticmethod
    def calculate_work_mode_score(
        user_work_modes: list[str],
        job_work_mode: str,
        job_employment_type: str | None,
    ) -> float:
        """Calculate work mode and employment type compatibility."""
        if not user_work_modes:
            return 0.5 * WORK_MODE_WEIGHT

        modes_lower = {m.lower() for m in user_work_modes}
        if job_work_mode.lower() in modes_lower:
            return WORK_MODE_WEIGHT

        emp_type = (job_employment_type or "").lower()
        for mode in modes_lower:
            if mode in emp_type:
                return 0.8 * WORK_MODE_WEIGHT

        return 0.3 * WORK_MODE_WEIGHT

    @staticmethod
    def calculate_experience_score(
        user_years: int, job_experience_years: int | None
    ) -> float:
        """Calculate experience proximity score."""
        if job_experience_years is None:
            return 0.7 * EXPERIENCE_WEIGHT

        diff = abs(user_years - job_experience_years)
        if diff <= 1:
            ratio = 1.0
        elif diff <= 2:
            ratio = 0.85
        elif diff <= 4:
            ratio = 0.55
        elif diff <= 6:
            ratio = 0.3
        else:
            ratio = 0.1

        return ratio * EXPERIENCE_WEIGHT

    @staticmethod
    def calculate_cold_start_score(job: ProcessedJob) -> float:
        """Fallback ranking for users with empty preferences based on recency and completeness."""
        base_score = 55.0

        # Completeness bonuses
        if job.skills and len(job.skills) > 0:
            base_score += min(15.0, len(job.skills) * 2.0)
        if job.salary:
            base_score += 10.0
        if job.job_description and len(job.job_description) > 200:
            base_score += 5.0

        # Recency bonus (up to 10 points)
        if job.processed_at:
            hours_old = (datetime.utcnow() - job.processed_at).total_seconds() / 3600.0
            recency_bonus = max(0.0, 10.0 - (hours_old / 24.0))
            base_score += recency_bonus

        return min(90.0, base_score)

    @classmethod
    def score_job(
        cls, user: User | None, job: ProcessedJob
    ) -> tuple[float, list[str], list[str]]:
        """Compute the final match score for a job against a user profile.

        Returns (match_score_0_to_100, matched_skills, missing_skills).
        """
        # Merge profile skills and resume skills
        user_skills: list[str] = []
        user_roles: list[str] = []
        user_locs: list[str] = []
        user_modes: list[str] = []
        user_years = 0
        user_title = ""
        user_loc = ""

        if user:
            user_skills = list(
                set((user.skills or []) + (user.resume_extracted_skills or []))
            )
            user_roles = user.preferred_roles or []
            user_locs = user.preferred_locations or []
            user_modes = user.work_modes or []
            user_years = user.years_of_experience or user.resume_years_total or 0
            user_title = user.title or ""
            user_loc = user.location or ""

        has_preferences = bool(
            user_skills
            or user_roles
            or user_locs
            or user_modes
            or user_years
            or user_title
            or user_loc
        )

        job_work_mode = infer_work_mode(job.location, job.employment_type)

        if not has_preferences:
            cold_score = cls.calculate_cold_start_score(job)
            return (round(cold_score, 1), [], list(job.skills or []))

        skill_score, matched_skills, missing_skills = cls.calculate_skill_score(
            user_skills=user_skills, job_skills=job.skills or []
        )
        role_score = cls.calculate_role_score(
            user_title=user_title,
            preferred_roles=user_roles,
            job_title=job.job_title,
        )
        location_score = cls.calculate_location_score(
            user_location=user_loc,
            preferred_locations=user_locs,
            job_location=job.location,
            work_mode=job_work_mode,
            user_work_modes=user_modes,
        )
        work_mode_score = cls.calculate_work_mode_score(
            user_work_modes=user_modes,
            job_work_mode=job_work_mode,
            job_employment_type=job.employment_type,
        )
        experience_score = cls.calculate_experience_score(
            user_years=user_years,
            job_experience_years=job.experience_years,
        )

        total_score = (
            skill_score
            + role_score
            + location_score
            + work_mode_score
            + experience_score
        )

        # Scale match score between 5 and 99 reflecting true profile fit
        clamped_score = max(5.0, min(99.0, total_score))
        return (round(clamped_score, 1), matched_skills, missing_skills)
