from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from config.settings import settings
from database.models.user import User
from database.repositories.activity_repository import ActivityRepository
from database.repositories.user_repository import UserRepository
from database.session import get_db
from utils.auth import determine_user_role, get_current_user

router = APIRouter()


def extract_auth0_error(err_json: dict, default_detail: str) -> str:
    """Extract a user-friendly string error from Auth0 error payloads."""
    if "error_description" in err_json:
        return str(err_json["error_description"])

    msg = err_json.get("message")
    if msg and isinstance(msg, str):
        return msg

    desc = err_json.get("description")
    if desc:
        if isinstance(desc, dict):
            desc_msg = desc.get("message") or desc.get("error")
            if desc_msg and isinstance(desc_msg, str):
                return desc_msg
        elif isinstance(desc, str):
            return desc

    if msg and isinstance(msg, dict):
        msg_val = msg.get("message") or msg.get("error")
        if msg_val and isinstance(msg_val, str):
            return msg_val

    err_code = err_json.get("error") or err_json.get("code")
    if err_code and isinstance(err_code, str):
        return err_code

    return default_detail


# Pydantic Schemas
class UserProfileSchema(BaseModel):
    id: str
    name: str | None = None
    email: str
    role: str = "user"
    title: str = ""
    location: str = ""
    avatarUrl: str | None = None
    bio: str = ""
    yearsOfExperience: int = 0
    skills: list[str] = []
    preferredRoles: list[str] = []
    preferredLocations: list[str] = []
    workModes: list[str] = []
    minSalary: int = 0
    willingToRelocate: bool = False
    emailVerified: bool = False
    hasResume: bool = False
    resumeFileName: str | None = None
    resumeStatus: str | None = None

    @classmethod
    def from_orm_model(cls, user: User) -> "UserProfileSchema":
        return cls(
            id=user.auth0_sub,
            name=user.name,
            email=user.email,
            role=user.role or "user",
            title=user.title,
            location=user.location,
            avatarUrl=user.avatar_url,
            bio=user.bio,
            yearsOfExperience=user.years_of_experience,
            skills=user.skills or [],
            preferredRoles=user.preferred_roles or [],
            preferredLocations=user.preferred_locations or [],
            workModes=user.work_modes or [],
            minSalary=user.min_salary,
            willingToRelocate=bool(getattr(user, "willing_to_relocate", False)),
            emailVerified=user.email_verified,
            hasResume=bool(
                user.resume_file_name
                or user.resume_storage_key
                or (user.resume_status and user.resume_status != "failed")
            ),
            resumeFileName=user.resume_file_name,
            resumeStatus=user.resume_status,
        )


class UserProfileUpdateSchema(BaseModel):
    name: str | None = None
    title: str | None = None
    location: str | None = None
    avatarUrl: str | None = None
    bio: str | None = None
    yearsOfExperience: int | None = None
    skills: list[str] | None = None
    preferredRoles: list[str] | None = None
    preferredLocations: list[str] | None = None
    workModes: list[str] | None = None
    minSalary: int | None = None
    willingToRelocate: bool | None = None


class LoginInputSchema(BaseModel):
    email: str
    password: str


class RegisterInputSchema(BaseModel):
    name: str
    email: str
    password: str


class SessionSchema(BaseModel):
    token: str | None = None
    user: UserProfileSchema | None = None
    expiresAt: int | None = None
    message: str | None = None


@router.get("/api/auth/me", response_model=UserProfileSchema)
async def get_me(user: User = Depends(get_current_user)):
    """Retrieve the current logged-in user profile."""
    return UserProfileSchema.from_orm_model(user)


@router.put("/api/users/me", response_model=UserProfileSchema)
async def update_me(
    data: UserProfileUpdateSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user profile information."""
    repo = UserRepository(db)

    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.title is not None:
        update_data["title"] = data.title
    if data.location is not None:
        update_data["location"] = data.location
    if data.avatarUrl is not None:
        update_data["avatar_url"] = data.avatarUrl
    if data.bio is not None:
        update_data["bio"] = data.bio
    if data.yearsOfExperience is not None:
        update_data["years_of_experience"] = data.yearsOfExperience
    if data.skills is not None:
        update_data["skills"] = data.skills
    if data.preferredRoles is not None:
        update_data["preferred_roles"] = data.preferredRoles
    if data.preferredLocations is not None:
        update_data["preferred_locations"] = data.preferredLocations
    if data.workModes is not None:
        update_data["work_modes"] = data.workModes
    if data.minSalary is not None:
        update_data["min_salary"] = data.minSalary
    if data.willingToRelocate is not None:
        update_data["willing_to_relocate"] = data.willingToRelocate

    ranking_fields = {
        "title",
        "location",
        "years_of_experience",
        "skills",
        "preferred_roles",
        "preferred_locations",
        "work_modes",
        "min_salary",
        "willing_to_relocate",
    }
    has_ranking_change = any(k in ranking_fields for k in update_data.keys())

    updated_user = await repo.update(user, **update_data)

    if has_ranking_change:
        try:
            from services.user_embedding_service import UserEmbeddingService

            await UserEmbeddingService(db).sync_user_preference_embedding(updated_user)
        except Exception:
            pass

    if update_data:
        try:
            activity_repo = ActivityRepository(db)
            await activity_repo.create(
                user_id=user.id,
                activity_type="system",
                title="Profile updated",
                body="Your career preferences and target roles were updated.",
            )
        except Exception:
            pass

    return UserProfileSchema.from_orm_model(updated_user)


@router.post("/api/auth/login", response_model=SessionSchema)
async def login(data: LoginInputSchema, db: AsyncSession = Depends(get_db)):
    """Authenticate email and password using Auth0 and synchronize profile."""
    if settings.auth0_client_id == "mock_client_id":
        repo = UserRepository(db)
        user = await repo.get_by_email(data.email)
        if not user:
            user = await repo.create(
                auth0_sub=f"auth0|mock-{data.email.split('@')[0]}",
                email=data.email,
                name=data.email.split("@")[0].capitalize(),
                role=determine_user_role(data.email),
                email_verified=True,
            )
        elif determine_user_role(data.email) == "admin" and user.role != "admin":
            user = await repo.update(user, role="admin")
        token = (
            f"mock-auth0|{user.auth0_sub};{user.email};{user.name};{user.avatar_url}"
        )
        expires_at = int((datetime.utcnow() + timedelta(days=7)).timestamp() * 1000)
        return SessionSchema(
            token=token,
            user=UserProfileSchema.from_orm_model(user),
            expiresAt=expires_at,
        )

    # Real Auth0 login flow
    url = f"https://{settings.auth0_domain}/oauth/token"
    payload = {
        "grant_type": "http://auth0.com/oauth/grant-type/password-realm",
        "username": data.email,
        "password": data.password,
        "audience": settings.auth0_api_audience,
        "scope": "openid profile email",
        "client_id": settings.auth0_client_id,
        "client_secret": settings.auth0_client_secret,
        "realm": settings.auth0_connection,
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                detail = "Authentication failed"
                try:
                    err_json = resp.json()
                    print(
                        f"[AUTH0 LOGIN ERROR] Status: {resp.status_code}, Payload: {err_json}"
                    )
                    detail = extract_auth0_error(err_json, detail)
                except Exception as e:
                    print(f"[AUTH0 LOGIN PARSE ERROR] {e}")
                raise HTTPException(status_code=resp.status_code, detail=detail)

            resp_data = resp.json()
            access_token = resp_data["access_token"]
            expires_in = resp_data.get("expires_in", 86400)

            # Synchronize user profile locally
            user = await get_current_user(token=access_token, db=db)

            # Enforce email verification
            if not user.email_verified:
                raise HTTPException(
                    status_code=403,
                    detail="Please verify your email address before signing in. Check your inbox for the verification link.",
                )

            expires_at = int(
                (datetime.utcnow() + timedelta(seconds=expires_in)).timestamp() * 1000
            )
            return SessionSchema(
                token=access_token,
                user=UserProfileSchema.from_orm_model(user),
                expiresAt=expires_at,
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Auth0 service error: {str(e)}")


@router.post("/api/auth/register", response_model=SessionSchema)
async def register(data: RegisterInputSchema, db: AsyncSession = Depends(get_db)):
    """Create a new user profile inside Auth0 and PostgreSQL databases."""
    if settings.auth0_client_id == "mock_client_id":
        repo = UserRepository(db)
        user = await repo.get_by_email(data.email)
        if user:
            raise HTTPException(status_code=400, detail="User already exists")
        user = await repo.create(
            auth0_sub=f"auth0|mock-{data.email.split('@')[0]}",
            email=data.email,
            name=data.name,
            role=determine_user_role(data.email),
            email_verified=False,
        )
        return SessionSchema(
            token=None,
            user=UserProfileSchema.from_orm_model(user),
            expiresAt=None,
            message="Registration succeeded! Please check your email to verify your account, then sign in.",
        )

    # Real Auth0 DB signup flow
    signup_url = f"https://{settings.auth0_domain}/dbconnections/signup"
    signup_payload = {
        "client_id": settings.auth0_client_id,
        "email": data.email,
        "password": data.password,
        "connection": settings.auth0_connection,
        "user_metadata": {"name": data.name},
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(signup_url, json=signup_payload)
            if resp.status_code != 200:
                detail = "Registration failed"
                try:
                    err_json = resp.json()
                    print(
                        f"[AUTH0 SIGNUP ERROR] Status: {resp.status_code}, Payload: {err_json}"
                    )
                    detail = extract_auth0_error(err_json, detail)
                except Exception as e:
                    print(f"[AUTH0 SIGNUP PARSE ERROR] {e}")
                raise HTTPException(status_code=resp.status_code, detail=detail)

            # Sync the created user immediately to our local PostgreSQL database with email_verified=False
            resp_data = resp.json()
            auth0_id = resp_data.get("_id") or resp_data.get("id") or ""
            auth0_sub = (
                auth0_id if auth0_id.startswith("auth0|") else f"auth0|{auth0_id}"
            )

            repo = UserRepository(db)
            user = await repo.get_by_auth0_sub(auth0_sub)
            if not user:
                user = await repo.create(
                    auth0_sub=auth0_sub,
                    email=data.email,
                    name=data.name,
                    role=determine_user_role(data.email),
                    email_verified=False,
                )

            return SessionSchema(
                token=None,
                user=UserProfileSchema.from_orm_model(user),
                expiresAt=None,
                message="Registration succeeded! Please check your email to verify your account, then sign in.",
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Auth0 service error: {str(e)}")


class ResendVerificationInputSchema(BaseModel):
    email: str


@router.post("/api/auth/resend-verification")
async def resend_verification(
    data: ResendVerificationInputSchema, db: AsyncSession = Depends(get_db)
):
    """Resend Auth0 email verification link."""
    repo = UserRepository(db)
    user = await repo.get_by_email(data.email)
    if not user:
        return {
            "message": "If an account exists with this email, a verification link has been sent."
        }

    if user.email_verified:
        return {"message": "Email is already verified. You can sign in."}

    if (
        settings.auth0_domain
        and settings.auth0_client_id
        and settings.auth0_client_secret
    ):
        try:
            # Fetch Auth0 Management API token
            token_url = f"https://{settings.auth0_domain}/oauth/token"
            token_payload = {
                "grant_type": "client_credentials",
                "client_id": settings.auth0_client_id,
                "client_secret": settings.auth0_client_secret,
                "audience": f"https://{settings.auth0_domain}/api/v2/",
            }
            async with httpx.AsyncClient() as client:
                token_resp = await client.post(token_url, json=token_payload)
                if token_resp.status_code == 200:
                    mgmt_token = token_resp.json().get("access_token")
                    job_url = f"https://{settings.auth0_domain}/api/v2/jobs/verification-email"
                    await client.post(
                        job_url,
                        json={"user_id": user.auth0_sub},
                        headers={"Authorization": f"Bearer {mgmt_token}"},
                    )
        except Exception as e:
            print(f"[AUTH0 RESEND VERIFICATION ERROR] {e}")

    return {
        "message": "If an account exists with this email, a verification link has been sent."
    }
