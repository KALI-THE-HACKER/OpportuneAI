from dataclasses import dataclass
from datetime import datetime
from itertools import cycle
from threading import Lock

from langchain_google_genai import ChatGoogleGenerativeAI

from config.settings import settings


@dataclass
class ClientState:
    client: ChatGoogleGenerativeAI
    requests: int = 0
    failures: int = 0
    cooldown_until: datetime | None = None


class GeminiClientPool:
    def __init__(self):
        self._clients = [
            ChatGoogleGenerativeAI(
                model=settings.gemini_model,
                google_api_key=key,
                temperature=settings.llm_temperature,
            )
            for key in settings.gemini_api_keys
        ]

        self._cycle = cycle(self._clients)
        self._lock = Lock()

        self._states = {client: ClientState(client=client) for client in self._clients}

    def acquire(self):
        with self._lock:
            client = next(self._cycle)
            self._states[client].requests += 1
            return client

    def mark_failure(self, client: ChatGoogleGenerativeAI) -> None:
        """Record a failed request for a client."""
        with self._lock:
            self._states[client].failures += 1

    def state(self, client: ChatGoogleGenerativeAI) -> ClientState:
        """Return the tracked state for a client."""
        return self._states[client]


_pool: GeminiClientPool | None = None


def get_pool() -> GeminiClientPool:
    """Return the singleton Gemini client pool."""
    global _pool

    if _pool is None:
        _pool = GeminiClientPool()

    return _pool
