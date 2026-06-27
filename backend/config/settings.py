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

    model_config = SettingsConfigDict(
        env_file=".env",
    )


settings = Settings()
