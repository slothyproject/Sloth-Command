"""
Core page routes — HTML views for the dashboard.
"""
from __future__ import annotations

from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user

from dashboard.models import Guild
from dashboard.services.bot_state import get_bot_state

core_bp = Blueprint("core", __name__)


@core_bp.get("/")
def index():
    if current_user.is_authenticated:
        return redirect(url_for("core.dashboard"))
    return redirect(url_for("auth.login"))


@core_bp.get("/dashboard")
@login_required
def dashboard():
    bot = get_bot_state()
    guilds = Guild.query.filter_by(is_active=True).order_by(Guild.name).all()
    return render_template(
        "pages/dashboard.html",
        bot=bot,
        guilds=guilds,
        active="dashboard",
    )


@core_bp.get("/servers")
@login_required
def servers():
    guilds = Guild.query.filter_by(is_active=True).order_by(Guild.name).all()
    return render_template("pages/servers.html", guilds=guilds, active="servers")


@core_bp.get("/servers/<int:guild_id>")
@login_required
def server_detail(guild_id: int):
    guild = Guild.query.get_or_404(guild_id)
    return render_template("pages/server_detail.html", guild=guild, active="servers")


@core_bp.get("/moderation")
@login_required
def moderation():
    return render_template("pages/moderation.html", active="moderation")


@core_bp.get("/tickets")
@login_required
def tickets():
    return render_template("pages/tickets.html", active="tickets")


@core_bp.get("/logs")
@login_required
def logs():
    return render_template("pages/logs.html", active="logs")


@core_bp.get("/settings")
@login_required
def settings():
    return render_template("pages/settings.html", active="settings")


@core_bp.get("/users")
@login_required
def users():
    if not current_user.is_admin:
        return redirect(url_for("core.dashboard"))
    return render_template("pages/users.html", active="users")


@core_bp.get("/login")
def login_redirect():
    """Redirect /login → /auth/login for convenience."""
    from flask import redirect, url_for
    return redirect(url_for("auth.login"))
