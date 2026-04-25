"""
Sloth Lee Command Hub — application factory.
"""
from __future__ import annotations

import logging
import os

from flask import Flask
from flask_login import LoginManager
from flask_socketio import SocketIO
from flask_wtf.csrf import CSRFProtect
from werkzeug.middleware.proxy_fix import ProxyFix

from dashboard.extensions import db, limiter
from dashboard.routes.api import api_bp
from dashboard.routes.ai_advisor import advisor_bp
from dashboard.routes.auth import auth_bp
from dashboard.routes.core import core_bp
from dashboard.versioning import get_dashboard_version

log = logging.getLogger(__name__)

socketio = SocketIO()
login_manager = LoginManager()
csrf = CSRFProtect()


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    # ── Config ──────────────────────────────────────────────────
    # Railway provides postgres:// but SQLAlchemy 2.x requires postgresql://
    _db_url = os.environ.get("DATABASE_URL", "sqlite:///hub.db")
    if _db_url.startswith("postgres://"):
        _db_url = "postgresql://" + _db_url[len("postgres://"):]

    _secret_key = os.environ.get("SECRET_KEY", "")
    if not _secret_key:
        if not app.debug:
            raise RuntimeError(
                "SECRET_KEY environment variable must be set in production. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        _secret_key = "dev-secret-insecure-do-not-use-in-production"

    app.config.update(
        SECRET_KEY=_secret_key,
        SQLALCHEMY_DATABASE_URI=_db_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        # Always True: Railway always terminates TLS at the proxy level.
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        WTF_CSRF_TIME_LIMIT=3600,
    )
    if config:
        app.config.update(config)

    # ── Extensions ──────────────────────────────────────────────
    db.init_app(app)
    csrf.init_app(app)
    _allowed_origins = [
        o.strip()
        for o in os.environ.get("ALLOWED_ORIGINS", "https://slothlee.xyz").split(",")
        if o.strip()
    ]
    socketio.init_app(
        app,
        cors_allowed_origins=_allowed_origins,
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
    app.register_blueprint(advisor_bp, url_prefix="/api")
    csrf.exempt(advisor_bp)
    app.register_blueprint(auth_bp, url_prefix="/auth")

    # Exempt API routes from CSRF (they use token auth or are read-only)
    csrf.exempt(api_bp)

    # Static file routes should never consume rate-limit quota
    limiter.exempt(core_bp)

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
    # Trust one level of Railway reverse-proxy headers for real client IP.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)  # type: ignore[method-assign]
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

        # hub_dashboard_bot_credentials
        bcols = existing_cols("hub_dashboard_bot_credentials")
        if bcols is not None:
            if "encrypted_client_secret" not in bcols:
                migrations.append("ALTER TABLE hub_dashboard_bot_credentials ADD COLUMN encrypted_client_secret TEXT")
            if "client_secret_iv" not in bcols:
                migrations.append("ALTER TABLE hub_dashboard_bot_credentials ADD COLUMN client_secret_iv VARCHAR(120)")
            if "client_secret_hint" not in bcols:
                migrations.append("ALTER TABLE hub_dashboard_bot_credentials ADD COLUMN client_secret_hint VARCHAR(32)")

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


