import os

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key-32chars-minimum!!")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("DISCORD_CLIENT_ID", "0")
os.environ.setdefault("DISCORD_CLIENT_SECRET", "test")
os.environ.setdefault("DISCORD_REDIRECT_URI", "http://localhost/auth/callback")


@pytest.fixture
def app():
    from dashboard.app import create_app
    from dashboard.extensions import db
    from dashboard.models import Guild, Ticket, User

    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })

    with app.app_context():
        admin = User(username="admin", discord_id="1411142904604528673", is_admin=True)
        admin.set_password("secret123")
        guild = Guild(discord_id="987654321012345678", name="Test Guild", is_active=True)
        db.session.add_all([admin, guild])
        db.session.flush()

        ticket = Ticket(
            guild_id=guild.id,
            ticket_number=1,
            opener_id="333333333333333333",
            opener_name="TicketUser",
            subject="Need help",
            status="open",
            priority="normal",
        )
        db.session.add(ticket)
        db.session.commit()

    return app


@pytest.fixture
def client(app):
    return app.test_client()


def _login(client):
    response = client.post(
        "/auth/login",
        data={"username": "admin", "password": "secret123"},
        follow_redirects=False,
    )
    assert response.status_code == 302


def test_ticket_status_updates_and_assignment(client):
    from dashboard.models import Ticket

    _login(client)

    resolved = client.post(
        "/api/tickets/1/status",
        json={"status": "resolved"},
    )
    assert resolved.status_code == 200
    assert resolved.get_json()["status"] == "resolved"

    assign = client.post(
        "/api/tickets/1/assign",
        json={"assigned_to": "admin"},
    )
    assert assign.status_code == 200
    assert assign.get_json()["assigned_to"] == "admin"

    closed = client.post(
        "/api/tickets/1/status",
        json={"status": "closed", "reason": "Completed"},
    )
    assert closed.status_code == 200
    assert closed.get_json()["status"] == "closed"

    with client.application.app_context():
        ticket = Ticket.query.get(1)
        assert ticket.status == "closed"
        assert ticket.closed_reason == "Completed"
        assert ticket.assigned_to == "admin"


def test_legacy_close_endpoint_still_works(client):
    from dashboard.models import Ticket

    _login(client)

    response = client.post("/api/tickets/1/close")
    assert response.status_code == 200
    assert response.get_json()["status"] == "closed"

    with client.application.app_context():
        ticket = Ticket.query.get(1)
        assert ticket.status == "closed"


def test_invalid_ticket_status_returns_400(client):
    _login(client)

    response = client.post(
        "/api/tickets/1/status",
        json={"status": "done_done"},
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "Invalid status"
