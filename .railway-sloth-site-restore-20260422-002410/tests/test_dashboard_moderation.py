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
    })

    with app.app_context():
        admin = User(username="admin", discord_id="1411142904604528673", is_admin=True)
        admin.set_password("secret123")
        local_admin = User(username="localadmin", is_admin=True)
        local_admin.set_password("secret123")
        guild = Guild(discord_id="987654321012345678", name="Test Guild", is_active=True)
        db.session.add_all([admin, local_admin, guild])
        db.session.commit()

    return app


@pytest.fixture
def client(app):
    return app.test_client()


def _login(client, username: str):
    response = client.post(
        "/auth/login",
        data={"username": username, "password": "secret123"},
        follow_redirects=False,
    )
    assert response.status_code == 302


def test_moderation_action_records_case_and_returns_backend_payload(app, client, monkeypatch):
    from dashboard.models import ModerationCase
    from dashboard.routes import api as api_routes

    _login(client, "admin")

    def fake_call(method, path, user, **kwargs):
        assert method == "POST"
        assert path == "moderation/ban"
        assert user.discord_id == "1411142904604528673"
        assert kwargs["json_payload"]["guildId"] == "987654321012345678"
        assert kwargs["json_payload"]["userId"] == "222222222222222222"
        return 200, {
            "success": True,
            "action": "ban",
            "userId": "222222222222222222",
            "caseId": "CASE-123",
        }

    monkeypatch.setattr(api_routes, "call_dissident_api", fake_call)

    response = client.post(
        "/api/guilds/1/moderation/actions",
        json={
            "action": "ban",
            "user_id": "222222222222222222",
            "target_name": "BadActor",
            "reason": "Repeated abuse",
            "delete_messages": True,
        },
    )

    assert response.status_code == 200
    assert response.get_json()["caseId"] == "CASE-123"

    with app.app_context():
        case = ModerationCase.query.one()
        assert case.action == "ban"
        assert case.target_id == "222222222222222222"
        assert case.target_name == "BadActor"
        assert case.moderator_id == "1411142904604528673"


def test_global_ban_create_records_case_for_source_guild(app, client, monkeypatch):
    from dashboard.models import ModerationCase
    from dashboard.routes import api as api_routes

    _login(client, "admin")

    def fake_call(method, path, user, **kwargs):
        assert method == "POST"
        assert path == "moderation/global-ban"
        payload = kwargs["json_payload"]
        assert payload["sourceGuildId"] == "987654321012345678"
        return 200, {
            "success": True,
            "userId": "333333333333333333",
            "reason": "Cross-server abuse",
        }

    monkeypatch.setattr(api_routes, "call_dissident_api", fake_call)

    response = client.post(
        "/api/moderation/global-bans",
        json={
            "user_id": "333333333333333333",
            "username": "RaidUser",
            "reason": "Cross-server abuse",
            "evidence": "ticket links",
            "source_guild_id": 1,
            "delete_messages": True,
        },
    )

    assert response.status_code == 200
    assert response.get_json()["success"] is True

    with app.app_context():
        case = ModerationCase.query.filter_by(action="global_ban").one()
        assert case.guild_id == 1
        assert case.target_id == "333333333333333333"
        assert case.reason == "Cross-server abuse"


def test_local_admin_without_discord_link_gets_clear_error(client):
    _login(client, "localadmin")

    response = client.post(
        "/api/guilds/1/moderation/actions",
        json={
            "action": "kick",
            "user_id": "444444444444444444",
            "reason": "Test",
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "A Discord-linked account is required for moderation actions"