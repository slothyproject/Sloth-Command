"""
Core page routes — all HTML views.
"""
from __future__ import annotations

from pathlib import Path

from flask import Blueprint, redirect, send_from_directory, url_for
from flask_login import current_user, login_required

core_bp = Blueprint("core", __name__)
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
HOMEPAGE_DIST = Path(__file__).resolve().parents[1] / "static" / "homepage"


def _app_redirect(path: str = "dashboard"):
    return redirect(f"{url_for('core.react_app')}/{path.lstrip('/')}")


@core_bp.get("/")
def index():
    if HOMEPAGE_DIST.exists():
        return send_from_directory(HOMEPAGE_DIST, "index.html")
    if current_user.is_authenticated:
        return _app_redirect("dashboard")
    return redirect(url_for("auth.login"))


@core_bp.get("/styles/<path:asset>")
def homepage_style_assets(asset: str):
    return send_from_directory(HOMEPAGE_DIST, asset)


@core_bp.get("/favicon.ico")
def homepage_favicon():
    if (HOMEPAGE_DIST / "favicon.ico").exists():
        return send_from_directory(HOMEPAGE_DIST, "favicon.ico")
    return ("", 204)


@core_bp.get("/dashboard")
@login_required
def dashboard():
    return _app_redirect("dashboard")


@core_bp.get("/servers")
@login_required
def servers():
    return _app_redirect("servers")


@core_bp.get("/servers/<int:guild_id>")
@login_required
def server_detail(guild_id: int):
    return _app_redirect("servers")


@core_bp.get("/servers/<int:guild_id>/settings")
@login_required
def server_settings(guild_id: int):
    return _app_redirect("servers")


@core_bp.get("/servers/<int:guild_id>/moderation")
@login_required
def server_moderation(guild_id: int):
    return _app_redirect("moderation")


@core_bp.get("/servers/<int:guild_id>/tickets")
@login_required
def server_tickets(guild_id: int):
    return _app_redirect("tickets")




@core_bp.get("/servers/<int:guild_id>/commands")
@login_required
def server_commands(guild_id: int):
    return _app_redirect("servers")

@core_bp.get("/moderation")
@login_required
def moderation():
    return _app_redirect("moderation")




@core_bp.get("/tickets/<int:ticket_id>")
@login_required
def ticket_detail(ticket_id: int):
    return _app_redirect(f"tickets/{ticket_id}")

@core_bp.get("/tickets")
@login_required
def tickets():
    return _app_redirect("tickets")
@core_bp.get("/logs")
@login_required
def logs():
    return _app_redirect("logs")


@core_bp.get("/ai-advisor")
@login_required
def ai_advisor():
    return _app_redirect("ai-advisor")


@core_bp.get("/settings")
@login_required
def settings():
    return _app_redirect("settings")


@core_bp.get("/users")
@login_required
def users():
    if not current_user.is_admin:
        return _app_redirect("dashboard")
    return _app_redirect("users")


@core_bp.get("/invite")
@login_required
def invite():
    import os
    client_id = os.environ.get("DISCORD_CLIENT_ID", "")
    url = f"https://discord.com/oauth2/authorize?client_id={client_id}&permissions=8&scope=bot%20applications.commands"
    return redirect(url)


@core_bp.get("/login")
def login_redirect():
    return redirect(url_for("auth.login"))


@core_bp.get("/app")
@core_bp.get("/app/")
@core_bp.get("/app/<path:path>")
def react_app(path: str = "index.html"):
    if not FRONTEND_DIST.exists():
        return redirect(url_for("auth.login"))

    target = FRONTEND_DIST / path
    if path and target.exists() and target.is_file():
        return send_from_directory(FRONTEND_DIST, path)

    return send_from_directory(FRONTEND_DIST, "index.html")


