import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-32chars-minimum!!")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("DISCORD_CLIENT_ID", "0")
os.environ.setdefault("DISCORD_CLIENT_SECRET", "test")
os.environ.setdefault("DISCORD_REDIRECT_URI", "http://localhost/auth/callback")


def _create_client():
    from dashboard.app import create_app

    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "RATELIMIT_STORAGE_URI": "memory://",
    })
    return app.test_client()


def test_root_serves_public_homepage_export():
    client = _create_client()

    resp = client.get("/")

    assert resp.status_code == 200
    assert b"Sloth Lee" in resp.data


def test_docs_subpath_resolves_public_export():
    client = _create_client()

    resp = client.get("/docs/troubleshooting/")

    assert resp.status_code == 200
    assert b"Troubleshooting" in resp.data
