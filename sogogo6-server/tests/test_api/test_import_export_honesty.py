"""Honest-behavior tests for the PST/M365 import/export endpoints.

The discovery/analyze endpoints previously returned fabricated mailbox
inventories (hash-derived folder counts, "analysis": "simulated").  These
tests pin the honest behavior: M365 discovery calls the REAL Graph API with
the caller's token and surfaces failures, and PST analysis never prints
invented counts (engine gate via readpst presence).
"""
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app import create_app
from app.utils import constants as cs


@pytest.fixture()
def client():
    app = create_app(cs.SOGO_OK)
    app.config["TESTING"] = True
    return app.test_client()


class FakeResp:
    """requests.Response stand-in so tests never touch the network."""

    def __init__(self, status_code: int, payload: dict | None = None, text: str = ""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


FAKE_FOLDER = {
    "id": "F1",
    "displayName": "Inbox",
    "totalItemCount": 120,
    "unreadItemCount": 3,
}


def _fake_graph_ok(**kwargs):
    return {"ok": True, "email": kwargs["email"], "folders": [FAKE_FOLDER], "total_messages": 120}


def test_m365_discover_graph_failure_is_honest(client, monkeypatch):
    """A 401/network failure must yield a real error, not fabricated data."""
    import app.api.v1.admin.ApiImportExport as mod

    def broken_get(url, headers, timeout):
        assert url.startswith("https://graph.microsoft.com/v1.0/users/")
        assert headers.get("Authorization") == "Bearer tok"
        return FakeResp(401, {"error": {"message": "Invalid scope"}})

    monkeypatch.setattr(mod.requests, "get", broken_get)
    resp = client.post(
        "/api/v1/admin/import/m365/discover",
        json={"email": "u@example.com", "access_token": "tok"},
    )
    assert resp.status_code == 501  # S0003B5
    body = resp.get_json()
    assert "simulated" not in json.dumps(body)
    assert body.get("error", {}).get("code") == "S0003B5"


def test_graph_discover_success_uses_real_payload(client, monkeypatch):
    import auto.script
    import app.api.v1.admin.ApiImportExport as mod

    calls = {}

    def fake_get(url, **kwargs):
        calls["url"] = url
        calls["auth"] = kwargs["headers"]["Authorization"]
        calls["timeout"] = kwargs["timeout"]
        return FakeResp(200, {"value": [FAKE_GRAPH]})

    monkeypatch.setattr(mod.requests, "get", fake_get)
    resp = client.post(
        "/api/v1/admin/import/m365/discover",
        json={"email": "u@example.com", "access_token": "tok"},
    )
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert "simulated" not in json.dumps(data)
    assert data["total_messages"] == 120  # real sum from Graph
    assert data["folders"][0]["displayName"] == "Inbox"
    assert "AQMk" not in json.dumps(data)  # no hash-invented ids
    assert calls["auth"] == "Bearer tok"
    assert calls["timeout"] == (3.05, 30)
    assert "u@example.com" in calls["url"]


def test_pst_analyze_never_invents_counts(client, monkeypatch, tmp_path):
    import app.api.v1.admin.ApiImportExport as mod

    monkeypatch.setattr(mod.shutil, "which", lambda name: None)  # no readpst
    pst = tmp_path / "x.pst"
    pst.write_bytes(b"!BDN" + b"\x00" * 60)

    resp = client.post("/api/v1/admin/import/pst/analyze", json={"pst_path": str(pst)})
    assert resp.status_code == 501  # S0003B3 engine unavailable
    body = resp.get_json()
    assert "estimated_messages" not in json.dumps(body)
    assert "analysis" not in json.dumps(body) or '"simulated"' not in json.dumps(body)
    assert body["data"]["pst"]["valid"] is True
    assert body["data"]["pst"]["format"] == "ansi"


def test_pst_analyze_missing_file(client):
    resp = client.post("/api/v1/admin/import/pst/analyze", json={"pst_path": "/nonexistent/x.pst"})
    assert resp.status_code == 200
    assert resp.get_json()["data"]["exists"] is False


def test_m365_import_graph_failure_does_not_create_job(client, monkeypatch):
    import app.api.v1.admin.ApiImportExport as mod

    monkeypatch.setattr(
        mod.requests, "get",
        lambda url, **kwargs: FakeResp(403, {"error": {"message": "forbidden"}}),
    )
    resp = client.post(
        "/api/v1/admin/import/m365/import",
        json={"email": "u@example.com", "access_token": "tok", "target_user": "t"},
    )
    assert resp.status_code == 501  # S0003B5
    assert "job_id" not in resp.get_json()["data"]