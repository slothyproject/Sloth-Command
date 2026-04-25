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

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["300 per day", "60 per hour"],
    storage_uri=os.environ.get("REDIS_URL") or "memory://",
    swallow_errors=True,
    in_memory_fallback_enabled=True,
)

redis_client = redis.from_url(
    os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    decode_responses=True,
)
