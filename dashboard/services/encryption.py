from __future__ import annotations

import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _coerce_master_key(raw_value: str | None) -> bytes:
    if not raw_value:
        raise RuntimeError("AI provider encryption key is not configured")

    try:
        decoded = base64.b64decode(raw_value)
    except Exception as exc:  # pragma: no cover - defensive guard
        raise RuntimeError("AI provider encryption key must be valid base64") from exc

    if len(decoded) == 32:
        return decoded

    if len(raw_value) >= 32:
        return hashlib.sha256(raw_value.encode("utf-8")).digest()

    raise RuntimeError("AI provider encryption key must resolve to 32 bytes")


def get_ai_provider_encryption_key() -> bytes:
    configured = (
        os.environ.get("AI_PROVIDER_ENCRYPTION_KEY")
        or os.environ.get("API_KEY_ENCRYPTION_KEY")
    )
    return _coerce_master_key(configured)


def encrypt_secret(plaintext: str) -> tuple[str, str]:
    secret = (plaintext or "").strip()
    if not secret:
        raise ValueError("Secret cannot be empty")

    key = get_ai_provider_encryption_key()
    iv = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(iv, secret.encode("utf-8"), None)
    return (
        base64.b64encode(ciphertext).decode("ascii"),
        base64.b64encode(iv).decode("ascii"),
    )


def decrypt_secret(ciphertext_b64: str, iv_b64: str) -> str:
    key = get_ai_provider_encryption_key()
    ciphertext = base64.b64decode(ciphertext_b64)
    iv = base64.b64decode(iv_b64)
    plaintext = AESGCM(key).decrypt(iv, ciphertext, None)
    return plaintext.decode("utf-8")