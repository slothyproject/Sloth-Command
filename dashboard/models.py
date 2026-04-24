"""
Hub database models — full schema for multi-guild bot management.
"""
from __future__ import annotations

from datetime import datetime, timezone

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from dashboard.extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Users ────────────────────────────────────────────────────────

class User(UserMixin, db.Model):
    __tablename__ = "hub_users"

    id              = db.Column(db.Integer, primary_key=True)
    discord_id      = db.Column(db.String(32), unique=True, nullable=True, index=True)
    username        = db.Column(db.String(80), unique=True, nullable=False)
    discriminator   = db.Column(db.String(10), nullable=True)
    avatar          = db.Column(db.String(200), nullable=True)
    email           = db.Column(db.String(200), nullable=True)
    hashed_password = db.Column(db.String(256), nullable=True)
    is_owner        = db.Column(db.Boolean, default=False, nullable=False)
    is_admin        = db.Column(db.Boolean, default=False, nullable=False)
    is_active       = db.Column(db.Boolean, default=True, nullable=False)
    created_at      = db.Column(db.DateTime(timezone=True), default=utcnow)
    last_login      = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relationships
    guild_memberships = db.relationship("GuildMember", back_populates="user", lazy="dynamic")
    audit_logs        = db.relationship("AuditLog", back_populates="actor", lazy="dynamic")
    notifications     = db.relationship("Notification", back_populates="user", lazy="dynamic")
    ai_provider_credential = db.relationship(
        "UserAIProviderCredential",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    ai_provider_usage = db.relationship(
        "UserAIProviderUsageStat",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def set_password(self, password: str) -> None:
        self.hashed_password = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.hashed_password or "", password)

    def avatar_url(self, size: int = 64) -> str:
        if self.avatar and self.discord_id:
            ext = "gif" if self.avatar.startswith("a_") else "png"
            return f"https://cdn.discordapp.com/avatars/{self.discord_id}/{self.avatar}.{ext}?size={size}"
        # default avatar
        disc = int(self.discord_id or 0) % 5 if self.discord_id else 0
        return f"https://cdn.discordapp.com/embed/avatars/{disc}.png"

    def can_manage(self, guild: "Guild") -> bool:
        """True if user is admin or has owner/manager role in the guild."""
        if self.is_owner:
            return True
        if self.is_admin:
            return True
        if guild.owner_discord_id and guild.owner_discord_id == self.discord_id:
            return True
        membership = GuildMember.query.filter_by(
            user_id=self.id, guild_id=guild.id
        ).first()
        return membership is not None and membership.can_manage

    def __repr__(self) -> str:
        return f"<User {self.username}>"


# ── Guilds ───────────────────────────────────────────────────────

class Guild(db.Model):
    __tablename__ = "hub_guilds"

    id               = db.Column(db.Integer, primary_key=True)
    discord_id       = db.Column(db.String(32), unique=True, nullable=False, index=True)
    name             = db.Column(db.String(100), nullable=False)
    icon             = db.Column(db.String(200), nullable=True)
    banner           = db.Column(db.String(200), nullable=True)
    owner_discord_id = db.Column(db.String(32), nullable=True)
    member_count     = db.Column(db.Integer, default=0)
    channel_count    = db.Column(db.Integer, default=0)
    role_count       = db.Column(db.Integer, default=0)
    is_active        = db.Column(db.Boolean, default=True)
    bot_joined_at    = db.Column(db.DateTime(timezone=True), default=utcnow)
    joined_at        = db.Column(db.DateTime(timezone=True), default=utcnow)
    last_sync        = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relationships
    settings    = db.relationship("GuildSettings", back_populates="guild", uselist=False, cascade="all, delete-orphan")
    members     = db.relationship("GuildMember", back_populates="guild", lazy="dynamic", cascade="all, delete-orphan")
    mod_cases   = db.relationship("ModerationCase", back_populates="guild", lazy="dynamic", cascade="all, delete-orphan")
    tickets     = db.relationship("Ticket", back_populates="guild", lazy="dynamic", cascade="all, delete-orphan")
    commands    = db.relationship("GuildCommand", back_populates="guild", lazy="dynamic", cascade="all, delete-orphan")
    audit_logs  = db.relationship("AuditLog", back_populates="guild", lazy="dynamic")

    def icon_url(self, size: int = 64) -> str | None:
        if not self.icon or not self.discord_id:
            return None
        # Already a full URL — normalise to hash only
        icon = self.icon
        if icon.startswith("http"):
            # Extract hash from URL like https://cdn.discordapp.com/icons/ID/HASH.png?size=...
            import re
            m = re.search(r'/icons/\d+/([^.?]+)', icon)
            icon = m.group(1) if m else icon
        ext = "gif" if icon.startswith("a_") else "png"
        return f"https://cdn.discordapp.com/icons/{self.discord_id}/{icon}.{ext}?size={size}"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "discord_id": self.discord_id,
            "name": self.name,
            "icon": self.icon_url(64),
            "member_count": self.member_count,
            "channel_count": self.channel_count,
            "is_active": self.is_active,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
            "last_sync": self.last_sync.isoformat() if self.last_sync else None,
        }

    def __repr__(self) -> str:
        return f"<Guild {self.name}>"


class GuildSettings(db.Model):
    __tablename__ = "hub_guild_settings"

    id       = db.Column(db.Integer, primary_key=True)
    guild_id = db.Column(db.Integer, db.ForeignKey("hub_guilds.id", ondelete="CASCADE"), unique=True)

    # General
    prefix           = db.Column(db.String(10), default="!")
    language         = db.Column(db.String(10), default="en")
    timezone         = db.Column(db.String(50), default="UTC")

    # Moderation
    mod_log_channel  = db.Column(db.String(32), nullable=True)
    automod_enabled  = db.Column(db.Boolean, default=False)
    antinuke_enabled = db.Column(db.Boolean, default=False)
    max_warns        = db.Column(db.Integer, default=3)
    warn_action      = db.Column(db.String(20), default="mute")  # mute, kick, ban

    # Welcome
    welcome_channel  = db.Column(db.String(32), nullable=True)
    welcome_message  = db.Column(db.Text, nullable=True)
    farewell_channel = db.Column(db.String(32), nullable=True)

    # Tickets
    ticket_channel   = db.Column(db.String(32), nullable=True)
    ticket_category  = db.Column(db.String(32), nullable=True)
    ticket_role      = db.Column(db.String(32), nullable=True)

    # Leveling
    leveling_enabled = db.Column(db.Boolean, default=False)
    level_channel    = db.Column(db.String(32), nullable=True)
    xp_multiplier    = db.Column(db.Float, default=1.0)

    # Logging
    log_channel      = db.Column(db.String(32), nullable=True)
    log_joins        = db.Column(db.Boolean, default=True)
    log_leaves       = db.Column(db.Boolean, default=True)
    log_moderation   = db.Column(db.Boolean, default=True)
    log_messages     = db.Column(db.Boolean, default=False)

    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    guild = db.relationship("Guild", back_populates="settings")


class GuildMember(db.Model):
    """Hub users who have access to manage a specific guild."""
    __tablename__ = "hub_guild_members"
    __table_args__ = (db.UniqueConstraint("guild_id", "user_id"),)

    id         = db.Column(db.Integer, primary_key=True)
    guild_id   = db.Column(db.Integer, db.ForeignKey("hub_guilds.id", ondelete="CASCADE"))
    user_id    = db.Column(db.Integer, db.ForeignKey("hub_users.id", ondelete="CASCADE"))
    can_manage = db.Column(db.Boolean, default=False)
    added_at   = db.Column(db.DateTime(timezone=True), default=utcnow)

    guild = db.relationship("Guild", back_populates="members")
    user  = db.relationship("User", back_populates="guild_memberships")


class UserAIProviderCredential(db.Model):
    __tablename__ = "hub_user_ai_providers"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("hub_users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    provider = db.Column(db.String(40), nullable=False)
    model = db.Column(db.String(120), nullable=False)
    base_url = db.Column(db.String(500), nullable=True)
    encrypted_api_key = db.Column(db.Text, nullable=False)
    api_key_iv = db.Column(db.String(120), nullable=False)
    key_hint = db.Column(db.String(32), nullable=True)
    status = db.Column(db.String(32), nullable=False, default="active")
    usage_limit_requests_per_hour = db.Column(db.Integer, nullable=False, default=100)
    last_validated_at = db.Column(db.DateTime(timezone=True), nullable=True)
    validation_error = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = db.relationship("User", back_populates="ai_provider_credential")

    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "model": self.model,
            "base_url": self.base_url,
            "status": self.status,
            "key_hint": self.key_hint,
            "usage_limit_requests_per_hour": self.usage_limit_requests_per_hour,
            "last_validated_at": self.last_validated_at.isoformat() if self.last_validated_at else None,
            "validation_error": self.validation_error,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserAIProviderUsageStat(db.Model):
    __tablename__ = "hub_user_ai_provider_usage"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("hub_users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    current_hour_started_at = db.Column(db.DateTime(timezone=True), nullable=True)
    requests_this_hour = db.Column(db.Integer, nullable=False, default=0)
    tokens_this_hour = db.Column(db.Integer, nullable=False, default=0)
    lifetime_requests = db.Column(db.Integer, nullable=False, default=0)
    lifetime_tokens = db.Column(db.Integer, nullable=False, default=0)
    last_used_at = db.Column(db.DateTime(timezone=True), nullable=True)
    last_command = db.Column(db.String(40), nullable=True)
    last_error = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = db.relationship("User", back_populates="ai_provider_usage")

    def to_dict(self) -> dict:
        return {
            "current_hour_started_at": self.current_hour_started_at.isoformat() if self.current_hour_started_at else None,
            "requests_this_hour": self.requests_this_hour,
            "tokens_this_hour": self.tokens_this_hour,
            "lifetime_requests": self.lifetime_requests,
            "lifetime_tokens": self.lifetime_tokens,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "last_command": self.last_command,
            "last_error": self.last_error,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class DashboardBotCredential(db.Model):
    __tablename__ = "hub_dashboard_bot_credentials"

    id = db.Column(db.Integer, primary_key=True)
    bot_name = db.Column(db.String(120), nullable=True)
    client_id = db.Column(db.String(64), nullable=True)
    application_id = db.Column(db.String(64), nullable=True)
    public_key = db.Column(db.String(255), nullable=True)
    guild_id = db.Column(db.String(64), nullable=True)
    encrypted_token = db.Column(db.Text, nullable=True)
    token_iv = db.Column(db.String(120), nullable=True)
    token_hint = db.Column(db.String(32), nullable=True)
    encrypted_client_secret = db.Column(db.Text, nullable=True)
    client_secret_iv = db.Column(db.String(120), nullable=True)
    client_secret_hint = db.Column(db.String(32), nullable=True)
    status = db.Column(db.String(32), nullable=False, default="configured")
    updated_by_user_id = db.Column(db.Integer, db.ForeignKey("hub_users.id", ondelete="SET NULL"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    updated_by = db.relationship("User", foreign_keys=[updated_by_user_id])

    def to_dict(self) -> dict:
        return {
            "configured": bool(self.client_id or self.application_id or self.encrypted_token),
            "bot_name": self.bot_name,
            "client_id": self.client_id,
            "application_id": self.application_id,
            "public_key": self.public_key,
            "guild_id": self.guild_id,
            "token_hint": self.token_hint,
            "client_secret_hint": self.client_secret_hint,
            "status": self.status,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ── Commands ─────────────────────────────────────────────────────

class GuildCommand(db.Model):
    """Per-guild command enable/disable + config overrides."""
    __tablename__ = "hub_guild_commands"
    __table_args__ = (db.UniqueConstraint("guild_id", "command_name"),)

    id           = db.Column(db.Integer, primary_key=True)
    guild_id     = db.Column(db.Integer, db.ForeignKey("hub_guilds.id", ondelete="CASCADE"))
    command_name = db.Column(db.String(60), nullable=False)
    cog          = db.Column(db.String(60), nullable=True)
    is_enabled   = db.Column(db.Boolean, default=True)
    allowed_roles    = db.Column(db.JSON, default=list)
    disabled_channels = db.Column(db.JSON, default=list)
    cooldown_seconds  = db.Column(db.Integer, default=0)
    updated_at   = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    guild = db.relationship("Guild", back_populates="commands")


# ── Moderation ───────────────────────────────────────────────────

class ModerationCase(db.Model):
    __tablename__ = "hub_mod_cases"

    id              = db.Column(db.Integer, primary_key=True)
    guild_id        = db.Column(db.Integer, db.ForeignKey("hub_guilds.id", ondelete="CASCADE"), index=True)
    case_number     = db.Column(db.Integer, nullable=False)
    action          = db.Column(db.String(20), nullable=False)  # warn, mute, kick, ban, unban, unmute
    target_id       = db.Column(db.String(32), nullable=False, index=True)   # Discord user ID
    target_name     = db.Column(db.String(100), nullable=True)
    moderator_id    = db.Column(db.String(32), nullable=True)
    moderator_name  = db.Column(db.String(100), nullable=True)
    reason          = db.Column(db.Text, nullable=True)
    duration        = db.Column(db.String(50), nullable=True)  # e.g. "1d", "2h30m"
    expires_at      = db.Column(db.DateTime(timezone=True), nullable=True)
    is_active       = db.Column(db.Boolean, default=True)
    created_at      = db.Column(db.DateTime(timezone=True), default=utcnow, index=True)
    updated_at      = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    guild = db.relationship("Guild", back_populates="mod_cases")

    ACTION_COLOURS = {
        "warn": "amber", "mute": "purple", "kick": "red",
        "ban": "red", "unban": "green", "unmute": "green",
    }

    def colour(self) -> str:
        return self.ACTION_COLOURS.get(self.action, "default")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "case_number": self.case_number,
            "action": self.action,
            "target_id": self.target_id,
            "target_name": self.target_name,
            "moderator_name": self.moderator_name,
            "reason": self.reason,
            "duration": self.duration,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }


# ── Tickets ──────────────────────────────────────────────────────

class Ticket(db.Model):
    __tablename__ = "hub_tickets"

    id             = db.Column(db.Integer, primary_key=True)
    guild_id       = db.Column(db.Integer, db.ForeignKey("hub_guilds.id", ondelete="CASCADE"), index=True)
    ticket_number  = db.Column(db.Integer, nullable=False)
    channel_id     = db.Column(db.String(32), nullable=True)
    opener_id      = db.Column(db.String(32), nullable=False)
    opener_name    = db.Column(db.String(100), nullable=True)
    subject        = db.Column(db.String(200), nullable=True)
    status         = db.Column(db.String(20), default="open")  # open, closed, resolved
    priority       = db.Column(db.String(20), default="normal")  # low, normal, high, urgent
    assigned_to    = db.Column(db.String(100), nullable=True)
    closed_by      = db.Column(db.String(100), nullable=True)
    closed_reason  = db.Column(db.Text, nullable=True)
    message_count  = db.Column(db.Integer, default=0)
    created_at     = db.Column(db.DateTime(timezone=True), default=utcnow, index=True)
    updated_at     = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    closed_at      = db.Column(db.DateTime(timezone=True), nullable=True)

    guild    = db.relationship("Guild", back_populates="tickets")
    messages = db.relationship("TicketMessage", back_populates="ticket", lazy="dynamic", cascade="all, delete-orphan")

    STATUS_COLOURS = {"open": "green", "closed": "default", "resolved": "cyan"}

    def colour(self) -> str:
        return self.STATUS_COLOURS.get(self.status, "default")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "ticket_number": self.ticket_number,
            "opener_name": self.opener_name,
            "subject": self.subject or f"Ticket #{self.ticket_number}",
            "status": self.status,
            "priority": self.priority,
            "assigned_to": self.assigned_to,
            "message_count": self.message_count,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class TicketMessage(db.Model):
    __tablename__ = "hub_ticket_messages"

    id          = db.Column(db.Integer, primary_key=True)
    ticket_id   = db.Column(db.Integer, db.ForeignKey("hub_tickets.id", ondelete="CASCADE"), index=True)
    author_id   = db.Column(db.String(32), nullable=False)
    author_name = db.Column(db.String(100), nullable=True)
    content     = db.Column(db.Text, nullable=False)
    is_staff    = db.Column(db.Boolean, default=False)
    created_at  = db.Column(db.DateTime(timezone=True), default=utcnow)

    ticket = db.relationship("Ticket", back_populates="messages")


# ── Notifications ────────────────────────────────────────────────

class Notification(db.Model):
    __tablename__ = "hub_notifications"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("hub_users.id", ondelete="CASCADE"), index=True)
    guild_id   = db.Column(db.Integer, db.ForeignKey("hub_guilds.id", ondelete="SET NULL"), nullable=True)
    type       = db.Column(db.String(40), nullable=False)  # guild_join, guild_leave, mod_action, ticket_open, etc.
    title      = db.Column(db.String(200), nullable=False)
    body       = db.Column(db.Text, nullable=True)
    link       = db.Column(db.String(200), nullable=True)
    is_read    = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, index=True)

    user  = db.relationship("User", back_populates="notifications")
    guild = db.relationship("Guild", foreign_keys=[guild_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "body": self.body,
            "link": self.link,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }


# ── Bot events (webhook ingest) ──────────────────────────────────

class BotEvent(db.Model):
    """Raw events posted by the bot via webhook for audit/replay."""
    __tablename__ = "hub_bot_events"

    id         = db.Column(db.Integer, primary_key=True)
    guild_id   = db.Column(db.Integer, db.ForeignKey("hub_guilds.id", ondelete="SET NULL"), nullable=True)
    event_type = db.Column(db.String(60), nullable=False, index=True)
    payload    = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, index=True)

    guild = db.relationship("Guild", foreign_keys=[guild_id])


# ── Audit Log ────────────────────────────────────────────────────

class AuditLog(db.Model):
    __tablename__ = "hub_audit_log"

    id          = db.Column(db.Integer, primary_key=True)
    action      = db.Column(db.String(100), nullable=False)
    actor_id    = db.Column(db.Integer, db.ForeignKey("hub_users.id", ondelete="SET NULL"), nullable=True)
    guild_id    = db.Column(db.Integer, db.ForeignKey("hub_guilds.id", ondelete="SET NULL"), nullable=True)
    target_type = db.Column(db.String(50), nullable=True)
    target_id   = db.Column(db.String(100), nullable=True)
    details     = db.Column(db.JSON, nullable=True)
    ip_address  = db.Column(db.String(45), nullable=True)
    created_at  = db.Column(db.DateTime(timezone=True), default=utcnow, index=True)

    actor = db.relationship("User", back_populates="audit_logs")
    guild = db.relationship("Guild", back_populates="audit_logs")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "action": self.action,
            "actor": self.actor.username if self.actor else None,
            "guild": self.guild.name if self.guild else None,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat(),
        }
