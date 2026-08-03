from unittest.mock import AsyncMock

import pytest

from database.models.user import User
from database.repositories.user_repository import UserRepository


def make_user() -> User:
    return User(
        auth0_sub="auth0|resume-test",
        email="resume@example.com",
        skills=["Python"],
        years_of_experience=0,
    )


@pytest.mark.anyio
async def test_save_resume_extraction_merges_skills_without_duplicates() -> None:
    db = AsyncMock()
    user = make_user()

    result = await UserRepository(db).save_resume_extraction(
        user=user,
        extracted_skills=["python", "FastAPI", "SQL"],
        experience_level="Senior",
        years_total=5,
        confidence=0.91,
    )

    assert result is user
    assert user.resume_status == "processed"
    assert user.resume_extracted_skills == ["python", "FastAPI", "SQL"]
    assert user.skills == ["Python", "FastAPI", "SQL"]
    assert user.years_of_experience == 5
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(user)


@pytest.mark.anyio
async def test_clear_resume_removes_all_resume_fields() -> None:
    db = AsyncMock()
    user = make_user()
    user.resume_file_name = "resume.pdf"
    user.resume_size_kb = 50
    user.resume_text = "resume text"
    user.resume_status = "processed"
    user.resume_extracted_skills = ["Python"]
    user.resume_experience_level = "Senior"
    user.resume_years_total = 5
    user.resume_confidence = 0.9

    await UserRepository(db).clear_resume(user)

    assert user.resume_file_name is None
    assert user.resume_text is None
    assert user.resume_status is None
    assert user.resume_extracted_skills == []
    assert user.resume_experience_level is None
    assert user.resume_years_total is None
    assert user.resume_confidence is None
