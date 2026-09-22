import asyncio
import html
import logging
import re
import smtplib
import ssl
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from config.settings import settings
from database.models.alert_notification import AlertNotification
from database.session import AsyncSessionLocal
from services.system_config_service import SystemConfigService

logger = logging.getLogger(__name__)

# Standard SMTP provider presets
SMTP_PRESETS: dict[str, dict[str, Any]] = {
    "google": {
        "name": "Google (Gmail / Workspace)",
        "host": "smtp.gmail.com",
        "port": 587,
        "use_tls": True,
        "use_ssl": False,
        "docs": "Requires 16-character App Password generated from Google Account -> Security -> 2-Step Verification -> App passwords.",
    },
    "zoho": {
        "name": "Zoho Mail",
        "host": "smtp.zoho.in",
        "port": 587,
        "use_tls": True,
        "use_ssl": False,
        "docs": "Requires Zoho Mail App Password generated from Zoho Accounts -> Security -> App Passwords.",
    },
    "custom": {
        "name": "Custom SMTP Relay",
        "host": "",
        "port": 587,
        "use_tls": True,
        "use_ssl": False,
        "docs": "Standard custom SMTP server relay.",
    },
}


class EmailNotificationService:
    # Memory tracker for alert throttling (key -> last_sent_timestamp)
    _alert_timestamps: dict[str, float] = {}

    @classmethod
    def get_provider_presets(cls) -> dict[str, dict[str, Any]]:
        return SMTP_PRESETS

    @classmethod
    async def send_alert(
        cls,
        event_type: str,
        title: str,
        message: str,
        severity: str = "warning",
        metadata: dict[str, Any] | None = None,
        force: bool = False,
    ) -> AlertNotification | None:
        """
        Send an alert to configured admin emails, storing record in DB.
        Includes automatic throttling (max 1 alert per 15 min for same event_type/title).
        Resolves config hierarchically: DB Config overrides > Settings/Environment variables > Presets.
        """
        now = datetime.utcnow().timestamp()
        throttle_key = f"{event_type}:{title}"
        if not force:
            last_time = cls._alert_timestamps.get(throttle_key, 0)
            if now - last_time < 900:  # 15 minutes throttle window
                logger.info("Alert '%s' throttled (already sent within 15 min)", title)
                return None

        cls._alert_timestamps[throttle_key] = now

        # 1. Resolve notification settings from SystemConfig with fallback to environment
        notif_config = await SystemConfigService.get_config("notification_config")
        recipients = notif_config.get("recipient_emails") or list(
            getattr(settings, "admin_emails", [])
        )
        if not recipients:
            recipients = ["admin@luckylinux.dev", "luckyverma.dev@gmail.com"]

        # Check if alert event is enabled
        enabled = True
        if event_type == "scraper_failure":
            enabled = notif_config.get("alert_on_scraper_failure", True)
        elif event_type == "repeated_retry":
            enabled = notif_config.get("alert_on_repeated_retry", True)
        elif event_type == "provider_blocked":
            enabled = notif_config.get("alert_on_provider_blocked", True)
        elif event_type == "system_error":
            enabled = notif_config.get("alert_on_critical_error", True)

        if not enabled and not force:
            logger.info("Alert type '%s' disabled in system config.", event_type)
            return None

        # 2. Resolve provider parameters (DB values > env vars > presets)
        provider = (
            notif_config.get("smtp_provider")
            or getattr(settings, "smtp_provider", "google")
        ).lower()

        preset = SMTP_PRESETS.get(provider, SMTP_PRESETS["custom"])

        smtp_enabled = notif_config.get(
            "smtp_enabled", getattr(settings, "smtp_enabled", False)
        )
        smtp_host = (
            notif_config.get("smtp_host")
            or getattr(settings, "smtp_host", "")
            or preset["host"]
        )
        smtp_port = int(
            notif_config.get("smtp_port")
            or getattr(settings, "smtp_port", 0)
            or preset["port"]
        )
        smtp_user = (
            notif_config.get("smtp_user") or getattr(settings, "smtp_user", "")
        ).strip()
        smtp_pass = (
            notif_config.get("smtp_pass") or getattr(settings, "smtp_password", "")
        ).strip()

        from_email = (
            notif_config.get("smtp_from")
            or getattr(settings, "smtp_from_email", "")
            or (smtp_user if "@" in smtp_user else "")
            or "alerts@opportuneai.com"
        ).strip()

        # Auto-complete username if user supplied just the username prefix (e.g. "no-reply")
        if smtp_user and "@" not in smtp_user and "@" in from_email:
            domain = from_email.split("@")[-1]
            logger.info(
                "[SMTP DEBUG] Normalizing username without domain: '%s' -> '%s@%s'",
                smtp_user,
                smtp_user,
                domain,
            )
            smtp_user = f"{smtp_user}@{domain}"

        from_name = getattr(settings, "smtp_from_name", "OpportuneAI Alerts")
        sender = f"{from_name} <{from_email}>" if "<" not in from_email else from_email

        # Determine SSL vs STARTTLS: Port 465 uses SSL; 587 uses STARTTLS
        use_ssl = (
            notif_config.get("smtp_use_ssl")
            if "smtp_use_ssl" in notif_config
            else (
                getattr(settings, "smtp_use_ssl", False)
                or smtp_port == 465
                or preset.get("use_ssl", False)
            )
        )
        use_tls = (
            notif_config.get("smtp_use_tls")
            if "smtp_use_tls" in notif_config
            else (getattr(settings, "smtp_use_tls", True) if not use_ssl else False)
        )

        # 3. Attempt delivery
        delivered = False
        delivery_error: str | None = None

        if smtp_enabled and smtp_host and smtp_user:
            try:
                loop = asyncio.get_running_loop()
                delivered = await loop.run_in_executor(
                    None,
                    cls._send_smtp_sync,
                    smtp_host,
                    smtp_port,
                    smtp_user,
                    smtp_pass,
                    sender,
                    recipients,
                    title,
                    message,
                    severity,
                    use_ssl,
                    use_tls,
                )
                logger.info(
                    "[EMAIL ALERT DISPATCHED] via %s (%s:%d) to %s title='%s'",
                    provider.upper(),
                    smtp_host,
                    smtp_port,
                    recipients,
                    title,
                )
            except smtplib.SMTPAuthenticationError as e:
                delivery_error = (
                    f"SMTP Authentication failed (check user/app-password): {e}"
                )
                logger.error("[EMAIL ALERT FAILED] %s", delivery_error)
            except smtplib.SMTPConnectError as e:
                delivery_error = (
                    f"SMTP Connection failed to {smtp_host}:{smtp_port}: {e}"
                )
                logger.error("[EMAIL ALERT FAILED] %s", delivery_error)
            except Exception as e:
                delivery_error = f"SMTP Dispatch error: {e}"
                logger.error("[EMAIL ALERT FAILED] %s", delivery_error)
        else:
            # Dev / non-SMTP mode: log simulation cleanly and record delivery
            reason = (
                "SMTP not enabled"
                if not smtp_enabled
                else "SMTP credentials not provided"
            )
            logger.info(
                "[EMAIL ALERT SIMULATED] (%s) to=%s severity=%s title='%s'",
                reason,
                recipients,
                severity,
                title,
            )
            delivered = True

        # 4. Save alert record in database for audit history
        combined_metadata = dict(metadata or {})
        combined_metadata.update(
            {
                "provider": provider,
                "smtp_host": smtp_host,
                "smtp_port": smtp_port,
                "delivery_error": delivery_error,
            }
        )

        try:
            async with AsyncSessionLocal() as db:
                alert_row = AlertNotification(
                    event_type=event_type,
                    severity=severity,
                    title=title,
                    message=message,
                    metadata_json=combined_metadata,
                    sent_to=recipients,
                    delivered=delivered,
                )
                db.add(alert_row)
                await db.commit()
                await db.refresh(alert_row)
                return alert_row
        except Exception as e:
            logger.error("Failed to save alert notification record: %s", e)
            return None

    @classmethod
    def _send_smtp_sync(
        cls,
        host: str,
        port: int,
        user: str,
        password: str,
        sender: str,
        recipients: list[str],
        title: str,
        message: str,
        severity: str,
        use_ssl: bool,
        use_tls: bool,
    ) -> bool:
        """Synchronous SMTP dispatcher supporting both SSL (465) and STARTTLS (587)."""
        clean_title = re.sub(r"[\r\n]+", " ", title).strip()
        clean_severity = re.sub(r"[\r\n]+", " ", severity).strip()

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{clean_severity.upper()}] OpportuneAI Alert: {clean_title}"
        msg["From"] = sender
        msg["To"] = ", ".join(recipients)

        badge_bg = (
            "#ef4444"
            if clean_severity == "critical"
            else ("#f59e0b" if clean_severity == "warning" else "#3b82f6")
        )

        escaped_title = html.escape(clean_title)
        escaped_message = html.escape(message)
        escaped_severity = html.escape(clean_severity)

        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px;">
                <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                    Opportune<span style="color: #6366f1;">AI</span> Alert
                </div>
                <span style="background: {badge_bg}; color: white; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                    {escaped_severity}
                </span>
            </div>
            <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-top: 0; margin-bottom: 12px;">{escaped_title}</h2>
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid {badge_bg}; color: #334155; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">{escaped_message}</div>
            <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
                <span>Dispatched by OpportuneAI Admin Control Plane</span>
                <span>{datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")}</span>
            </div>
        </div>
        """

        msg.attach(MIMEText(message, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        logger.info(
            "[SMTP DISPATCH ATTEMPT] host=%s port=%d user=%s ssl=%s tls=%s recipients=%s",
            host,
            port,
            user,
            use_ssl,
            use_tls,
            recipients,
        )

        if use_ssl or port == 465:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, timeout=15, context=ctx) as server:
                if user and password:
                    server.login(user, password)
                server.sendmail(sender, recipients, msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                if use_tls:
                    server.starttls()
                if user and password:
                    server.login(user, password)
                server.sendmail(sender, recipients, msg.as_string())

        logger.info("[SMTP DISPATCH SUCCESS] Message delivered to %s", recipients)
        return True
