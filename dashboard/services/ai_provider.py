from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

import requests

from dashboard.models import UserAIProviderCredential

SUPPORTED_AI_PROVIDERS = {
    "openai": {
        "label": "OpenAI",
        "default_model": "gpt-4o-mini",
        "requires_base_url": False,
    },
    "anthropic": {
        "label": "Anthropic",
        "default_model": "claude-3-5-haiku-latest",
        "requires_base_url": False,
    },
    "gemini": {
        "label": "Google Gemini",
        "default_model": "gemini-2.0-flash",
        "requires_base_url": False,
    },
    "custom_openai": {
        "label": "Custom OpenAI-Compatible",
        "default_model": "gpt-4o-mini",
        "requires_base_url": True,
    },
}


def normalize_provider_name(value: str | None) -> str:
    return str(value or "").strip().lower().replace("-", "_")


def mask_api_key(api_key: str | None) -> str:
    secret = str(api_key or "").strip()
    if not secret:
        return ""
    if len(secret) <= 6:
        return "*" * len(secret)
    return f"{secret[:3]}...{secret[-4:]}"


def _normalize_base_url(base_url: str | None) -> str | None:
    value = str(base_url or "").strip()
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Base URL must be a valid HTTP or HTTPS URL")
    return value.rstrip("/")


def normalize_ai_provider_payload(data: dict[str, Any], *, require_api_key: bool) -> dict[str, Any]:
    provider = normalize_provider_name(data.get("provider"))
    if provider not in SUPPORTED_AI_PROVIDERS:
        raise ValueError("Unsupported AI provider")

    api_key = str(data.get("api_key") or "").strip()
    if require_api_key and not api_key:
        raise ValueError("API key is required")

    model = str(data.get("model") or SUPPORTED_AI_PROVIDERS[provider]["default_model"]).strip()
    if not model:
        raise ValueError("Model is required")

    base_url = _normalize_base_url(data.get("base_url"))
    if SUPPORTED_AI_PROVIDERS[provider]["requires_base_url"] and not base_url:
        raise ValueError("Base URL is required for custom OpenAI-compatible endpoints")

    usage_limit = data.get("usage_limit_requests_per_hour", 100)
    try:
        usage_limit = int(usage_limit)
    except (TypeError, ValueError) as exc:
        raise ValueError("Usage limit must be an integer") from exc
    if usage_limit < 1 or usage_limit > 10000:
        raise ValueError("Usage limit must be between 1 and 10000 requests per hour")

    return {
        "provider": provider,
        "api_key": api_key,
        "model": model,
        "base_url": base_url,
        "usage_limit_requests_per_hour": usage_limit,
    }


def serialize_ai_provider_credential(credential: UserAIProviderCredential | None) -> dict[str, Any]:
    if not credential:
        return {
            "configured": False,
            "provider": None,
            "model": None,
            "base_url": None,
            "status": "not_configured",
            "key_hint": None,
            "usage_limit_requests_per_hour": None,
            "last_validated_at": None,
            "validation_error": None,
            "updated_at": None,
        }

    payload = credential.to_dict()
    payload["configured"] = True
    return payload


def validate_ai_provider_config(
    *,
    provider: str,
    api_key: str,
    model: str,
    base_url: str | None = None,
    timeout: int = 10,
) -> dict[str, Any]:
    provider_name = normalize_provider_name(provider)
    if provider_name not in SUPPORTED_AI_PROVIDERS:
        raise ValueError("Unsupported AI provider")

    secret = str(api_key or "").strip()
    if not secret:
        raise ValueError("API key is required")

    model_name = str(model or SUPPORTED_AI_PROVIDERS[provider_name]["default_model"]).strip()
    if not model_name:
        raise ValueError("Model is required")

    normalized_base_url = _normalize_base_url(base_url)
    request_args: dict[str, Any]
    url: str

    if provider_name in {"openai", "custom_openai"}:
        root = normalized_base_url or "https://api.openai.com"
        url = f"{root}/v1/models"
        request_args = {
            "method": "GET",
            "url": url,
            "headers": {"Authorization": f"Bearer {secret}"},
            "timeout": timeout,
        }
    elif provider_name == "anthropic":
        url = "https://api.anthropic.com/v1/messages"
        request_args = {
            "method": "POST",
            "url": url,
            "headers": {
                "x-api-key": secret,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            "json": {
                "model": model_name,
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "ping"}],
            },
            "timeout": timeout,
        }
    else:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={secret}"
        request_args = {
            "method": "POST",
            "url": url,
            "json": {
                "contents": [{"parts": [{"text": "ping"}]}],
                "generationConfig": {"maxOutputTokens": 1},
            },
            "timeout": timeout,
        }

    try:
        response = requests.request(**request_args)
    except requests.RequestException as exc:
        return {
            "ok": False,
            "provider": provider_name,
            "model": model_name,
            "message": "Could not reach AI provider",
            "details": str(exc),
        }

    if response.status_code >= 400:
        try:
            details = response.json()
        except ValueError:
            details = response.text
        return {
            "ok": False,
            "provider": provider_name,
            "model": model_name,
            "message": "AI provider rejected the supplied credentials",
            "details": details,
            "status_code": response.status_code,
        }

    return {
        "ok": True,
        "provider": provider_name,
        "model": model_name,
        "message": "AI provider credentials validated successfully",
        "base_url": normalized_base_url,
    }