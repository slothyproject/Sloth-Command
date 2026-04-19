"""
Hub database models.
Bot-side models (64+ tables) live in the bot repo.
These are Hub-only: users, sessions, guilds mirror, audit log.
"""
from __future__ import annotations

from datetime import datetime, timezone

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

from dashboard.extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(UserMixin, db.Model):
    __tablename__ = "hub_users"

    id = db.Column(db.Integer, primary_key=True)
    discord_id = db.Column(db.String(32), unique=True, nullable=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    hashed_password = db.Column(db.String(256), nullable=True)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    last_login = db.Column(db.DateTime(timezone=True), nullable=True)

    def set_password(self, password: str) -> None:
        self.hashed_password = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.hashed_password or "", password)

    def __repr__(self) -> str:
        return f"<User {self.username}>"


class Guild(db.Model):
    """Mirror of Discord guild data, synced from the bot via Redis."""

    __tablename__ = "hub_guilds"

    id = db.Column(db.Integer, primary_key=True)
    discord_id = db.Column(db.String(32), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    icon = db.Column(db.String(256), nullable=True)
    member_count = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    joined_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    last_sync = db.Column(db.DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<Guild {self.name}>"


class AuditLog(db.Model):
    __tablename__ = "hub_audit_log"

    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(100), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey("hub_users.id"), nullable=True)
    target_type = db.Column(db.String(50), nullable=True)
    target_id = db.Column(db.String(100), nullable=True)
    details = db.Column(db.JSON, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    actor = db.relationship("User", backref="audit_logs")
