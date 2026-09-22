import pytest
from fastapi import HTTPException
from starlette.requests import Request

from database.models.user import User
from database.session import AsyncSessionLocal
from routes.admin import (
    CreateApiKeyRequest,
    NotificationTestRequest,
    UpdateConfigRequest,
    create_api_key,
    delete_api_key,
    get_admin_stats,
    get_live_logs,
    get_queue_status,
    get_scrapers_health,
    get_system_configurations,
    list_api_keys,
    list_audit_logs,
    send_test_notification,
    update_system_configuration,
)
from utils.auth import require_admin
from utils.encryption import decrypt_secret, encrypt_secret, mask_secret


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def create_dummy_request() -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/admin",
        "headers": [],
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)


@pytest.mark.anyio
async def test_require_admin_guard():
    """Test require_admin rejects non-admin users and allows admin users."""
    normal_user = User(
        id=101,
        auth0_sub="auth0|normal-101",
        email="normal@example.com",
        name="Normal User",
        role="user",
    )

    admin_user = User(
        id=102,
        auth0_sub="auth0|admin-102",
        email="admin@opportuneai.com",
        name="Admin User",
        role="admin",
    )

    # 1. Normal user should raise HTTP 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        await require_admin(user=normal_user)
    assert exc_info.value.status_code == 403
    assert "Admin privileges required" in exc_info.value.detail

    # 2. Admin user should pass through
    result_user = await require_admin(user=admin_user)
    assert result_user.role == "admin"
    assert result_user.id == 102


@pytest.mark.anyio
async def test_encryption_utility():
    """Test secret encryption, decryption, and masking."""
    secret = "AIzaSyD-TestKey123456789"
    encrypted = encrypt_secret(secret)
    assert encrypted != secret
    decrypted = decrypt_secret(encrypted)
    assert decrypted == secret

    prefix, last4, masked = mask_secret(secret)
    assert prefix == "AIza"
    assert last4 == "6789"
    assert "••••" in masked


@pytest.mark.anyio
async def test_admin_stats_and_scrapers(dispose_db_engine):
    """Test admin stats and scraper health endpoints."""
    admin_user = User(
        id=103,
        auth0_sub="auth0|admin-103",
        email="admin@opportune.ai",
        name="Admin User",
        role="admin",
    )

    async with AsyncSessionLocal() as db:
        stats = await get_admin_stats(admin=admin_user, db=db)
        assert stats.totalJobs >= 1
        assert stats.totalUsers >= 1
        assert stats.uptimePct > 0

        scrapers = await get_scrapers_health(admin=admin_user, db=db)
        assert len(scrapers) == 4
        provider_names = [s["provider"] for s in scrapers]
        assert "linkedin" in provider_names
        assert "remoteok" in provider_names


@pytest.mark.anyio
async def test_config_and_api_keys_and_audit(dispose_db_engine):
    """Test dynamic config update, API key management, test alerts, and audit logging."""
    admin_user = User(
        id=104,
        auth0_sub="auth0|admin-104",
        email="admin@opportune.ai",
        name="Admin User",
        role="admin",
    )
    request = create_dummy_request()

    async with AsyncSessionLocal() as db:
        # 1. Get configs
        configs = await get_system_configurations(admin=admin_user, db=db)
        assert "llm_config" in configs
        assert "scheduler_config" in configs

        # 2. Update config
        update_req = UpdateConfigRequest(
            key="llm_config",
            value={
                "provider": "gemini",
                "model": "gemini-2.5-flash",
                "temperature": 0.2,
            },
            is_secret=False,
        )
        res = await update_system_configuration(
            payload=update_req, request=request, admin=admin_user, db=db
        )
        assert res["success"] is True

        # 3. Create API Key
        key_req = CreateApiKeyRequest(
            provider="gemini",
            label="Production Backup Key",
            secret_key="AIzaSyD-Secr3tValu3Key",
        )
        key_res = await create_api_key(
            payload=key_req, request=request, admin=admin_user, db=db
        )
        assert key_res["success"] is True
        key_id = key_res["id"]

        # 4. List API keys
        keys_list = await list_api_keys(admin=admin_user, db=db)
        assert len(keys_list) >= 1
        assert any(k["id"] == key_id for k in keys_list)

        # 5. Delete API Key
        del_res = await delete_api_key(
            key_id=key_id, request=request, admin=admin_user, db=db
        )
        assert del_res["success"] is True

        # 6. Test Alert Notification
        notif_req = NotificationTestRequest(
            title="System Pipeline Test",
            message="Testing admin email alert dispatcher",
            severity="info",
        )
        notif_res = await send_test_notification(
            payload=notif_req, request=request, admin=admin_user, db=db
        )
        assert notif_res["success"] is True

        # 7. Check audit logs
        audit_res = await list_audit_logs(
            page=1, page_size=10, action_filter=None, admin=admin_user, db=db
        )
        assert audit_res["total"] >= 1
        assert any(item["action"] == "create_api_key" for item in audit_res["items"])


@pytest.mark.anyio
async def test_queue_and_live_logs():
    """Test queue telemetry and live log streaming."""
    admin_user = User(
        id=105,
        auth0_sub="auth0|admin-105",
        email="admin@opportune.ai",
        name="Admin User",
        role="admin",
    )

    # Queue telemetry
    queue_telemetry = await get_queue_status(admin=admin_user)
    assert "queues" in queue_telemetry
    assert "active_workers_count" in queue_telemetry

    # Logs
    logs = await get_live_logs(
        source="all", level="ALL", search=None, limit=50, admin=admin_user
    )
    assert isinstance(logs, list)


@pytest.mark.anyio
async def test_secret_masking_and_retention(dispose_db_engine):
    """Test sensitive dictionary fields are masked on retrieval and retained on updates."""
    admin_user = User(
        id=106,
        auth0_sub="auth0|admin-106",
        email="admin@opportune.ai",
        name="Admin User",
        role="admin",
    )
    dummy_req = create_dummy_request()

    async with AsyncSessionLocal() as db:
        # 1. Update notification config with real password
        test_pass = "SuperSecretAppPassword123"
        await update_system_configuration(
            payload=UpdateConfigRequest(
                key="notification_config",
                value={
                    "smtp_user": "test@domain.com",
                    "smtp_pass": test_pass,
                    "smtp_port": 587,
                },
                is_secret=False,
            ),
            request=dummy_req,
            admin=admin_user,
            db=db,
        )

        # 2. Retrieve configs via API: verify password is masked as "••••••••"
        all_configs = await get_system_configurations(admin=admin_user, db=db)
        notif_cfg = all_configs.get("notification_config", {}).get("value", {})
        assert notif_cfg.get("smtp_pass") == "••••••••"
        assert notif_cfg.get("smtp_user") == "test@domain.com"

        # 3. Simulate frontend updating another field while keeping the masked placeholder
        await update_system_configuration(
            payload=UpdateConfigRequest(
                key="notification_config",
                value={
                    "smtp_user": "test@domain.com",
                    "smtp_pass": "••••••••",
                    "smtp_port": 465,
                },
                is_secret=False,
            ),
            request=dummy_req,
            admin=admin_user,
            db=db,
        )

        # 4. Backend service internal get_config must still have the real plaintext password preserved
        from services.system_config_service import SystemConfigService

        internal_cfg = await SystemConfigService.get_config(
            "notification_config", db=db, use_cache=False
        )
        assert internal_cfg.get("smtp_pass") == test_pass
        assert internal_cfg.get("smtp_port") == 465
