import pytest

from database.repositories.user_repository import UserRepository
from database.session import AsyncSessionLocal
from routes.auth import UserProfileUpdateSchema, get_me, update_me
from utils.auth import get_current_user, verify_auth0_token


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

    # Test Google OAuth mock token format
    google_mock_token = "mock-google-oauth2|g-12345;google.user@opportune.ai;Google User;https://example.com/google.jpg"
    google_payload = await verify_auth0_token(google_mock_token)
    assert google_payload["sub"] == "google-oauth2|g-12345"
    assert google_payload["email"] == "google.user@opportune.ai"
    assert google_payload["name"] == "Google User"

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
        assert db_user.role == "user"

        # 3. Test get_me endpoint business logic
        profile_res = await get_me(user=user)
        assert profile_res.id == "auth0|test-sub-999"
        assert profile_res.email == "pm@opportune.ai"
        assert profile_res.name == "Pam PM"
        assert profile_res.avatarUrl == "https://example.com/pam.jpg"
        assert profile_res.role == "user"

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
        from routes.auth import LoginInputSchema, RegisterInputSchema, login, register

        login_data = LoginInputSchema(email="pm@opportune.ai", password="somepassword")
        login_res = await login(data=login_data, db=db)
        assert login_res.token.startswith("mock-")
        assert login_res.user.email == "pm@opportune.ai"
        assert login_res.user.role == "user"

        # 6. Test register route function in mock mode (defaults to user role)
        existing_new_user = await repo.get_by_email("newuser@opportune.ai")
        if existing_new_user:
            await db.delete(existing_new_user)
            await db.commit()

        register_data = RegisterInputSchema(
            name="New User", email="newuser@opportune.ai", password="somepassword"
        )
        register_res = await register(data=register_data, db=db)
        assert register_res.token is None
        assert "verify" in (register_res.message or "").lower()
        assert register_res.user.email == "newuser@opportune.ai"
        assert register_res.user.name == "New User"
        assert register_res.user.role == "user"

        # 7. Test admin role determination for configured admin emails
        admin_mock_token = "mock-auth0|admin-sub-1;admin@opportuneai.com;Admin User;https://example.com/admin.jpg"
        admin_user = await get_current_user(token=admin_mock_token, db=db)
        assert admin_user.role == "admin"

        # Clean up admin user
        db_admin_user = await repo.get_by_auth0_sub("auth0|admin-sub-1")
        if db_admin_user:
            await db.delete(db_admin_user)

        # Clean up new user
        db_new_user = await repo.get_by_email("newuser@opportune.ai")
        if db_new_user:
            await db.delete(db_new_user)

        # Clean up database test record
        await db.delete(db_user_after)
        await db.commit()

    settings.auth0_client_id = original_client_id
