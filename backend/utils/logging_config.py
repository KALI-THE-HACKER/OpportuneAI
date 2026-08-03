"""Feature-specific application logging with verbose development mode AI tracing."""

import json
import logging
from logging.handlers import RotatingFileHandler
from typing import Any

from config.settings import BASE_DIR, settings

LOG_DIR = BASE_DIR / "logs"
_FORMATTER = logging.Formatter(
    "%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


def get_feature_logger(feature: str) -> logging.Logger:
    """Return a rotating logger which writes to ``logs/<feature>.log``."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(f"opportune.{feature}")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    log_path = LOG_DIR / f"{feature}.log"
    if not any(
        isinstance(handler, RotatingFileHandler)
        and getattr(handler, "baseFilename", None) == str(log_path)
        for handler in logger.handlers
    ):
        handler = RotatingFileHandler(
            log_path,
            maxBytes=5 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        )
        handler.setFormatter(_FORMATTER)
        logger.addHandler(handler)

        if settings.env == "development" or settings.debug:
            stream_handler = logging.StreamHandler()
            stream_handler.setFormatter(_FORMATTER)
            logger.addHandler(stream_handler)

    return logger


def log_dev(label: str, payload: Any, logger_name: str = "ai") -> None:
    """Log formatted development information when ENV == 'development' or DEBUG is True.

    Outputs prominent blocks labeled under [DEV_LOGS] to both console and feature log files.
    """
    if settings.env != "development" and not settings.debug:
        return

    logger = get_feature_logger(logger_name)
    header = f"==================== [DEV_LOGS] [{label.upper()}] ===================="
    footer = "=" * len(header)

    if isinstance(payload, (dict, list)):
        try:
            formatted_payload = json.dumps(payload, indent=2, default=str)
        except Exception:
            formatted_payload = str(payload)
    elif hasattr(payload, "model_dump"):
        try:
            formatted_payload = json.dumps(payload.model_dump(), indent=2, default=str)
        except Exception:
            formatted_payload = str(payload)
    else:
        formatted_payload = str(payload or "")

    msg = f"\n{header}\n{formatted_payload}\n{footer}"
    logger.info(msg)


def configure_logging() -> None:
    """Initialise feature log files for API, resume, worker, ingestion, and AI flows."""
    for feature in ("api", "resume", "worker", "ingestion", "ai"):
        get_feature_logger(feature)
