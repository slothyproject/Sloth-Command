"""
Sloth Lee Command Hub — application factory.
"""
from __future__ import annotations

import logging
import os

from flask import Flask
from flask_login import LoginManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_socketio import SocketIO
from flask_wtf.csrf import CSRFProtect

from dashboard.extensions import db
from dashboard.routes.api import api_bp
from dashboard.routes.auth import auth_bp
from dashboard.routes.core import core_bp
from dashboard.versioning import get_dashboard_version

log = logging.getLogger(__name__)

socketio = SocketIO()
limiter = Limiter(key_func=get_remote_address, default_limits=["300 per day", "60 per hour"])
login_manager = LoginManager()
csrf = CSRFProtect()


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    # ── Config ──────────────────────────────────────────────────
    app.config.update(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret-change-me"),
        SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL", "sqlite:///hub.db"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SESSION_COOKIE_SECURE=os.environ.get("FLASK_ENV") == "production",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        WTF_CSRF_TIME_LIMIT=3600,
        RATELIMIT_STORAGE_URI=os.environ.get("REDIS_URL") or "memory://",
    )
    if config:
        app.config.update(config)

    # ── Extensions ──────────────────────────────────────────────
    db.init_app(app)
    csrf.init_app(app)
    socketio.init_app(
        app,
        cors_allowed_origins="*",
        message_queue=os.environ.get("REDIS_URL"),
        async_mode="gevent",
    )
    limiter.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"  # type: ignore[assignment]
    login_manager.login_message = "Please sign in to continue."
    login_manager.login_message_category = "info"

    # ── User loader ─────────────────────────────────────────────
    from dashboard.models import User

    @login_manager.user_loader
    def load_user(user_id: str):
        return db.session.get(User, int(user_id))

    # ── Blueprints ──────────────────────────────────────────────
    app.register_blueprint(core_bp)
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/auth")

    # Exempt API routes from CSRF (they use token auth or are read-only)
    csrf.exempt(api_bp)

    # ── Health endpoint ─────────────────────────────────────────
    @app.get("/health")
    def health():
        return {"status": "ok", "service": "sloth-lee-command-hub", "version": get_dashboard_version()}

    # ── Template context processor ──────────────────────────────
    @app.context_processor
    def inject_version():
        return {"dashboard_version": get_dashboard_version()}

    # ── DB init ─────────────────────────────────────────────────
    # Run migrations first (ALTER TABLE for new columns on existing tables)
    _run_migrations(app)
    with app.app_context():
        db.create_all()
        _ensure_admin_user(app)
    log.info("Sloth Lee Command Hub started")
    return app

def _run_migrations(app: Flask) -> None:
    """Add missing columns to existing tables — safe for repeated runs."""
    from sqlalchemy import inspect
    with app.app_context():
        inspector = inspect(db.engine)
        existing_tables = inspector.get_table_names()

        def existing_cols(table):
            if table not in existing_tables:
                return None
            return {c["name"] for c in inspector.get_columns(table)}

        migrations = []

        # hub_users
        ucols = existing_cols("hub_users")
        if ucols is not None:
            if "discriminator" not in ucols:
                migrations.append("ALTER TABLE hub_users ADD COLUMN discriminator VARCHAR(10)")
            if "avatar" not in ucols:
                migrations.append("ALTER TABLE hub_users ADD COLUMN avatar VARCHAR(200)")
            if "email" not in ucols:
                migrations.append("ALTER TABLE hub_users ADD COLUMN email VARCHAR(200)")
            if "is_owner" not in ucols:
                migrations.append("ALTER TABLE hub_users ADD COLUMN is_owner BOOLEAN DEFAULT FALSE")

        # hub_guilds
        gcols = existing_cols("hub_guilds")
        if gcols is not None:
            if "banner" not in gcols:
                migrations.append("ALTER TABLE hub_guilds ADD COLUMN banner VARCHAR(200)")
            if "owner_discord_id" not in gcols:
                migrations.append("ALTER TABLE hub_guilds ADD COLUMN owner_discord_id VARCHAR(32)")
            if "channel_count" not in gcols:
                migrations.append("ALTER TABLE hub_guilds ADD COLUMN channel_count INTEGER DEFAULT 0")
            if "role_count" not in gcols:
                migrations.append("ALTER TABLE hub_guilds ADD COLUMN role_count INTEGER DEFAULT 0")
            if "bot_joined_at" not in gcols:
                migrations.append("ALTER TABLE hub_guilds ADD COLUMN bot_joined_at TIMESTAMPTZ DEFAULT NOW()")

        # hub_audit_log
        acols = existing_cols("hub_audit_log")
        if acols is not None:
            if "guild_id" not in acols:
                migrations.append("ALTER TABLE hub_audit_log ADD COLUMN guild_id INTEGER")
            if "details" not in acols:
                migrations.append("ALTER TABLE hub_audit_log ADD COLUMN details JSONB")

        if not migrations:
            log.info("Schema up to date — no migrations needed")
            return

        # Use autocommit for DDL so changes are immediately visible
        raw_conn = db.engine.raw_connection()
        try:
            raw_conn.set_isolation_level(0)  # ISOLATION_LEVEL_AUTOCOMMIT
            cur = raw_conn.cursor()
            for sql in migrations:
                try:
                    cur.execute(sql)
                    log.info("Migration OK: %s", sql[:60])
                except Exception as e:
                    log.warning("Migration skipped: %s — %s", sql[:60], e)
            cur.close()
        finally:
            raw_conn.set_isolation_level(1)  # restore READ_COMMITTED
            raw_conn.close()
        log.info("Schema migrations complete (%d applied)", len(migrations))


def _ensure_admin_user(app: Flask) -> None:
    """Create the initial admin user and promote any Discord owner accounts."""
    from dashboard.models import User

    # 1. Create/maintain the local admin account
    admin_user = os.environ.get("ADMIN_USER")
    admin_pass = os.environ.get("ADMIN_PASS")
    if admin_user and admin_pass:
        existing = User.query.filter_by(username=admin_user).first()
        if not existing:
            user = User(username=admin_user, is_admin=True)
            user.set_password(admin_pass)
            db.session.add(user)
            db.session.commit()
            log.info("Admin user '%s' created", admin_user)
        elif not existing.is_admin:
            existing.is_admin = True
            db.session.commit()

    # 2. Grant admin to any Discord accounts listed in DISCORD_ADMIN_IDS
    # Format: comma-separated Discord user IDs
    admin_ids_raw = os.environ.get("DISCORD_ADMIN_IDS", "")
    if admin_ids_raw:
        admin_ids = [i.strip() for i in admin_ids_raw.split(",") if i.strip()]
        updated = User.query.filter(
            User.discord_id.in_(admin_ids),
            User.is_admin == False  # noqa: E712
        ).update({"is_admin": True}, synchronize_session=False)
        if updated:
            db.session.commit()
            log.info("Granted admin to %d Discord user(s) via DISCORD_ADMIN_IDS", updated)

    # 3. Promote dashboard owners. Defaults to sirtibbles69 for this deployment.
    owner_usernames_raw = os.environ.get("DASHBOARD_OWNER_USERNAMES", "sirtibbles69")
    owner_usernames = [u.strip() for u in owner_usernames_raw.split(",") if u.strip()]
    owner_ids_raw = os.environ.get("DISCORD_OWNER_IDS", "")
    owner_ids = [i.strip() for i in owner_ids_raw.split(",") if i.strip()]

    owners_changed = False
    if owner_usernames:
        username_matches = User.query.filter(User.username.in_(owner_usernames)).all()
        for owner in username_matches:
            if not owner.is_owner or not owner.is_admin:
                owner.is_owner = True
                owner.is_admin = True
                owners_changed = True

    if owner_ids:
        discord_matches = User.query.filter(User.discord_id.in_(owner_ids)).all()
        for owner in discord_matches:
            if not owner.is_owner or not owner.is_admin:
                owner.is_owner = True
                owner.is_admin = True
                owners_changed = True

    if owners_changed:
        db.session.commit()
        log.info("Applied dashboard owner promotion rules")


# Gunicorn entry point — must exist at module level
app = create_app()


