from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    env: str
    debug: bool
    api_port: int

    database_url: str
    alembic_database_url: str

    firecrawl_api_key: str

    model_config = SettingsConfigDict(
        env_file=".env",
    )


settings = Settings()
