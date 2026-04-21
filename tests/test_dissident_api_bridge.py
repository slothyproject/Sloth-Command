import os
from types import SimpleNamespace

os.environ.setdefault("JWT_SECRET", "test-jwt-secret")


class _DummyResponse:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


def test_bulk_route_404_maps_to_actionable_503(monkeypatch):
    from dashboard.services import dissident_api

    monkeypatch.setattr(dissident_api, "get_dashboard_api_token", lambda user: "token")
    monkeypatch.setattr(
        dissident_api.requests,
        "request",
        lambda *args, **kwargs: _DummyResponse(404, text="not found"),
    )

    status, payload = dissident_api.call_dissident_api(
        "POST",
        "moderation/bulk",
        SimpleNamespace(discord_id="123", username="tester", avatar=None),
        json_payload={},
    )

    assert status == 503
    assert payload["missing_route"] == "/api/moderation/bulk"
    assert "missing required moderation routes" in payload["error"]


def test_noncritical_404_passthrough(monkeypatch):
    from dashboard.services import dissident_api

    monkeypatch.setattr(dissident_api, "get_dashboard_api_token", lambda user: "token")
    monkeypatch.setattr(
        dissident_api.requests,
        "request",
        lambda *args, **kwargs: _DummyResponse(404, payload={"error": "not found"}),
    )

    status, payload = dissident_api.call_dissident_api(
        "GET",
        "guilds/123/members/search",
        SimpleNamespace(discord_id="123", username="tester", avatar=None),
        params={"query": "x"},
    )

    assert status == 404
    assert payload["error"] == "not found"
