"""
Shared extension instances — import from here, not from app.py,
to avoid circular imports.
"""
import os

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_sqlalchemy import SQLAlchemy
import redis

db = SQLAlchemy()


def _rate_limit_key() -> str:
    """Key by authenticated user ID for API routes; fall back to IP."""
    try:
        from flask_login import current_user
        if current_user and current_user.is_authenticated:
            return f"user:{current_user.id}"
    except Exception:
        pass
    return get_remote_address()


limiter = Limiter(
    key_func=_rate_limit_key,
    default_limits=["10000 per day", "2000 per hour"],
    storage_uri=os.environ.get("REDIS_URL") or "memory://",
    swallow_errors=True,
    in_memory_fallback_enabled=True,
)

redis_client = redis.from_url(
    os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    decode_responses=True,
)
