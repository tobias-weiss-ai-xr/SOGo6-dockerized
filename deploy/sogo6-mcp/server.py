"""SOGo6 MCP sidecar.

Mirrors the SOGo6 agent action facade 1:1 as MCP tools:
- Tool list is generated at startup from `GET {SOGO_AGENT_API_URL}/agent/manifest`
  (the facade's ACTIONS registry is the single source of truth).
- Every action becomes exactly one tool, named by its manifest id.
- Tools hold no business logic: they forward the caller's bearer token to the
  REST facade and return its response. No DB, no Redis, no credentials here.

Run:  SOGO_AGENT_API_URL=http://sogo6-server:5000/api/user/v1 python server.py
"""

from __future__ import annotations

import os
import re
import time
from typing import Any

import httpx
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_headers
from fastmcp.tools import Tool

API_URL = os.environ.get("SOGO_AGENT_API_URL", "http://sogo6-server:5000/api/user/v1").rstrip("/")
PORT = int(os.environ.get("SOGO_MCP_PORT", "9000"))

mcp = FastMCP(
    "sogo6",
    instructions=(
        "SOGo6 groupware tools (mail, calendar, contacts, AI assist). "
        "Set the MCP client's Authorization header to the user's SOGo6 bearer "
        "token; it is forwarded verbatim to every facade call. Errors use the "
        "facade envelope (error_code / error_msg / data)."
    ),
)

_PATH_PARAM = re.compile(r"\{([^}]+)\}")


def _forward(method: str, path_template: str, payload: dict[str, Any]) -> Any:
    """Forward one call to the facade with the caller's bearer token."""
    # get_http_headers strips credential headers unless explicitly included
    headers = get_http_headers(include={"authorization"})
    auth = headers.get("authorization") or headers.get("Authorization")
    if not auth:
        return {"error_code": "S000208", "error_msg": "Missing bearer token (set the MCP Authorization header)"}
    req_headers = {"Authorization": auth}
    url = f"{API_URL}{path_template}"
    with httpx.Client(timeout=30) as client:
        if method in ("POST", "PATCH", "PUT"):
            resp = client.request(method, url, json=payload or {}, headers=req_headers)
        else:
            resp = client.request(method, url, params=payload or {}, headers=req_headers)
    try:
        return resp.json()
    except ValueError:
        return {"error_code": f"HTTP_{resp.status_code}", "error_msg": resp.text[:500]}


def _substitute(template: str, params: dict[str, Any]) -> str:
    out = template
    for key, value in params.items():
        out = out.replace("{" + key + "}", str(value))
    return out


def _make_tool(method: str, template: str, path_params: list[str]):
    """Build the forwarding tool with an explicit typed signature.

    fastmcp/pydantic derive the input schema from the real function
    signature, so we generate one with the path params as required
    arguments plus an optional `data` dict for query/body params.
    """
    args = ", ".join([f"{p}: str" for p in path_params] + ["data: dict | None = None"])
    body = """    frame = dict(locals())
    supplied = {p: frame[p] for p in _path_params}
    return _forward(_method, _substitute(_template, supplied), frame.get("data") or {})"""
    src = f"def generated_tool({args}):\n{body}"
    namespace = {
        "_forward": _forward,
        "_method": method,
        "_template": template,
        "_path_params": path_params,
        "_substitute": _substitute,
    }
    exec(src, namespace)  # noqa: S102 - generated from validated registry data
    return namespace["generated_tool"]


def _register_tools(manifest: dict) -> int:
    """Create one MCP tool per facade action."""
    count = 0
    for action in manifest.get("data", {}).get("actions", []):
        action_id: str = action["id"]
        method: str = action["method"]
        # manifest paths are absolute; API_URL already carries the mount prefix
        template: str = re.sub(r"^/api/user/v1", "", action["path"])
        path_params = _PATH_PARAM.findall(template)
        description: str = f"{action['description']} (scope: {action['scope']})"

        fn = _make_tool(method, template, path_params)
        fn.__doc__ = description
        fn.__name__ = action_id.replace(".", "_")

        mcp.add_tool(Tool.from_function(fn, name=action_id, description=description))
        count += 1
    return count


def load_manifest(max_attempts: int = 30, delay: float = 2.0) -> dict:
    """Fetch the action manifest from the facade, retrying while it boots.

    The sidecar's depends_on only orders container start; the facade may
    still be warming up. A bounded retry (~60s) avoids a startup
    crash-loop when the server is slower than the sidecar.
    """
    last_error: Exception | None = None
    for _attempt in range(max_attempts):
        try:
            with httpx.Client(timeout=10) as client:
                resp = client.get(f"{API_URL}/agent/manifest")
                resp.raise_for_status()
                return resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            last_error = exc
            time.sleep(delay)
    raise RuntimeError(f"facade manifest unavailable at {API_URL}/agent/manifest: {last_error}")


def build() -> FastMCP:
    """Fetch the manifest and register tools (server entry + tests)."""
    _register_tools(load_manifest())
    return mcp


if __name__ == "__main__":
    tool_count = _register_tools(load_manifest())
    print(f"sogo6-mcp: {tool_count} tools from {API_URL}/agent/manifest", flush=True)
    mcp.run(transport="http", host="0.0.0.0", port=PORT, path="/mcp")
