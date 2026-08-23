from pathlib import Path

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


def get_default_admin_emails() -> list[str]:
    """Read admin emails list from config/config.yml if available."""
    config_path = BASE_DIR / "config" / "config.yml"
    if config_path.exists():
        try:
            with open(config_path, "r") as f:
                data = yaml.safe_load(f) or {}
                emails = data.get("admin_config", {}).get("admin_emails")
                if emails and isinstance(emails, list):
                    return emails
        except Exception:
            pass
    return [
        "admin@luckylinux.dev",
        "luckyverma.dev@gmail.com",
    ]


def get_default_job_expiry_days() -> int:
    """Read default job expiry days from config/config.yml if available."""
    config_path = BASE_DIR / "config" / "config.yml"
    if config_path.exists():
        try:
            with open(config_path, "r") as f:
                data = yaml.safe_load(f) or {}
                days = data.get("job_config", {}).get("default_expiry_days")
                if days is not None and isinstance(days, int):
                    return days
        except Exception:
            pass
    return 30


class Settings(BaseSettings):
    env: str
    debug: bool
    api_port: int

    default_job_expiry_days: int = Field(
        default_factory=get_default_job_expiry_days,
        validation_alias="DEFAULT_JOB_EXPIRY_DAYS",
    )

    database_url: str
    alembic_database_url: str

    # Redis Settings
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    firecrawl_api_key: str

    # LLM Settings
    llm_provider: str = "gemini"
    llm_temperature: float = 0.0

    # Gemini Settings
    gemini_api_keys: list[str]
    gemini_model: str = "gemini-2.5-flash"

    # OpenRouter Settings
    openrouter_api_key: str | None = None
    openrouter_model: str = "openai/gpt-oss-120b:free"

    # Auth0 Settings
    auth0_domain: str = ""
    auth0_api_audience: str = ""
    auth0_client_id: str = ""
    auth0_client_secret: str = ""
    auth0_connection: str = "Username-Password-Authentication"

    # Admin Settings
    admin_emails: list[str] = Field(default_factory=get_default_admin_emails)

    # Cloudflare R2 resume storage (S3-compatible API)
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str | None = None
    r2_endpoint_url: str | None = None

    feed_cache_ttl: int = 3600

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
