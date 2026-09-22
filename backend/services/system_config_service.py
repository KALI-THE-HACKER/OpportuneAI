import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config.settings import settings
from database.models.system_config import SystemConfig
from database.session import AsyncSessionLocal
from utils.encryption import decrypt_secret, encrypt_secret

logger = logging.getLogger(__name__)

# Default system settings when DB is empty
DEFAULT_CONFIGS: dict[str, dict[str, Any]] = {
    "llm_config": {
        "category": "llm",
        "description": "LLM extraction and reasoning configuration",
        "value": {
            "provider": getattr(settings, "llm_provider", "gemini"),
            "model": getattr(settings, "gemini_model", "gemini-2.5-flash"),
            "temperature": getattr(settings, "llm_temperature", 0.0),
            "openrouter_model": getattr(
                settings, "openrouter_model", "openai/gpt-oss-120b:free"
            ),
        },
    },
    "scraper_config": {
        "category": "scrapers",
        "description": "Scraper rate limits, timeouts, and query settings",
        "value": {
            "request_timeout_seconds": 30,
            "max_jobs_per_provider": 50,
            "default_search_role": "Software Engineer",
            "enabled_providers": {
                "linkedin": True,
                "naukri": True,
                "wellfound": True,
                "remoteok": True,
            },
        },
    },
    "retry_policy": {
        "category": "retry_policy",
        "description": "Automatic retry policies for scrapers and AI processing",
        "value": {
            "max_retries": 3,
            "base_backoff_seconds": 60,
            "retry_after_2h_on_blocked": True,
            "blocked_delay_seconds": 7200,  # 2 hours
        },
    },
    "scheduler_config": {
        "category": "scheduler",
        "description": "Scraper cron schedule (default: 2 AM daily UTC)",
        "value": {
            "enabled": True,
            "cron_expression": "0 2 * * *",
            "timezone": "UTC",
            "trigger_all_providers": True,
        },
    },
    "feature_flags": {
        "category": "feature_flags",
        "description": "Global system feature toggles",
        "value": {
            "enable_hybrid_recommendations": True,
            "enable_email_alerts": True,
            "enable_auto_ai_processing": True,
            "maintenance_mode": False,
        },
    },
    "notification_config": {
        "category": "notifications",
        "description": "Admin email alert rules and recipients",
        "value": {
            "alert_on_scraper_failure": True,
            "alert_on_repeated_retry": True,
            "alert_on_provider_blocked": True,
            "alert_on_critical_error": True,
            "recipient_emails": list(getattr(settings, "admin_emails", []))
            or ["admin@luckylinux.dev", "luckyverma.dev@gmail.com"],
            "smtp_enabled": getattr(settings, "smtp_enabled", False),
            "smtp_provider": getattr(settings, "smtp_provider", "google"),
            "smtp_host": getattr(settings, "smtp_host", "smtp.gmail.com"),
            "smtp_port": getattr(settings, "smtp_port", 587),
            "smtp_user": getattr(settings, "smtp_user", ""),
            "smtp_pass": getattr(settings, "smtp_password", ""),
            "smtp_from": getattr(settings, "smtp_from_email", "")
            or getattr(settings, "smtp_user", "")
            or "alerts@opportuneai.com",
            "smtp_use_tls": getattr(settings, "smtp_use_tls", True),
            "smtp_use_ssl": getattr(settings, "smtp_use_ssl", False),
        },
    },
}


def _mask_nested_secrets(data: Any) -> Any:
    """Recursively mask sensitive values matching password, secret, or token patterns."""
    if isinstance(data, dict):
        masked: dict[str, Any] = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if (
                any(s in k_lower for s in ("pass", "secret", "token"))
                and isinstance(v, str)
                and v
            ):
                masked[k] = "••••••••"
            elif isinstance(v, (dict, list)):
                masked[k] = _mask_nested_secrets(v)
            else:
                masked[k] = v
        return masked
    elif isinstance(data, list):
        return [_mask_nested_secrets(item) for item in data]
    return data


class SystemConfigService:
    _cache: dict[str, Any] = {}
    _cache_loaded: bool = False

    @classmethod
    async def get_config(
        cls, key: str, db: AsyncSession | None = None, use_cache: bool = True
    ) -> dict[str, Any]:
        """Get config value for a key with fallback to defaults."""
        if use_cache and key in cls._cache:
            return cls._cache[key]

        if db is None:
            async with AsyncSessionLocal() as session:
                return await cls._get_config_from_db(key, session)
        return await cls._get_config_from_db(key, db)

    @classmethod
    async def _get_config_from_db(cls, key: str, db: AsyncSession) -> dict[str, Any]:
        stmt = select(SystemConfig).where(SystemConfig.key == key)
        result = await db.scalar(stmt)

        if result:
            val = result.value_json
            if result.is_secret and isinstance(val, str):
                val = decrypt_secret(val)
            cls._cache[key] = val
            return val

        # Fallback to default
        if key in DEFAULT_CONFIGS:
            default_val = DEFAULT_CONFIGS[key]["value"]
            cls._cache[key] = default_val
            return default_val

        return {}

    @classmethod
    async def get_all_configs(cls, db: AsyncSession) -> dict[str, Any]:
        """Retrieve all configuration sections merged with defaults."""
        stmt = select(SystemConfig)
        results = (await db.scalars(stmt)).all()
        db_configs = {c.key: c for c in results}

        output: dict[str, Any] = {}
        for key, meta in DEFAULT_CONFIGS.items():
            if key in db_configs:
                row = db_configs[key]
                val = row.value_json
                display_val = val
                if row.is_secret and isinstance(val, str):
                    val = decrypt_secret(val)
                    display_val = "••••••••"
                else:
                    display_val = _mask_nested_secrets(val)

                output[key] = {
                    "category": row.category,
                    "description": row.description or meta["description"],
                    "value": display_val,
                    "updated_at": row.updated_at.isoformat()
                    if row.updated_at
                    else None,
                    "updated_by_email": row.updated_by_email,
                }
                cls._cache[key] = val
            else:
                output[key] = {
                    "category": meta["category"],
                    "description": meta["description"],
                    "value": _mask_nested_secrets(meta["value"]),
                    "updated_at": None,
                    "updated_by_email": "default",
                }
                cls._cache[key] = meta["value"]

        return output

    @classmethod
    async def update_config(
        cls,
        key: str,
        value: Any,
        user_email: str | None,
        db: AsyncSession,
        is_secret: bool = False,
        user_id: int | None = None,
    ) -> SystemConfig:
        """Update or insert a config value and invalidate cache."""
        category = DEFAULT_CONFIGS.get(key, {}).get("category", "general")
        description = DEFAULT_CONFIGS.get(key, {}).get("description", "")

        stored_value = value
        if is_secret and isinstance(value, str):
            stored_value = encrypt_secret(value)

        stmt = select(SystemConfig).where(SystemConfig.key == key)
        existing = await db.scalar(stmt)

        # If incoming value is a dict, preserve existing stored secret if incoming value is masked or placeholder
        if isinstance(value, dict):
            baseline_dict = {}
            if existing and isinstance(existing.value_json, dict):
                baseline_dict = existing.value_json
            elif not existing and isinstance(
                DEFAULT_CONFIGS.get(key, {}).get("value"), dict
            ):
                baseline_dict = DEFAULT_CONFIGS[key]["value"]

            if baseline_dict:
                merged = dict(value)
                for k, v in baseline_dict.items():
                    k_lower = str(k).lower()
                    if any(s in k_lower for s in ("pass", "secret", "token")):
                        incoming_val = merged.get(k)
                        if incoming_val in ("••••••••", "", None) and v:
                            merged[k] = v
                stored_value = merged
                value = merged

        if existing:
            existing.value_json = stored_value
            existing.is_secret = is_secret
            existing.updated_by_user_id = user_id
            existing.updated_by_email = user_email
            existing.updated_at = datetime.utcnow()
            config_row = existing
        else:
            config_row = SystemConfig(
                key=key,
                category=category,
                value_json=stored_value,
                is_secret=is_secret,
                description=description,
                updated_by_user_id=user_id,
                updated_by_email=user_email,
                updated_at=datetime.utcnow(),
            )
            db.add(config_row)

        await db.commit()
        await db.refresh(config_row)

        # Invalidate in-memory cache
        cls._cache[key] = value
        logger.info(f"SystemConfig updated: key={key} by={user_email}")
        return config_row
