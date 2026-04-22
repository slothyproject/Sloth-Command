"""
Core page routes — all HTML views.
"""
from __future__ import annotations

from pathlib import Path

from flask import Blueprint, abort, redirect, render_template, request, send_from_directory, url_for
from flask_login import current_user, login_required

from dashboard.models import Guild, ModerationCase, Notification, Ticket, User
from dashboard.services.bot_state import get_bot_state

core_bp = Blueprint("core", __name__)
HOMEPAGE_DIST = Path(__file__).resolve().parents[1] / "static" / "homepage"


def _serve_homepage_export(path: str = "index.html"):
    direct = HOMEPAGE_DIST / path
    if direct.exists() and direct.is_file():
        return send_from_directory(HOMEPAGE_DIST, path)

    index_path = HOMEPAGE_DIST / path / "index.html"
    if index_path.exists() and index_path.is_file():
        return send_from_directory(HOMEPAGE_DIST, f"{path.rstrip('/')}/index.html")

    if current_user.is_authenticated:
        return redirect(url_for("core.dashboard"))
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
@core_bp.get("/docs/<path:subpath>")
def homepage_docs(subpath: str | None = None):
    if subpath:
        return _serve_homepage_export(f"docs/{subpath}")
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
    bot = get_bot_state()

    if current_user.is_admin:
        guilds = Guild.query.filter_by(is_active=True).order_by(Guild.name).all()
    else:
        from dashboard.models import GuildMember
        managed_ids = [m.guild_id for m in GuildMember.query.filter_by(user_id=current_user.id)]
        owner_guilds = Guild.query.filter_by(owner_discord_id=current_user.discord_id, is_active=True).all()
        all_ids = list(set(managed_ids + [g.id for g in owner_guilds]))
        guilds = Guild.query.filter(Guild.id.in_(all_ids)).order_by(Guild.name).all()

    unread_notifs = Notification.query.filter_by(
        user_id=current_user.id, is_read=False
    ).count() if current_user.is_authenticated else 0

    return render_template(
        "pages/dashboard.html",
        bot=bot, guilds=guilds,
        unread_notifs=unread_notifs,
        active="dashboard",
    )


@core_bp.get("/servers")
@login_required
def servers():
    if current_user.is_admin:
        guilds = Guild.query.filter_by(is_active=True).order_by(Guild.name).all()
    else:
        from dashboard.models import GuildMember
        managed_ids = [m.guild_id for m in GuildMember.query.filter_by(user_id=current_user.id)]
        owner_ids = [g.id for g in Guild.query.filter_by(owner_discord_id=current_user.discord_id, is_active=True)]
        all_ids = list(set(managed_ids + owner_ids))
        guilds = Guild.query.filter(Guild.id.in_(all_ids)).order_by(Guild.name).all()

    return render_template("pages/servers.html", guilds=guilds, active="servers")


@core_bp.get("/servers/<int:guild_id>")
@login_required
def server_detail(guild_id: int):
    guild = Guild.query.get_or_404(guild_id)
    if not current_user.can_manage(guild):
        abort(403)

    # Ensure settings exist
    if not guild.settings:
        from dashboard.extensions import db
        from dashboard.models import GuildSettings
        guild.settings = GuildSettings(guild_id=guild.id)
        db.session.add(guild.settings)
        db.session.commit()

    recent_cases = guild.mod_cases.order_by(
        ModerationCase.created_at.desc()
    ).limit(5).all()

    open_tickets = guild.tickets.filter_by(status="open").order_by(
        Ticket.created_at.desc()
    ).limit(5).all()

    bot = get_bot_state()
    # Find this guild in bot state
    guild_data = next(
        (g for g in bot.get("guilds", []) if str(g.get("id")) == guild.discord_id),
        {}
    )

    return render_template(
        "pages/server_detail.html",
        guild=guild,
        guild_data=guild_data,
        recent_cases=recent_cases,
        open_tickets=open_tickets,
        active="servers",
    )


@core_bp.get("/servers/<int:guild_id>/settings")
@login_required
def server_settings(guild_id: int):
    guild = Guild.query.get_or_404(guild_id)
    if not current_user.can_manage(guild):
        abort(403)
    return render_template("pages/server_settings.html", guild=guild, active="servers")


@core_bp.get("/servers/<int:guild_id>/moderation")
@login_required
def server_moderation(guild_id: int):
    guild = Guild.query.get_or_404(guild_id)
    if not current_user.can_manage(guild):
        abort(403)
    return render_template("pages/server_moderation.html", guild=guild, active="moderation")


@core_bp.get("/servers/<int:guild_id>/tickets")
@login_required
def server_tickets(guild_id: int):
    guild = Guild.query.get_or_404(guild_id)
    if not current_user.can_manage(guild):
        abort(403)
    return render_template("pages/server_tickets.html", guild=guild, active="tickets")




@core_bp.get("/servers/<int:guild_id>/commands")
@login_required
def server_commands(guild_id: int):
    guild = Guild.query.get_or_404(guild_id)
    if not current_user.can_manage(guild):
        abort(403)
    return render_template("pages/server_commands.html", guild=guild, active="servers")

@core_bp.get("/moderation")
@login_required
def moderation():
    if current_user.is_admin:
        recent = ModerationCase.query.order_by(
            ModerationCase.created_at.desc()
        ).limit(50).all()
    else:
        from dashboard.models import GuildMember
        ids = [m.guild_id for m in GuildMember.query.filter_by(user_id=current_user.id)]
        recent = ModerationCase.query.filter(
            ModerationCase.guild_id.in_(ids)
        ).order_by(ModerationCase.created_at.desc()).limit(50).all()

    return render_template("pages/moderation.html", cases=recent, active="moderation")




@core_bp.get("/tickets/<int:ticket_id>")
@login_required
def ticket_detail(ticket_id: int):
    from dashboard.models import Ticket
    ticket = Ticket.query.get_or_404(ticket_id)
    guild = Guild.query.get(ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        abort(403)
    return render_template("pages/ticket_detail.html", ticket=ticket, active="tickets")

@core_bp.get("/tickets")
@login_required
def tickets():
    if current_user.is_admin:
        open_tickets = Ticket.query.order_by(
            Ticket.created_at.desc()
        ).limit(100).all()
    else:
        from dashboard.models import GuildMember
        ids = [m.guild_id for m in GuildMember.query.filter_by(user_id=current_user.id)]
        open_tickets = Ticket.query.filter(
            Ticket.guild_id.in_(ids)
        ).order_by(Ticket.created_at.desc()).limit(50).all()

    return render_template("pages/tickets.html", tickets=open_tickets, active="tickets")
@core_bp.get("/logs")
@login_required
def logs():
    return render_template("pages/logs.html", active="logs")


@core_bp.get("/ai-advisor")
@login_required
def ai_advisor():
    return render_template("pages/ai_advisor.html", active="ai_advisor")


@core_bp.get("/settings")
@login_required
def settings():
    return render_template("pages/settings.html", active="settings")


@core_bp.get("/users")
@login_required
def users():
    if not current_user.is_admin:
        return redirect(url_for("core.dashboard"))
    all_users = User.query.order_by(User.username).all()
    return render_template("pages/users.html", users=all_users, active="users")


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


