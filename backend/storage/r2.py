"""Private Cloudflare R2 storage for uploaded resumes."""

import asyncio
from functools import cached_property
from uuid import uuid4

import boto3
from botocore.client import BaseClient

from config.settings import settings


class R2StorageError(RuntimeError):
    """Raised when resume object storage is unavailable or fails."""


class ResumeStorage:
    """S3-compatible client wrapper for the application's private R2 bucket."""

    def is_configured(self) -> bool:
        """Check if Cloudflare R2 is configured with non-placeholder credentials."""
        required = [
            settings.r2_account_id,
            settings.r2_access_key_id,
            settings.r2_secret_access_key,
            settings.r2_bucket_name,
        ]
        if not all(required):
            return False
        for val in required:
            val_str = str(val).strip()
            if (
                val_str.startswith("<")
                or "account-id" in val_str
                or "access-key-id" in val_str
                or "secret-access-key" in val_str
            ):
                return False
        return True

    def _validate_settings(self) -> None:
        if not self.is_configured():
            raise R2StorageError(
                "Cloudflare R2 is not configured or contains placeholder credentials."
            )

    @cached_property
    def _client(self) -> BaseClient:
        self._validate_settings()
        endpoint_url = (
            settings.r2_endpoint_url
            if settings.r2_endpoint_url
            and "cloudflarestorage.com" in settings.r2_endpoint_url
            else f"https://{settings.r2_account_id}.r2.cloudflarestorage.com"
        )
        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
        )

    async def upload_resume(self, user_id: int, file_bytes: bytes) -> str:
        """Store a PDF privately and return its opaque object key."""
        self._validate_settings()
        key = f"resumes/{user_id}/{uuid4().hex}.pdf"
        try:
            await asyncio.to_thread(
                self._client.put_object,
                Bucket=settings.r2_bucket_name,
                Key=key,
                Body=file_bytes,
                ContentType="application/pdf",
            )
        except Exception as exc:
            raise R2StorageError("Failed to upload resume to Cloudflare R2") from exc
        return key

    async def delete_resume(self, storage_key: str) -> None:
        """Delete a private resume object by key."""
        if not storage_key:
            return
        self._validate_settings()
        try:
            await asyncio.to_thread(
                self._client.delete_object,
                Bucket=settings.r2_bucket_name,
                Key=storage_key,
            )
        except Exception as exc:
            raise R2StorageError("Failed to delete resume from Cloudflare R2") from exc

    async def get_presigned_download_url(
        self, storage_key: str, expires_in: int = 900
    ) -> str:
        """Generate a short-lived pre-signed URL for private downloading."""
        if not storage_key:
            raise R2StorageError("Storage key is required")
        self._validate_settings()
        try:
            url = await asyncio.to_thread(
                self._client.generate_presigned_url,
                "get_object",
                Params={
                    "Bucket": settings.r2_bucket_name,
                    "Key": storage_key,
                    "ResponseContentType": "application/pdf",
                },
                ExpiresIn=expires_in,
            )
            return url
        except Exception as exc:
            raise R2StorageError("Failed to generate pre-signed URL") from exc


resume_storage = ResumeStorage()
