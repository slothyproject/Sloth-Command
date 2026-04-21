"""Thin HTTP bridge to the Dissident Bot backend API."""
from __future__ import annotations

import os

import jwt
import requests

# Moderation routes that must exist on the backend for core features to work.
# A 404 on these is surfaced as 503 so callers get an actionable error.
_CRITICAL_MODERATION_PREFIXES = ("moderation/",)


def get_dashboard_api_token(user) -> str:
    """Mint a signed JWT for the dashboard user to auth against the Dissident API."""
    secret = os.environ.get("JWT_SECRET", "")
    payload = {
        "sub": str(getattr(user, "discord_id", "") or ""),
        "username": str(getattr(user, "username", "") or ""),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def call_dissident_api(
    method: str,
    path: str,
    user,
    *,
    json_payload: dict | None = None,
    params: dict | None = None,
) -> tuple[int, dict]:
    """Call the Dissident backend API and return (status_code, response_dict).

    A 404 on a critical moderation route is converted to a 503 with context so
    callers know they need to deploy the latest bot backend.  All other
    responses pass through verbatim.
    """
    base_url = os.environ.get(
        "DISSIDENT_API_URL",
        "https://dissident-api-backend-production.up.railway.app",
    )
    url = f"{base_url}/api/{path.lstrip('/')}"

    token = get_dashboard_api_token(user)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    resp = requests.request(
        method.upper(),
        url,
        headers=headers,
        json=json_payload,
        params=params,
        timeout=30,
    )

    if resp.status_code == 404:
        is_critical = any(path.startswith(pfx) for pfx in _CRITICAL_MODERATION_PREFIXES)
        if is_critical:
            return 503, {
                "missing_route": f"/api/{path.lstrip('/')}",
                "error": (
                    "missing required moderation routes — "
                    "deploy the latest bot backend to restore this feature"
                ),
            }
        try:
            return 404, resp.json()
        except Exception:
            return 404, {"error": resp.text or "not found"}

    try:
        return resp.status_code, resp.json()
    except Exception:
        return resp.status_code, {"error": resp.text or "unknown error"}
