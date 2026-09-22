import collections
import logging
from datetime import datetime
from typing import Any

from config.settings import BASE_DIR

logger = logging.getLogger(__name__)


class LogStreamHandler(logging.Handler):
    """Custom logging handler that buffers recent log records in memory."""

    def __init__(self, capacity: int = 1000):
        super().__init__()
        self.buffer = collections.deque(maxlen=capacity)

    def emit(self, record: logging.LogRecord):
        try:
            msg = self.format(record)
            self.buffer.append(
                {
                    "timestamp": datetime.utcfromtimestamp(record.created).isoformat(),
                    "level": record.levelname,
                    "logger": record.name,
                    "message": record.getMessage(),
                    "formatted": msg,
                }
            )
        except Exception:
            self.handleError(record)


# Global singleton in-memory buffer
in_memory_log_handler = LogStreamHandler(capacity=2000)
in_memory_log_handler.setFormatter(
    logging.Formatter("%(asctime)s - %(name)s - [%(levelname)s] - %(message)s")
)


class LogStreamService:
    @classmethod
    def attach_root_logger(cls):
        """Attach in-memory handler to root and opportune loggers."""
        root = logging.getLogger()
        if in_memory_log_handler not in root.handlers:
            root.addHandler(in_memory_log_handler)

        opp_logger = logging.getLogger("opportune")
        if in_memory_log_handler not in opp_logger.handlers:
            opp_logger.addHandler(in_memory_log_handler)

        ingestion_logger = logging.getLogger("opportune.ingestion")
        if in_memory_log_handler not in ingestion_logger.handlers:
            ingestion_logger.addHandler(in_memory_log_handler)

    @classmethod
    def get_logs(
        cls,
        source: str | None = None,
        level: str | None = None,
        search: str | None = None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        """
        Retrieve buffered logs with optional source, level, and substring filtering.
        Also merges recent entries from logs/ingestion.log or ingestion.log if available.
        """
        logs = list(in_memory_log_handler.buffer)

        # If memory buffer has few logs, read from disk files
        if len(logs) < 10:
            log_paths = [
                BASE_DIR / "logs" / "ingestion.log",
                BASE_DIR / "ingestion.log",
            ]
            for path in log_paths:
                if path.exists():
                    try:
                        with open(path, "r", encoding="utf-8") as f:
                            lines = f.readlines()[-100:]
                        for line in lines:
                            if not line.strip():
                                continue
                            parts = line.strip().split(" - ", 3)
                            if len(parts) >= 4:
                                logs.append(
                                    {
                                        "timestamp": parts[0],
                                        "logger": parts[1],
                                        "level": parts[2].strip("[]"),
                                        "message": parts[3],
                                        "formatted": line.strip(),
                                    }
                                )
                            else:
                                logs.append(
                                    {
                                        "timestamp": datetime.utcnow().isoformat(),
                                        "logger": "ingestion",
                                        "level": "INFO",
                                        "message": line.strip(),
                                        "formatted": line.strip(),
                                    }
                                )
                    except Exception as e:
                        logger.debug(f"Error reading {path}: {e}")

        # Filter
        filtered = []
        for log in reversed(logs):
            if level and level.upper() != "ALL":
                if log.get("level", "").upper() != level.upper():
                    continue

            if source and source != "all":
                logger_name = log.get("logger", "").lower()
                msg_content = log.get("message", "").lower()
                if (
                    source.lower() not in logger_name
                    and f"[{source.lower()}]" not in msg_content
                ):
                    continue

            if search:
                query = search.lower()
                msg = (log.get("message", "") + " " + log.get("formatted", "")).lower()
                if query not in msg:
                    continue

            filtered.append(log)
            if len(filtered) >= limit:
                break

        return filtered
