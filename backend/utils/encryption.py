import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet

from config.settings import settings

logger = logging.getLogger("security")
_fallback_warned = False


def _get_fernet() -> Fernet:
    """Derive a stable 32-byte url-safe base64 encryption key from server secret or dedicated key."""
    global _fallback_warned
    raw_secret = (
        getattr(settings, "encryption_master_key", None)
        or os.getenv("ENCRYPTION_MASTER_KEY")
        or os.getenv("SECRET_KEY")
        or getattr(settings, "auth0_client_secret", None)
        or getattr(settings, "database_url", "")
        or "opportune-ai-default-master-key-fallback"
    )
    if (
        raw_secret == "opportune-ai-default-master-key-fallback"
        and not _fallback_warned
    ):
        logger.warning(
            "[SECURITY ALERT] Master encryption key is unset. Secrets are encrypted using insecure static fallback. "
            "Please configure ENCRYPTION_MASTER_KEY in backend/.env!"
        )
        _fallback_warned = True

    derived = hashlib.sha256(raw_secret.encode("utf-8")).digest()
    key_b64 = base64.urlsafe_b64encode(derived)
    return Fernet(key_b64)


def encrypt_secret(plain_text: str) -> str:
    """Encrypt plain text sensitive secret into token string."""
    if not plain_text:
        return ""
    f = _get_fernet()
    return f.encrypt(plain_text.encode("utf-8")).decode("utf-8")


def decrypt_secret(cipher_text: str) -> str:
    """Decrypt token string back to plain text secret."""
    if not cipher_text:
        return ""
    try:
        f = _get_fernet()
        return f.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
    except Exception:
        # If decryption fails (e.g. key changed), return empty or sanitized string
        return ""


def mask_secret(secret: str) -> tuple[str, str, str]:
    """
    Return (prefix, last4, masked_display).
    Example: 'AIzaSyD-xxx1' -> ('AIza', 'xxx1', 'AIza••••••••xxx1')
    """
    if not secret:
        return ("", "", "")
    clean = secret.strip()
    if len(clean) <= 8:
        prefix = clean[:2]
        last4 = clean[-2:] if len(clean) >= 4 else clean[-1:]
        masked = f"{prefix}••••{last4}"
    else:
        prefix = clean[:4]
        last4 = clean[-4:]
        masked = f"{prefix}••••••••{last4}"
    return (prefix, last4, masked)
