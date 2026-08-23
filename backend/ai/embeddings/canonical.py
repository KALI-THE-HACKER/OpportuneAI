"""Canonical textual representations for embedding generation.

Builds deterministic, high-signal text representations for:
- ProcessedJob: role, company, skills, location, work mode, employment type, experience, description
- User preferences: skills (profile + resume), roles, locations, work modes, experience
"""

from database.models.processed_job import ProcessedJob
from database.models.user import User
from services.scoring import infer_experience_level, infer_work_mode


def build_job_embedding_text(job: ProcessedJob) -> str:
    """Construct a canonical textual representation of a ProcessedJob for embedding generation."""
    work_mode = infer_work_mode(job.location, job.employment_type).capitalize()

    skills_str = ", ".join(job.skills) if job.skills else "Not specified"

    exp_str = (
        f"{job.experience_years} years"
        if job.experience_years is not None
        else "Not specified"
    )
    emp_str = job.employment_type.capitalize() if job.employment_type else "Full-time"

    # Clean description: normalize whitespace, take first 1000 characters for high semantic density
    desc_clean = " ".join((job.job_description or "").split())
    if len(desc_clean) > 1000:
        desc_clean = desc_clean[:1000].rsplit(" ", 1)[0]

    lines = [
        f"Title: {job.job_title}",
        f"Company: {job.company}",
        f"Skills: {skills_str}",
        f"Location: {job.location}",
        f"Work Mode: {work_mode}",
        f"Employment Type: {emp_str}",
        f"Experience: {exp_str}",
    ]

    if desc_clean:
        lines.append(f"Description: {desc_clean}")

    return "\n".join(lines)


def build_user_preference_embedding_text(user: User) -> str | None:
    """Construct a canonical textual representation of user preferences for embedding generation.

    Returns None if the user has no ranking-relevant preferences (cold start).
    """
    # Merge profile skills and resume-extracted skills
    merged_skills: list[str] = []
    seen_skills = set()
    for s in (user.skills or []) + (user.resume_extracted_skills or []):
        s_clean = s.strip()
        if s_clean and s_clean.lower() not in seen_skills:
            seen_skills.add(s_clean.lower())
            merged_skills.append(s_clean)

    roles = [
        r.strip()
        for r in ([user.title] + (user.preferred_roles or []))
        if r and r.strip()
    ]
    # Deduplicate roles case-insensitively
    unique_roles: list[str] = []
    seen_roles = set()
    for r in roles:
        if r.lower() not in seen_roles:
            seen_roles.add(r.lower())
            unique_roles.append(r)

    locs = [
        loc.strip()
        for loc in ([user.location] + (user.preferred_locations or []))
        if loc and loc.strip()
    ]
    unique_locs: list[str] = []
    seen_locs = set()
    for loc in locs:
        if loc.lower() not in seen_locs:
            seen_locs.add(loc.lower())
            unique_locs.append(loc)

    work_modes = [
        wm.strip().capitalize() for wm in (user.work_modes or []) if wm and wm.strip()
    ]
    years_exp = user.years_of_experience or user.resume_years_total or 0
    exp_level = user.resume_experience_level or (
        infer_experience_level(years_exp) if years_exp > 0 else ""
    )

    has_preferences = bool(
        merged_skills or unique_roles or unique_locs or work_modes or years_exp > 0
    )

    if not has_preferences:
        return None

    lines = []
    if merged_skills:
        lines.append(f"Skills: {', '.join(merged_skills)}")
    if unique_roles:
        lines.append(f"Interested roles: {', '.join(unique_roles)}")
    if unique_locs:
        lines.append(f"Preferred locations: {', '.join(unique_locs)}")
    if work_modes:
        lines.append(f"Preferred work modes: {', '.join(work_modes)}")
    if years_exp > 0 or exp_level:
        exp_detail = f"{years_exp} years" if years_exp > 0 else ""
        if exp_level:
            exp_detail = f"{exp_detail} ({exp_level})".strip()
        lines.append(f"Experience: {exp_detail}")

    return "\n".join(lines)
