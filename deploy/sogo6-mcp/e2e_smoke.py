"""E2E smoke: fake facade + real sidecar over streamable HTTP."""
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

os.environ["SOGO_AGENT_API_URL"] = "http://localhost:5099/api/user/v1"
os.environ["SOGO_MCP_PORT"] = "9101"

import server  # noqa: E402

SNAPSHOT = json.load(open(os.path.join(os.path.dirname(__file__), "manifest_snapshot.json")))
CAPTURED = {}


class Facade(BaseHTTPRequestHandler):
    def do_GET(self):
        CAPTURED["last_auth"] = self.headers.get("Authorization")
        CAPTURED["last_path"] = self.path
        if self.path.startswith("/api/user/v1/agent/manifest"):
            body = json.dumps(SNAPSHOT).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            body = json.dumps({"error_code": "S000000", "data": {"facade": True, "path": self.path}}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)

    def log_message(self, *a):
        pass


facade = HTTPServer(("127.0.0.1", 5099), Facade)
threading.Thread(target=facade.serve_forever, daemon=True).start()

server._register_tools(server.load_manifest())
app = server.mcp.http_app(path="/mcp")

import uvicorn  # noqa: E402

threading.Thread(
    target=uvicorn.run,
    args=(app,),
    kwargs={"host": "127.0.0.1", "port": 9101, "log_level": "error"},
    daemon=True,
).start()

import time  # noqa: E402
import asyncio  # noqa: E402

time.sleep(1.5)

from fastmcp import Client  # noqa: E402


async def main():
    async with Client("http://127.0.0.1:9101/mcp", auth="sogo_e2e_smoke") as client:
        tools = await client.list_tools()
        assert len(tools) == 27, f"expected 27 tools, got {len(tools)}"
        result = await client.call_tool("mail.folders.list")
        payload = result.data if hasattr(result, "data") else result.content[0].text
        data = json.loads(payload) if isinstance(payload, str) else payload
        assert data["data"]["facade"] is True, data
        detail = await client.call_tool("mail.messages.get", {"uid": "42", "data": {"folder": "INBOX"}})
        payload = detail.data if hasattr(detail, "data") else detail.content[0].text
        data = json.loads(payload) if isinstance(payload, str) else payload
        assert "/agent/mail/messages/42" in data["data"]["path"], data
        assert CAPTURED["last_auth"] == "Bearer sogo_e2e_smoke", CAPTURED


asyncio.run(main())
print("E2E OK: 27 tools, token forwarded verbatim, path param substituted")
facade.shutdown()
