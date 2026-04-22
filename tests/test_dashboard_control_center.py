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
    from dashboard.models import Guild, User

    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "RATELIMIT_STORAGE_URI": "memory://",
    })

    with app.app_context():
        admin = User(username="admin", discord_id="1411142904604528673", is_admin=True)
        admin.set_password("secret123")
        guild = Guild(discord_id="987654321012345678", name="Test Guild", is_active=True)
        db.session.add_all([admin, guild])
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


def test_dashboard_renders_control_center_and_timeline(client):
    _login(client)

    response = client.get("/dashboard")

    assert response.status_code == 200
    html = response.data

    assert b'id="command-palette"' in html
    assert b'id="incident-timeline"' in html
    assert b'id="wb-refresh-rate"' in html
    assert b'id="wb-toggle-refresh"' in html
    assert b'id="wb-copy-report"' in html
    assert b'id="wb-download-report"' in html
    assert b'id="wb-runbook-note"' in html
    assert b'id="priority-sort"' in html
