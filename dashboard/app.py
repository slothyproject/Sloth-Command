"""
Dissident Central Hub — dashboard application factory.
"""
from __future__ import annotations

import os
import logging

from flask import Flask
from flask_login import LoginManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_socketio import SocketIO

from dashboard.extensions import db
from dashboard.routes.core import core_bp
from dashboard.routes.api import api_bp
from dashboard.routes.auth import auth_bp

log = logging.getLogger(__name__)

socketio = SocketIO()
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per day", "50 per hour"])
login_manager = LoginManager()


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    # ── Config ──────────────────────────────────────────────────
    app.config.update(
        SECRET_KEY=os.environ["SECRET_KEY"],
        SQLALCHEMY_DATABASE_URI=os.environ["DATABASE_URL"],
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SESSION_COOKIE_SECURE=os.environ.get("FLASK_ENV") == "production",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )
    if config:
        app.config.update(config)

    # ── Extensions ──────────────────────────────────────────────
    db.init_app(app)
    socketio.init_app(
        app,
        cors_allowed_origins="*",
        message_queue=os.environ.get("REDIS_URL"),
        async_mode="gevent",
    )
    limiter.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"  # type: ignore[assignment]

    # ── Blueprints ──────────────────────────────────────────────
    app.register_blueprint(core_bp)
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/auth")

    # ── Health endpoint (no auth, always fast) ──────────────────
    @app.get("/health")
    def health():
        return {"status": "ok", "service": "dissident-central-hub"}

    log.info("Dissident Central Hub started")
    return app


# Gunicorn entry point
app = create_app()
