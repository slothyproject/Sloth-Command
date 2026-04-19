"""
Dissident Central Hub — application factory.
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
        return {"status": "ok", "service": "dissident-central-hub", "version": "1.0.0"}

    # ── DB init ─────────────────────────────────────────────────
    with app.app_context():
        db.create_all()
        _ensure_admin_user(app)

    log.info("Dissident Central Hub started")
    return app


def _ensure_admin_user(app: Flask) -> None:
    """Create the initial admin user from env vars if it doesn't exist."""
    from dashboard.models import User

    admin_user = os.environ.get("ADMIN_USER")
    admin_pass = os.environ.get("ADMIN_PASS")
    if not admin_user or not admin_pass:
        return

    existing = User.query.filter_by(username=admin_user).first()
    if not existing:
        user = User(username=admin_user, is_admin=True)
        user.set_password(admin_pass)
        db.session.add(user)
        db.session.commit()
        log.info("Admin user '%s' created", admin_user)
