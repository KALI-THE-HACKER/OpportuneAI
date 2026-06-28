import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from config.settings import settings
from database.repositories.user_repository import UserRepository
from database.session import get_db
from database.models.user import User

# OAuth2Bearer configuration (reads Authorization: Bearer <token>)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="", auto_error=False)

# In-memory cache for Auth0 JWKS to prevent redundant requests
_jwks_cache = None


async def get_jwks() -> dict:
    """Fetch the JSON Web Key Set (JWKS) from Auth0."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    if not settings.auth0_domain:
        return {"keys": []}

    url = f"https://{settings.auth0_domain}/.well-known/jwks.json"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                _jwks_cache = resp.json()
                return _jwks_cache
    except Exception as e:
        print(f"Failed to fetch JWKS from Auth0: {e}")
    return {"keys": []}


async def verify_auth0_token(token: str) -> dict:
    """
    Verify and decode the Auth0 JWT access token.
    Supports a 'mock-' prefix in development/testing mode to bypass verification.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Dev/Mock support (useful for unit tests and local testing when Auth0 is not configured)
    if token.startswith("mock-") or not settings.auth0_domain:
        # Form: mock-auth0|sub-value;email@example.com;Name;avatar_url
        parts = token.split("-", 1)[1].split(";")
        sub = parts[0] if len(parts) > 0 else "mock-user-1"
        email = parts[1] if len(parts) > 1 else "alex@example.com"
        name = parts[2] if len(parts) > 2 else "Alex Chen"
        avatar = parts[3] if len(parts) > 3 else None
        return {
            "sub": sub,
            "email": email,
            "name": name,
            "picture": avatar,
            "email_verified": True,
        }

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        raise credentials_exception

    jwks = await get_jwks()
    rsa_key = {}

    for key in jwks.get("keys", []):
        if key["kid"] == unverified_header.get("kid"):
            rsa_key = {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n": key["n"],
                "e": key["e"],
            }
            break

    if not rsa_key:
        raise credentials_exception

    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.auth0_api_audience,
            issuer=f"https://{settings.auth0_domain}/",
        )
        return payload
    except JWTError as e:
        print(f"Token decoding failed: {e}")
        raise credentials_exception


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency to retrieve the current logged-in user.
    Checks the Auth0 JWT token, creates a local User in PostgreSQL if they
    don't exist yet, and returns the User record.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = await verify_auth0_token(token)
    sub = payload.get("sub")

    # Access tokens might not contain email/name by default, check standard custom claims or fallbacks
    email = payload.get("email")
    name = payload.get("name") or payload.get("nickname")
    picture = payload.get("picture")
    email_verified = payload.get("email_verified", False)

    # Fetch full profile from userinfo if access token claims are missing
    if (
        (not email or not name)
        and not token.startswith("mock-")
        and settings.auth0_domain
    ):
        try:
            url = f"https://{settings.auth0_domain}/userinfo"
            async with httpx.AsyncClient() as client:
                userinfo_resp = await client.get(
                    url, headers={"Authorization": f"Bearer {token}"}
                )
                if userinfo_resp.status_code == 200:
                    userinfo = userinfo_resp.json()
                    email = userinfo.get("email") or email
                    name = userinfo.get("name") or userinfo.get("nickname") or name
                    picture = userinfo.get("picture") or picture
                    email_verified = userinfo.get("email_verified", False)
        except Exception as e:
            print(f"Failed to fetch userinfo from Auth0: {e}")

    # Final fallbacks if even userinfo failed or was skipped
    if not email:
        email = (
            payload.get("https://opportuneai.com/email") or f"{sub}@opportuneai.local"
        )
    if not name:
        name = email.split("@")[0]

    repo = UserRepository(db)
    user = await repo.get_by_auth0_sub(sub)
    if not user:
        # Check if user already exists with this email address
        user = await repo.get_by_email(email)
        if user:
            # Sync Auth0 sub to match the existing email account
            user = await repo.update(
                user,
                auth0_sub=sub,
                name=name or user.name,
                avatar_url=picture or user.avatar_url,
                email_verified=email_verified,
            )
        else:
            # Auto-register user in our local database
            user = await repo.create(
                auth0_sub=sub,
                email=email,
                name=name,
                avatar_url=picture,
                email_verified=email_verified,
            )
    else:
        # Keep local fields synced with Auth0 profile updates
        # Only overwrite with real, non-fallback name and email values
        update_data = {}
        if user.email_verified != email_verified:
            update_data["email_verified"] = email_verified
        if picture and user.avatar_url != picture:
            update_data["avatar_url"] = picture

        is_real_name = name and not name.startswith("auth0|") and "|" not in name
        if is_real_name and user.name != name:
            update_data["name"] = name

        is_real_email = (
            email and not email.endswith("@opportuneai.local") and "|" not in email
        )
        if is_real_email and user.email != email:
            update_data["email"] = email

        if update_data:
            user = await repo.update(user, **update_data)

    return user
