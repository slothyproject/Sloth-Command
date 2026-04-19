"""
Shared extension instances — import from here, not from app.py,
to avoid circular imports.
"""
import os

from flask_sqlalchemy import SQLAlchemy
import redis

db = SQLAlchemy()

redis_client = redis.from_url(
    os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    decode_responses=True,
)
