import logging
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.admin_audit_log import AdminAuditLog
from database.models.user import User

logger = logging.getLogger(__name__)


class AuditService:
    @staticmethod
    async def log_action(
        db: AsyncSession,
        user: User | None,
        action: str,
        target_type: str,
        target_id: str | None = None,
        changes: dict[str, Any] | None = None,
        request: Request | None = None,
    ) -> AdminAuditLog:
        """
        Record an administrative action to the audit logs table and system log.
        """
        ip_address = None
        if request and request.client:
            # Check forwarded header if behind proxy
            forwarded = request.headers.get("x-forwarded-for")
            ip_address = (
                forwarded.split(",")[0].strip() if forwarded else request.client.host
            )

        user_id = user.id if user else None
        user_email = user.email if user else "system"

        audit_entry = AdminAuditLog(
            user_id=user_id,
            user_email=user_email,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            changes=changes,
            ip_address=ip_address,
        )

        db.add(audit_entry)
        await db.commit()
        await db.refresh(audit_entry)

        logger.info(
            f"[AUDIT] user={user_email} action={action} target={target_type}:{target_id} ip={ip_address}"
        )
        return audit_entry
