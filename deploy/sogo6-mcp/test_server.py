"""MCP sidecar tests: tool list == manifest, token passthrough, no logic.

Run with the sidecar venv (fastmcp + httpx + pytest). Manifest source:
- SOGO_AGENT_API_URL (live facade) if reachable, else
- manifest_snapshot.json next to this file (generated from the facade
  registry via `make snapshot` / scripts/gen_manifest_snapshot.py).
"""

from __future__ import annotations

import json
import os
import sys

import httpx
import pytest

sys.path.insert(0, os.path.dirname(__file__))
import server  # noqa: E402

HERE = os.path.dirname(__file__)
SNAPSHOT = os.path.join(HERE, "manifest_snapshot.json")


def _manifest() -> dict:
    try:
        resp = httpx.get(f"{server.API_URL}/agent/manifest", timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except httpx.HTTPError:
        pass
    if os.path.exists(SNAPSHOT):
        with open(SNAPSHOT) as fh:
            return json.load(fh)
    pytest.skip("no live facade and no manifest_snapshot.json")


async def _tool_list():
    return await server.mcp.list_tools()


def _tool_dict():
    import asyncio

    return {t.name: t for t in asyncio.run(_tool_list())}


class TestToolParity:
    def test_every_action_is_a_tool(self):
        server._register_tools(_manifest())
        tools = _tool_dict()
        manifest_ids = {a["id"] for a in _manifest()["data"]["actions"]}
        tool_ids = set(tools.keys())
        assert tool_ids == manifest_ids, (
            f"tools != manifest actions; only-tools={sorted(tool_ids - manifest_ids)}, "
            f"only-manifest={sorted(manifest_ids - tool_ids)}"
        )

    def test_tool_count_within_budget(self):
        server._register_tools(_manifest())
        tools = _tool_dict()
        assert len(tools) <= 30, "spec cap: MCP tool count must not exceed 30"

    def test_path_params_are_tool_params(self):
        """e.g. mail.messages.get needs `uid`; drafts.send needs `key`."""
        server._register_tools(_manifest())
        tools = _tool_dict()
        get_params = tools["mail.messages.get"].parameters
        assert "uid" in get_params.get("required", []), get_params
        send_draft = tools["mail.drafts.send"].parameters
        assert "key" in send_draft.get("required", []), send_draft


class TestTokenPassthrough:
    def test_missing_token_reported(self, monkeypatch):
        monkeypatch.setattr(server, "get_http_headers", lambda **kw: {})
        result = server._forward("GET", "/agent/manifest", {})
        assert result["error_code"] == "S000207" or result["error_code"] == "S000208"

    def test_token_forwarded_verbatim(self, monkeypatch):
        captured: dict = {}

        class FakeResp:
            status_code = 200

            def json(self):
                return {"error_code": "S000000", "data": {"ok": True}}

        def fake_request(method, url, **kwargs):
            captured["method"] = method
            captured["url"] = url
            captured["headers"] = kwargs.get("headers")
            return FakeResp()

        class FakeClient:
            def __init__(self, timeout=None):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def request(self, method, url, **kwargs):
                return fake_request(method, url, **kwargs)

        monkeypatch.setattr(server.httpx, "Client", FakeClient)
        monkeypatch.setattr(server, "get_http_headers", lambda **kw: {"authorization": "Bearer sogo_test123"})
        result = server._forward("GET", "/agent/mail/folders", {})
        assert result["data"]["ok"] is True
        assert captured["headers"]["Authorization"] == "Bearer sogo_test123"
        assert captured["url"].endswith("/agent/mail/folders")

    def test_post_sends_json_body(self, monkeypatch):
        captured: dict = {}

        class FakeResp:
            status_code = 200

            def json(self):
                return {"error_code": "S000000"}

        class FakeClient:
            def __init__(self, timeout=None):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def request(self, method, url, **kwargs):
                captured.update(method=method, json=kwargs.get("json"))
                return FakeResp()

        monkeypatch.setattr(server.httpx, "Client", FakeClient)
        monkeypatch.setattr(server, "get_http_headers", lambda **kw: {"authorization": "Bearer sogo_x"})
        server._forward("POST", "/agent/mail/send", {"subject": "hi"})
        assert captured["method"] == "POST"
        assert captured["json"]["subject"] == "hi"
