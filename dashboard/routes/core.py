"""
Core page routes — all HTML views.
"""
from __future__ import annotations

from flask import Blueprint, abort, redirect, render_template, url_for
from flask_login import current_user, login_required

from dashboard.models import Guild, ModerationCase, Notification, Ticket, User
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
        open_tickets = Ticket.query.filter_by(status="open").order_by(
            Ticket.created_at.desc()
        ).limit(50).all()
    else:
        from dashboard.models import GuildMember
        ids = [m.guild_id for m in GuildMember.query.filter_by(user_id=current_user.id)]
        open_tickets = Ticket.query.filter(
            Ticket.guild_id.in_(ids), Ticket.status == "open"
        ).order_by(Ticket.created_at.desc()).limit(50).all()

    return render_template("pages/tickets.html", tickets=open_tickets, active="tickets")



@core_bp.get("/tickets/<int:ticket_id>")
@login_required
def ticket_detail(ticket_id: int):
    from dashboard.models import Ticket
    ticket = Ticket.query.get_or_404(ticket_id)
    guild = Guild.query.get(ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        abort(403)
    return render_template("pages/ticket_detail.html", ticket=ticket, active="tickets")

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


