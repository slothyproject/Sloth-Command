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
HOMEPAGE_SECTIONS = {
    "features",
    "story",
    "docs",
    "faq",
    "status",
    "pricing",
    "roadmap",
    "developers",
    "legal",
}


def _app_redirect(path: str = "dashboard"):
    return redirect(f"{url_for('core.react_app')}/{path.lstrip('/')}")


def _serve_homepage_export(path: str = "index.html"):
    direct = HOMEPAGE_DIST / path
    if direct.exists() and direct.is_file():
        return send_from_directory(HOMEPAGE_DIST, path)

    index_path = HOMEPAGE_DIST / path / "index.html"
    if index_path.exists() and index_path.is_file():
        return send_from_directory(HOMEPAGE_DIST, f"{path.rstrip('/')}/index.html")

    fallback = HOMEPAGE_DIST / "index.html"
    if fallback.exists() and fallback.is_file():
        return send_from_directory(HOMEPAGE_DIST, "index.html")

    if current_user.is_authenticated:
        return _app_redirect("dashboard")
    return redirect(url_for("auth.login"))


@core_bp.get("/")
def index():
    return _serve_homepage_export("index.html")


@core_bp.get("/_next/<path:asset>")
def homepage_next_assets(asset: str):
    return _serve_homepage_export(f"_next/{asset}")


@core_bp.get("/robots.txt")
@core_bp.get("/sitemap.xml")
@core_bp.get("/sloth-lee-logo.png")
@core_bp.get("/sloth-lee-logo.svg")
@core_bp.get("/sloth-lee-ninja-logo.svg")
@core_bp.get("/sloth-monocle-logo.svg")
@core_bp.get("/sloth-lee-picsart-source.png")
@core_bp.get("/sloth-lee-favicon.png")
def homepage_root_assets():
    from flask import request

    return _serve_homepage_export(request.path.lstrip("/"))


@core_bp.get("/features")
@core_bp.get("/features/")
def homepage_features():
    return _serve_homepage_export("features")


@core_bp.get("/story")
@core_bp.get("/story/")
def homepage_story():
    return _serve_homepage_export("story")


@core_bp.get("/docs")
@core_bp.get("/docs/")
def homepage_docs():
    return _serve_homepage_export("docs")


@core_bp.get("/faq")
@core_bp.get("/faq/")
def homepage_faq():
    return _serve_homepage_export("faq")


@core_bp.get("/status")
@core_bp.get("/status/")
def homepage_status():
    return _serve_homepage_export("status")


@core_bp.get("/pricing")
@core_bp.get("/pricing/")
def homepage_pricing():
    return _serve_homepage_export("pricing")


@core_bp.get("/roadmap")
@core_bp.get("/roadmap/")
def homepage_roadmap():
    return _serve_homepage_export("roadmap")


@core_bp.get("/developers")
@core_bp.get("/developers/")
@core_bp.get("/developers/<path:subpath>")
def homepage_developers(subpath: str | None = None):
    if subpath:
        return _serve_homepage_export(f"developers/{subpath}")
    return _serve_homepage_export("developers")


@core_bp.get("/legal")
@core_bp.get("/legal/")
@core_bp.get("/legal/<path:subpath>")
def homepage_legal(subpath: str | None = None):
    if subpath:
        return _serve_homepage_export(f"legal/{subpath}")
    return _serve_homepage_export("legal")


@core_bp.get("/favicon.ico")
def homepage_favicon():
    return _serve_homepage_export("favicon.ico")


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


