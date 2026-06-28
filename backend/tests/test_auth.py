import pytest

from database.session import AsyncSessionLocal
from database.repositories.user_repository import UserRepository
from utils.auth import verify_auth0_token, get_current_user
from routes.auth import get_me, update_me, UserProfileUpdateSchema


@pytest.fixture
def anyio_backend() -> str:
    """Run AnyIO tests using the asyncio backend only."""
    return "asyncio"


@pytest.mark.anyio
async def test_auth_and_profile_sync(dispose_db_engine):
    """
    Test Auth0 token verification, local user sync in PostgreSQL,
    and profile retrieval/update routes.
    """
    from config.settings import settings

    original_client_id = settings.auth0_client_id
    settings.auth0_client_id = "mock_client_id"

    # 1. Test mock token parsing
    mock_token = (
        "mock-auth0|test-sub-999;pm@opportune.ai;Pam PM;https://example.com/pam.jpg"
    )

    payload = await verify_auth0_token(mock_token)
    assert payload["sub"] == "auth0|test-sub-999"
    assert payload["email"] == "pm@opportune.ai"
    assert payload["name"] == "Pam PM"
    assert payload["picture"] == "https://example.com/pam.jpg"

    # 2. Test get_current_user dependency (should auto-create the user in DB)
    async with AsyncSessionLocal() as db:
        user = await get_current_user(token=mock_token, db=db)
        assert user.auth0_sub == "auth0|test-sub-999"
        assert user.email == "pm@opportune.ai"
        assert user.name == "Pam PM"
        assert user.avatar_url == "https://example.com/pam.jpg"

        # Verify record exists in PostgreSQL database via repository
        repo = UserRepository(db)
        db_user = await repo.get_by_auth0_sub("auth0|test-sub-999")
        assert db_user is not None
        assert db_user.id == user.id

        # 3. Test get_me endpoint business logic
        profile_res = await get_me(user=user)
        assert profile_res.id == "auth0|test-sub-999"
        assert profile_res.email == "pm@opportune.ai"
        assert profile_res.name == "Pam PM"
        assert profile_res.avatarUrl == "https://example.com/pam.jpg"

        # 4. Test update_me endpoint business logic
        update_data = UserProfileUpdateSchema(
            title="Senior Product Manager",
            location="San Francisco, CA",
            bio="Building AI career copilots.",
            yearsOfExperience=7,
            skills=["Product Management", "AI", "Agile"],
            preferredRoles=["Director of Product", "Lead PM"],
            preferredLocations=["Remote", "San Francisco, CA"],
            workModes=["remote", "hybrid"],
            minSalary=180000,
        )

        updated_profile = await update_me(data=update_data, user=user, db=db)
        assert updated_profile.title == "Senior Product Manager"
        assert updated_profile.location == "San Francisco, CA"
        assert updated_profile.bio == "Building AI career copilots."
        assert updated_profile.yearsOfExperience == 7
        assert "Product Management" in updated_profile.skills
        assert "remote" in updated_profile.workModes
        assert updated_profile.minSalary == 180000

        # Verify update is saved to database
        db_user_after = await repo.get_by_id(user.id)
        assert db_user_after.title == "Senior Product Manager"
        assert db_user_after.years_of_experience == 7
        assert db_user_after.min_salary == 180000

        # 5. Test login route function in mock mode
        from routes.auth import login, register, LoginInputSchema, RegisterInputSchema

        login_data = LoginInputSchema(email="pm@opportune.ai", password="somepassword")
        login_res = await login(data=login_data, db=db)
        assert login_res.token.startswith("mock-")
        assert login_res.user.email == "pm@opportune.ai"

        # 6. Test register route function in mock mode
        register_data = RegisterInputSchema(
            name="New User", email="newuser@opportune.ai", password="somepassword"
        )
        register_res = await register(data=register_data, db=db)
        assert register_res.token.startswith("mock-")
        assert register_res.user.email == "newuser@opportune.ai"
        assert register_res.user.name == "New User"

        # Clean up new user
        db_new_user = await repo.get_by_email("newuser@opportune.ai")
        if db_new_user:
            await db.delete(db_new_user)

        # Clean up database test record
        await db.delete(db_user_after)
        await db.commit()

    settings.auth0_client_id = original_client_id
