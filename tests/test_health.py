"""Minimal smoke test — confirms the app factory creates a Flask app."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("DISCORD_CLIENT_ID", "0")
os.environ.setdefault("DISCORD_CLIENT_SECRET", "test")
os.environ.setdefault("DISCORD_REDIRECT_URI", "http://localhost/auth/callback")

def test_health_endpoint():
    from dashboard.app import create_app
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    client = app.test_client()
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ok"
