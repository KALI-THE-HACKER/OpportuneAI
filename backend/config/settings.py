from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    env: str
    debug: bool
    api_port: int

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

    # Cloudflare R2 resume storage (S3-compatible API)
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str | None = None
    r2_endpoint_url: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
    )


settings = Settings()
