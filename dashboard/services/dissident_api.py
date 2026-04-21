from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt
import requests
from flask import session


def _api_base_url() -> str:
    return os.environ.get("DISSIDENT_API_BASE_URL", "http://localhost:3000").rstrip("/")


def _jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET", "")
    if not secret:
        raise RuntimeError("JWT_SECRET is required for dashboard moderation bridging")
    return secret


def _fallback_discord_id() -> str | None:
    explicit = (os.environ.get("DISSIDENT_FALLBACK_DISCORD_ID") or "").strip()
    if explicit:
        return explicit

    admin_ids = (os.environ.get("DISCORD_ADMIN_IDS") or "").strip()
    if admin_ids:
        first = admin_ids.split(",", 1)[0].strip()
        if first:
            return first

    return None


def _route_missing_error(path: str) -> dict | None:
    normalized = path.lstrip("/")
    critical_paths = {
        "moderation/bulk",
        "moderation/global-bans",
        "moderation/global-ban",
    }
    if normalized in critical_paths or normalized.startswith("moderation/global-ban/"):
        return {
            "error": "Dissident API deployment is missing required moderation routes",
            "missing_route": f"/api/{normalized}",
            "details": "Deploy the backend version with bulk and global-ban moderation endpoints.",
        }
    return None


def _token_cache_valid() -> bool:
    token = session.get("dissident_api_token")
    expires_at = session.get("dissident_api_token_expires_at")
    if not token or not expires_at:
        return False

    try:
        expiry = datetime.fromisoformat(expires_at)
    except ValueError:
        return False

    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    return expiry > datetime.now(timezone.utc) + timedelta(minutes=5)


def get_dashboard_api_token(user) -> str:
    discord_id = str(getattr(user, "discord_id", "") or "").strip()
    if getattr(user, "is_admin", False):
        forced = (os.environ.get("DISSIDENT_FALLBACK_DISCORD_ID") or "").strip()
        if forced:
            discord_id = forced

    if not discord_id:
        if not getattr(user, "is_admin", False):
            raise ValueError("A Discord-linked account is required for moderation actions")
        discord_id = _fallback_discord_id() or ""
        if not discord_id:
            raise ValueError("No fallback Discord ID configured for admin moderation actions")

    if _token_cache_valid():
        return session["dissident_api_token"]

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    payload = {
        "userId": discord_id,
        "username": user.username,
        "avatar": user.avatar,
        "hubBridge": True,
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, _jwt_secret(), algorithm="HS256")

    session["dissident_api_token"] = token
    session["dissident_api_token_expires_at"] = expires_at.isoformat()
    return token


def call_dissident_api(method: str, path: str, user, *, json_payload: dict | None = None,
                       params: dict | None = None, timeout: int = 20) -> tuple[int, dict]:
    try:
        token = get_dashboard_api_token(user)
    except ValueError as exc:
        return 400, {"error": str(exc)}
    except RuntimeError as exc:
        return 503, {"error": str(exc)}

    try:
        response = requests.request(
            method.upper(),
            f"{_api_base_url()}/api/{path.lstrip('/')}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "X-Hub-Bridge": "1",
            },
            json=json_payload,
            params=params,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        return 502, {
            "error": "Could not reach Dissident API",
            "details": str(exc),
        }

    if response.status_code == 404:
        route_error = _route_missing_error(path)
        if route_error:
            return 503, route_error

    try:
        payload = response.json()
    except ValueError:
        payload = {"error": response.text or "Unexpected API response"}

    return response.status_code, payload