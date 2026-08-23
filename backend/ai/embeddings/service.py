"""Embedding service abstraction for generating dense vector representations.

Uses Google Gemini embedding models with thread-safe API key pooling
and configurable dimensionality.
"""

import asyncio
import logging
from itertools import cycle
from threading import Lock

from google import genai
from google.genai import types

from config.settings import settings
from utils.logging_config import log_dev

logger = logging.getLogger("embeddings")


class EmbeddingService:
    """Thread-safe embedding client supporting Google Gemini embeddings with key cycling."""

    def __init__(
        self,
        api_keys: list[str] | None = None,
        model: str | None = None,
        dimension: int | None = None,
    ):
        self.api_keys = api_keys or settings.gemini_api_keys
        self.model = model or settings.gemini_embedding_model
        self.dimension = dimension or settings.embedding_dimension

        if not self.api_keys:
            logger.warning("No Gemini API keys provided for EmbeddingService")

        self._clients = (
            [genai.Client(api_key=k) for k in self.api_keys] if self.api_keys else []
        )
        self._cycle = cycle(self._clients) if self._clients else None
        self._lock = Lock()

    def _acquire_client(self) -> genai.Client:
        if not self._clients or not self._cycle:
            raise RuntimeError("No Gemini API keys configured for embedding generation")
        with self._lock:
            return next(self._cycle)

    def embed_text(self, text: str) -> list[float]:
        """Generate a single text embedding synchronously."""
        if not text or not text.strip():
            raise ValueError("Cannot generate embedding for empty text")

        client = self._acquire_client()
        log_dev(
            "GENERATING EMBEDDING",
            {
                "model": self.model,
                "dimension": self.dimension,
                "text_length": len(text),
                "text_preview": text[:100],
            },
            logger_name="embeddings",
        )

        try:
            config = types.EmbedContentConfig(output_dimensionality=self.dimension)
            response = client.models.embed_content(
                model=self.model,
                contents=text,
                config=config,
            )
            embedding_vals = response.embeddings[0].values
            return list(embedding_vals)
        except Exception as e:
            logger.error(
                "Embedding generation failed for text '%s...': %s", text[:50], e
            )
            raise

    async def aembed_text(self, text: str) -> list[float]:
        """Generate a single text embedding asynchronously using worker thread."""
        return await asyncio.to_thread(self.embed_text, text)

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of text strings."""
        if not texts:
            return []

        results: list[list[float]] = []
        for text in texts:
            results.append(self.embed_text(text))
        return results

    async def aembed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of text strings asynchronously."""
        return await asyncio.to_thread(self.embed_batch, texts)


_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    """Return singleton instance of EmbeddingService."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
