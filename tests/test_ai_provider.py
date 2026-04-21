import base64
import os

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key-32chars-minimum!!")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("DISCORD_CLIENT_ID", "0")
os.environ.setdefault("DISCORD_CLIENT_SECRET", "test")
os.environ.setdefault("DISCORD_REDIRECT_URI", "http://localhost/auth/callback")
os.environ.setdefault(
    "AI_PROVIDER_ENCRYPTION_KEY",
    base64.b64encode(b"0123456789abcdef0123456789abcdef").decode("ascii"),
)


@pytest.fixture
def app():
    from dashboard.app import create_app
    from dashboard.extensions import db
    from dashboard.models import User

    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "RATELIMIT_STORAGE_URI": "memory://",
    })

    with app.app_context():
        user = User(username="tester", discord_id="1411142904604528673", is_admin=False)
        user.set_password("secret123")
        db.session.add(user)
        db.session.commit()

    return app


@pytest.fixture
def client(app):
    return app.test_client()


def _login(client):
    response = client.post(
        "/auth/login",
        data={"username": "tester", "password": "secret123"},
        follow_redirects=False,
    )
    assert response.status_code == 302


def test_ai_provider_validate_does_not_persist(client, monkeypatch):
    from dashboard.models import UserAIProviderCredential
    from dashboard.routes import api as api_routes

    _login(client)

    monkeypatch.setattr(
        api_routes,
        "validate_ai_provider_config",
        lambda **kwargs: {"ok": True, "provider": kwargs["provider"], "model": kwargs["model"], "message": "ok"},
    )

    response = client.post(
        "/api/user/ai-provider/validate",
        json={"provider": "openai", "model": "gpt-4o-mini", "api_key": "sk-test-123456"},
    )

    assert response.status_code == 200
    assert response.get_json()["ok"] is True

    with client.application.app_context():
        assert UserAIProviderCredential.query.count() == 0


def test_ai_provider_save_encrypts_and_masks_secret(client, monkeypatch):
    from dashboard.models import UserAIProviderCredential
    from dashboard.routes import api as api_routes
    from dashboard.services.encryption import decrypt_secret

    _login(client)

    monkeypatch.setattr(
        api_routes,
        "validate_ai_provider_config",
        lambda **kwargs: {"ok": True, "provider": kwargs["provider"], "model": kwargs["model"], "message": "ok"},
    )

    response = client.post(
        "/api/user/ai-provider",
        json={
            "provider": "openai",
            "model": "gpt-4o-mini",
            "api_key": "sk-live-super-secret-1234",
            "usage_limit_requests_per_hour": 250,
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["configured"] is True
    assert data["key_hint"].endswith("1234")
    assert data["status"] == "active"
    assert data["usage_limit_requests_per_hour"] == 250

    with client.application.app_context():
        credential = UserAIProviderCredential.query.one()
        assert credential.encrypted_api_key != "sk-live-super-secret-1234"
        assert decrypt_secret(credential.encrypted_api_key, credential.api_key_iv) == "sk-live-super-secret-1234"


def test_ai_provider_disable_and_delete(client, monkeypatch):
    from dashboard.routes import api as api_routes

    _login(client)

    monkeypatch.setattr(
        api_routes,
        "validate_ai_provider_config",
        lambda **kwargs: {"ok": True, "provider": kwargs["provider"], "model": kwargs["model"], "message": "ok"},
    )

    save_response = client.post(
        "/api/user/ai-provider",
        json={"provider": "anthropic", "model": "claude-3-5-haiku-latest", "api_key": "anthropic-secret-9876"},
    )
    assert save_response.status_code == 200

    disable_response = client.post("/api/user/ai-provider/disable")
    assert disable_response.status_code == 200
    assert disable_response.get_json()["status"] == "disabled"

    delete_response = client.delete("/api/user/ai-provider")
    assert delete_response.status_code == 200
    assert delete_response.get_json()["deleted"] is True

    status_response = client.get("/api/user/ai-provider")
    assert status_response.status_code == 200
    assert status_response.get_json()["configured"] is False


def test_custom_openai_requires_base_url(client):
    _login(client)

    response = client.post(
        "/api/user/ai-provider/validate",
        json={"provider": "custom_openai", "model": "gpt-4o-mini", "api_key": "sk-test-123456"},
    )

    assert response.status_code == 400
    assert "Base URL is required" in response.get_json()["error"]


def test_internal_ai_provider_endpoints_expose_usage_and_support_disable(client, monkeypatch):
    from dashboard.models import AuditLog
    from dashboard.routes import api as api_routes

    _login(client)
    monkeypatch.setenv("WEBHOOK_SECRET", os.environ["AI_PROVIDER_ENCRYPTION_KEY"])

    monkeypatch.setattr(
        api_routes,
        "validate_ai_provider_config",
        lambda **kwargs: {"ok": True, "provider": kwargs["provider"], "model": kwargs["model"], "message": "ok"},
    )

    save = client.post(
        "/api/user/ai-provider",
        json={"provider": "openai", "model": "gpt-4o-mini", "api_key": "sk-live-super-secret-1234"},
    )
    assert save.status_code == 200

    headers = {"X-Internal-API-Key": os.environ["WEBHOOK_SECRET"]}

    internal = client.get("/api/internal/ai-provider/1411142904604528673", headers=headers)
    assert internal.status_code == 200
    payload = internal.get_json()
    assert payload["configured"] is True
    assert payload["api_key"] == "sk-live-super-secret-1234"
    assert payload["usage"]["requests_this_hour"] == 0

    usage = client.post(
        "/api/internal/ai-provider/1411142904604528673/usage",
        headers=headers,
        json={"command": "aiask", "success": True, "token_count": 42},
    )
    assert usage.status_code == 200
    assert usage.get_json()["usage"]["requests_this_hour"] == 1

    disable = client.post(
        "/api/internal/ai-provider/1411142904604528673/disable",
        headers=headers,
        json={"reason": "Disabled in test"},
    )
    assert disable.status_code == 200
    assert disable.get_json()["status"] == "disabled"

    with client.application.app_context():
        actions = {entry.action for entry in AuditLog.query.all()}
        assert "internal_ai_provider_lookup_success" in actions
        assert "internal_ai_provider_usage_recorded" in actions
        assert "internal_ai_provider_disabled_by_internal" in actions