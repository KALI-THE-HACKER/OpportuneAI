"""Resume API routes.

Endpoints:
  POST /api/resume/upload  — multipart PDF upload, extract text, enqueue RQ job.
  GET  /api/resume         — return current resume metadata for the logged-in user.
  DELETE /api/resume       — clear all resume fields.
"""

from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.user import User
from database.repositories.user_repository import UserRepository
from database.session import get_db
from resume.extractors.pdf import extract_text_from_pdf
from storage.r2 import R2StorageError, resume_storage
from utils.auth import get_current_user
from utils.logging_config import get_feature_logger, log_dev
from workers.queue import resume_processing_queue
from workers.resume_worker import _process_resume, process_resume

logger = get_feature_logger("resume")

router = APIRouter()

MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = {"application/pdf"}


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class ResumeResponse(BaseModel):
    """Resume metadata and AI-extracted data returned to the frontend."""

    fileName: str
    uploadedAt: str
    sizeKb: int
    status: str
    extractedSkills: list[str]
    experienceLevel: str
    yearsTotal: int
    confidence: float

    @classmethod
    def from_user(cls, user: User) -> "ResumeResponse":
        uploaded_at = user.resume_uploaded_at or datetime.now(timezone.utc)
        if uploaded_at.tzinfo is None:
            uploaded_at = uploaded_at.replace(tzinfo=timezone.utc)
        return cls(
            fileName=user.resume_file_name or "",
            uploadedAt=uploaded_at.isoformat().replace("+00:00", "Z"),
            sizeKb=user.resume_size_kb or 0,
            status=user.resume_status or "processing",
            extractedSkills=user.resume_extracted_skills or [],
            experienceLevel=user.resume_experience_level or "",
            yearsTotal=user.resume_years_total or 0,
            confidence=user.resume_confidence or 0.0,
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/api/resume/upload",
    response_model=ResumeResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),  # noqa: B008
    user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> ResumeResponse:
    """Upload a PDF resume.

    1. Validate content type and size.
    2. Optionally store the PDF in Cloudflare R2 (skipped when R2 is not configured).
    3. Extract plain text from the in-memory bytes.
    4. Persist metadata + text to the user row, then enqueue the AI job.
    5. Return 202 Accepted with current resume state.
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        logger.warning(
            "Rejected resume upload for user_id=%s filename=%r content_type=%r: unsupported type",
            user.id,
            file.filename,
            file.content_type,
        )
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Only PDF files are supported. Received: {file.content_type}",
        )

    file_bytes = await file.read()

    # Validate size
    if len(file_bytes) > MAX_RESUME_SIZE_BYTES:
        logger.warning(
            "Rejected resume upload for user_id=%s filename=%r size_bytes=%s: file too large",
            user.id,
            file.filename,
            len(file_bytes),
        )
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume file exceeds the 5 MB limit.",
        )

    file_name = file.filename or "resume.pdf"
    previous_storage_key = user.resume_storage_key

    # R2 is optional — skip when credentials are not configured or placeholder (e.g. local dev).
    r2_configured = resume_storage.is_configured()

    if r2_configured:
        try:
            storage_key = await resume_storage.upload_resume(user.id, file_bytes)
            logger.info(
                "Resume uploaded to R2 for user_id=%s storage_key=%s size_bytes=%s",
                user.id,
                storage_key,
                len(file_bytes),
            )
        except R2StorageError as exc:
            logger.warning(
                "R2 resume upload failed for user_id=%s filename=%r size_bytes=%s: %s. Falling back to local storage key.",
                user.id,
                file_name,
                len(file_bytes),
                exc,
            )
            storage_key = f"local/{user.id}/{file_name}"
    else:
        storage_key = f"local/{user.id}/{file_name}"
        logger.info(
            "R2 not configured — using local placeholder key=%s for user_id=%s",
            storage_key,
            user.id,
        )

    try:
        resume_text = extract_text_from_pdf(file_bytes)
    except Exception as exc:
        logger.exception(
            "PDF text extraction failed for user_id=%s storage_key=%s",
            user.id,
            storage_key,
        )
        if r2_configured:
            try:
                await resume_storage.delete_resume(storage_key)
            except R2StorageError:
                logger.exception(
                    "R2 cleanup failed after extraction error for user_id=%s storage_key=%s",
                    user.id,
                    storage_key,
                )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Failed to extract text from PDF. Ensure the file is a valid, readable PDF.",
        ) from exc

    log_dev(
        "UPLOADING RESUME",
        {
            "user_id": user.id,
            "filename": file_name,
            "size_bytes": len(file_bytes),
            "content_type": file.content_type,
            "storage_key": storage_key,
            "extracted_text_length": len(resume_text),
        },
        logger_name="resume",
    )

    if not resume_text.strip():
        logger.warning(
            "Rejected empty resume text for user_id=%s storage_key=%s",
            user.id,
            storage_key,
        )
        if r2_configured:
            try:
                await resume_storage.delete_resume(storage_key)
            except R2StorageError:
                logger.exception(
                    "R2 cleanup failed after empty text for user_id=%s storage_key=%s",
                    user.id,
                    storage_key,
                )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Extracted text is empty. The PDF may be image-only or password-protected.",
        )

    size_kb = max(1, (len(file_bytes) + 1023) // 1024)
    repo = UserRepository(db)
    try:
        user = await repo.update_resume(
            user=user,
            file_name=file_name,
            storage_key=storage_key,
            size_kb=size_kb,
            resume_text=resume_text,
            status="processing",
        )
    except Exception as exc:
        logger.exception(
            "Database update failed for user_id=%s storage_key=%s",
            user.id,
            storage_key,
        )
        if r2_configured:
            try:
                await resume_storage.delete_resume(storage_key)
            except R2StorageError:
                logger.exception(
                    "R2 cleanup failed after database error for user_id=%s storage_key=%s",
                    user.id,
                    storage_key,
                )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save resume metadata. Please try again.",
        ) from exc

    # Clean up old R2 object if the key changed
    if r2_configured and previous_storage_key and previous_storage_key != storage_key:
        try:
            await resume_storage.delete_resume(previous_storage_key)
        except R2StorageError:
            logger.exception(
                "Failed to remove replaced resume for user_id=%s storage_key=%s",
                user.id,
                previous_storage_key,
            )

    # Schedule immediate async background processing via FastAPI BackgroundTasks
    background_tasks.add_task(_process_resume, user.id)

    # Also enqueue RQ job for dedicated worker clusters
    try:
        resume_processing_queue.enqueue(
            process_resume,
            user.id,
            job_timeout=300,  # 5 min max
            result_ttl=3600,
        )
        logger.info("Enqueued resume-processing job for user %s", user.id)
    except Exception:
        logger.warning(
            "RQ enqueue failed or unconfigured for user_id=%s (handled via BackgroundTasks)",
            user.id,
        )

    return ResumeResponse.from_user(user)


@router.get("/api/resume", response_model=ResumeResponse)
async def get_resume(user: User = Depends(get_current_user)) -> ResumeResponse:  # noqa: B008
    """Return the current user's resume metadata and extracted data.

    Returns 404 if no resume has been uploaded.
    """
    if not user.resume_file_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume on file.",
        )
    return ResumeResponse.from_user(user)


@router.delete("/api/resume", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> None:
    """Remove the current user's resume and all extracted fields."""
    if not user.resume_file_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume on file.",
        )
    if user.resume_storage_key and not user.resume_storage_key.startswith("local/"):
        if resume_storage.is_configured():
            try:
                await resume_storage.delete_resume(user.resume_storage_key)
            except R2StorageError as exc:
                logger.warning(
                    "R2 resume deletion failed for user_id=%s storage_key=%s: %s",
                    user.id,
                    user.resume_storage_key,
                    exc,
                )

    repo = UserRepository(db)
    await repo.clear_resume(user)
    logger.info("Resume deleted for user_id=%s", user.id)


class DownloadUrlResponse(BaseModel):
    downloadUrl: str


@router.get("/api/resume/download", response_model=DownloadUrlResponse)
async def get_resume_download_url(
    user: User = Depends(get_current_user),  # noqa: B008
) -> DownloadUrlResponse:
    """Generate a short-lived, owner-only pre-signed download URL for the user's resume.

    The R2 bucket is private — objects are never publicly reachable.  The URL
    issued here is valid for 5 minutes and is cryptographically tied to the
    specific object.  Before signing, ``ResumeStorage.verify_owner`` confirms
    that the object key was originally namespaced under this user's ID, so
    one authenticated user can never obtain a link for another user's file.
    """
    if not user.resume_file_name or not user.resume_storage_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume on file.",
        )

    if (
        user.resume_storage_key.startswith("local/")
        or not resume_storage.is_configured()
    ):
        return DownloadUrlResponse(downloadUrl="#")

    try:
        url = await resume_storage.get_presigned_download_url(
            storage_key=user.resume_storage_key,
            user_id=user.id,
            file_name=user.resume_file_name,
        )
        logger.info(
            "Issued 5-min private download URL for user_id=%s storage_key=%s",
            user.id,
            user.resume_storage_key,
        )
        return DownloadUrlResponse(downloadUrl=url)
    except R2StorageError as exc:
        logger.exception(
            "Failed to generate pre-signed URL for user_id=%s storage_key=%s",
            user.id,
            user.resume_storage_key,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resume download service is temporarily unavailable.",
        ) from exc
