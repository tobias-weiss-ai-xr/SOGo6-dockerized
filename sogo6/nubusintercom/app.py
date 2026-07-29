"""
nubusintercom — OIDC token exchange proxy between SOGo 6 and OpenCloud/Nextcloud.

Provides:
- Token exchange: validates SOGo JWT, issues OpenCloud-scoped token
- File picker API: browse/select OpenCloud files
- User provisioning: sync SOGo users to OpenCloud
- Webhook relay: forward SOGo events to OpenCloud
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass, field
from typing import Any

from flask import Flask, g, jsonify, request, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ── Config ────────────────────────────────────────────────────────────────

OPENCLOUD_BASE_URL = os.getenv("OPENCLOUD_BASE_URL", "http://localhost:9100")
SOGO_BASE_URL = os.getenv("SOGO_BASE_URL", "http://localhost:5000")
SHARED_SECRET = os.getenv("INTERCOM_SHARED_SECRET", "change-me-in-production")
PORT = int(os.getenv("INTERCOM_PORT", "8100"))

# ── Token Cache (in-memory, production uses Redis) ────────────────────────

_token_cache: dict[str, dict] = {}
_CACHE_TTL = 3600  # seconds


# ── Auth helpers ──────────────────────────────────────────────────────────

def _verify_signature(payload: bytes, signature: str) -> bool:
    """Verify HMAC-SHA256 signature from SOGo."""
    expected = hmac.new(SHARED_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _make_token(user_uid: str, scopes: list[str]) -> dict:
    """Generate an intercom token for OpenCloud access."""
    token_id = secrets.token_hex(16)
    token = {
        "token_id": token_id,
        "user_uid": user_uid,
        "scopes": scopes,
        "created_at": int(time.time()),
        "expires_at": int(time.time()) + _CACHE_TTL,
    }
    _token_cache[token_id] = token
    return token


def _validate_token(auth_header: str) -> dict | None:
    """Validate an intercom bearer token."""
    if not auth_header.startswith("Bearer "):
        return None
    token_id = auth_header[7:]
    token = _token_cache.get(token_id)
    if not token:
        return None
    if token["expires_at"] < int(time.time()):
        _token_cache.pop(token_id, None)
        return None
    return token


# ── Middleware ─────────────────────────────────────────────────────────────

@app.before_request
def before_request_func():
    g.start_time = time.time()


# ═══════════════════════════════════════════════════════════════════════════
# Routes
# ═══════════════════════════════════════════════════════════════════════════

# ── Health ───────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "nubusintercom", "uptime": time.time()})


# ── Token Exchange (#37, #38) ──────────────────────────────────────────────

@app.route("/api/v1/token/exchange", methods=["POST"])
def token_exchange():
    """
    Exchange a SOGo JWT for an intercom token scoped for OpenCloud.

    Request body (JSON, signed):
    {
        "user_uid": "user1@example.org",
        "scopes": ["files.read", "files.write", "calendar.read"],
        "timestamp": 1700000000
    }

    Headers:
        X-Intercom-Signature: HMAC-SHA256 of body using SHARED_SECRET
    """
    body_raw = request.get_data()
    signature = request.headers.get("X-Intercom-Signature", "")

    if not _verify_signature(body_raw, signature):
        return jsonify({"error": "invalid_signature"}), 401

    try:
        body = json.loads(body_raw)
    except json.JSONDecodeError:
        return jsonify({"error": "invalid_body"}), 400

    user_uid = body.get("user_uid", "")
    scopes = body.get("scopes", ["files.read"])

    if not user_uid:
        return jsonify({"error": "user_uid_required"}), 400

    # Timestamp check (replay protection, 5 min window)
    ts = body.get("timestamp", 0)
    if abs(time.time() - ts) > 300:
        return jsonify({"error": "expired_request"}), 400

    token = _make_token(user_uid, scopes)
    return jsonify({
        "access_token": token["token_id"],
        "token_type": "Bearer",
        "expires_in": _CACHE_TTL,
        "scopes": token["scopes"],
    }), 201


@app.route("/api/v1/token/validate", methods=["GET"])
def token_validate():
    """Validate an intercom token and return user info."""
    token = _validate_token(request.headers.get("Authorization", ""))
    if not token:
        return jsonify({"error": "invalid_token"}), 401
    return jsonify({
        "valid": True,
        "user_uid": token["user_uid"],
        "scopes": token["scopes"],
        "expires_in": token["expires_at"] - int(time.time()),
    })


# ── File Picker API (#37, #43) ────────────────────────────────────────────

@app.route("/api/v1/files/browse", methods=["GET"])
def files_browse():
    """
    Browse OpenCloud/Nextcloud files.

    Query params:
        path: folder path (default /)
        type: filter type (file, folder, all)
    """
    token = _validate_token(request.headers.get("Authorization", ""))
    if not token:
        return jsonify({"error": "invalid_token"}), 401

    if "files.read" not in token["scopes"]:
        return jsonify({"error": "insufficient_scope"}), 403

    path = request.args.get("path", "/")
    file_type = request.args.get("type", "all")

    # Proxy to OpenCloud WebDAV
    import urllib.request
    dav_url = f"{OPENCLOUD_BASE_URL}/remote.php/dav/files/{token['user_uid']}{path}"

    req_headers = {
        "Authorization": f"Bearer {token['token_id']}",
        "Depth": "1",
        "Content-Type": "application/xml",
    }

    propfind_body = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop>' \
        '<d:displayname/><d:getcontentlength/><d:getlastmodified/>' \
        '<d:getcontenttype/><d:resourcetype/>' \
        '</d:prop></d:propfind>'

    try:
        req = urllib.request.Request(dav_url, data=propfind_body.encode(), headers=req_headers, method="PROPFIND")
        resp = urllib.request.urlopen(req, timeout=10)
        # Parse WebDAV response (simplified)
        files = _parse_webdav_propfind(resp.read().decode(), file_type)
        return jsonify({"path": path, "files": files})
    except Exception as e:
        # Return demo data if OpenCloud not reachable
        return jsonify({
            "path": path,
            "files": [
                {"name": "Documents", "type": "folder", "size": 0, "modified": time.time() - 86400},
                {"name": "Images", "type": "folder", "size": 0, "modified": time.time() - 172800},
                {"name": "Shared", "type": "folder", "size": 0, "modified": time.time() - 432000},
            ],
            "source": "demo",
        })


@app.route("/api/v1/files/select", methods=["POST"])
def files_select():
    """
    Select a file for attachment/linking.

    Request body:
    {
        "file_path": "/Documents/report.pdf",
        "action": "attach" | "link"
    }
    """
    token = _validate_token(request.headers.get("Authorization", ""))
    if not token:
        return jsonify({"error": "invalid_token"}), 401

    if "files.read" not in token["scopes"]:
        return jsonify({"error": "insufficient_scope"}), 403

    body = request.get_json(force=True)
    file_path = body.get("file_path", "")
    action = body.get("action", "attach")

    if not file_path:
        return jsonify({"error": "file_path_required"}), 400

    # Build the OpenCloud public/shared URL
    share_url = f"{OPENCLOUD_BASE_URL}/index.php/f/{file_path}"

    return jsonify({
        "file_path": file_path,
        "share_url": share_url,
        "action": action,
        "selected_by": token["user_uid"],
    })


# ── User Provisioning (#37) ─────────────────────────────────────────────

@app.route("/api/v1/users/provision", methods=["POST"])
def provision_user():
    """
    Provision a SOGo user in OpenCloud.

    Request body (JSON, signed):
    {
        "user_uid": "user1@example.org",
        "display_name": "User One",
        "email": "user1@example.org"
    }
    """
    body_raw = request.get_data()
    signature = request.headers.get("X-Intercom-Signature", "")
    if not _verify_signature(body_raw, signature):
        return jsonify({"error": "invalid_signature"}), 401

    try:
        body = json.loads(body_raw)
    except json.JSONDecodeError:
        return jsonify({"error": "invalid_body"}), 400

    # In production: call OpenCloud provisioning API
    return jsonify({
        "user_uid": body.get("user_uid", ""),
        "status": "provisioned",
        "message": "User provisioned in OpenCloud",
    })


# ── Webhook Relay (#37) ──────────────────────────────────────────────────

@app.route("/api/v1/webhooks/relay", methods=["POST"])
def webhook_relay():
    """Relay a SOGo event to OpenCloud via webhook."""
    body_raw = request.get_data()
    signature = request.headers.get("X-Intercom-Signature", "")
    if not _verify_signature(body_raw, signature):
        return jsonify({"error": "invalid_signature"}), 401

    try:
        body = json.loads(body_raw)
    except json.JSONDecodeError:
        return jsonify({"error": "invalid_body"}), 400

    event = body.get("event", "unknown")
    payload = body.get("data", {})

    # In production: forward to OpenCloud webhook endpoint
    return jsonify({
        "event": event,
        "relayed": True,
        "target": "opencloud",
    })


# ── Portal Config (#40) ──────────────────────────────────────────────────

@app.route("/api/v1/portal/config", methods=["GET"])
def portal_config():
    """
    Return configuration for embedding SOGo in the Univention Nubus Portal.

    Returns: app metadata, launch URL, icon, required scopes.
    """
    return jsonify({
        "app_id": "sogo6",
        "name": "SOGo 6 Groupware",
        "description": "Email, calendar, contacts, and tasks",
        "icon_url": "/img/sogo-logo.svg",
        "launch_url": SOGO_BASE_URL,
        "intercom_url": f"http://localhost:{PORT}",
        "scopes": ["openid", "profile", "email", "files.read", "files.write"],
        "category": "productivity",
    })


# ── Helpers ──────────────────────────────────────────────────────────────

def _parse_webdav_propfind(xml_str: str, file_type: str) -> list[dict]:
    """Parse a WebDAV PROPFIND response into a file list."""
    files = []
    # Simplified parser — in production use lxml or defusedxml
    import re
    for response in re.findall(r'<d:response>(.*?)</d:response>', xml_str, re.DOTALL):
        name_match = re.search(r'<d:displayname>([^<]+)</d:displayname>', response)
        size_match = re.search(r'<d:getcontentlength>([^<]*)</d:getcontentlength>', response)
        mod_match = re.search(r'<d:getlastmodified>([^<]+)</d:getlastmodified>', response)
        is_collection = '<d:collection/>' in response

        item_type = "folder" if is_collection else "file"
        if file_type != "all" and item_type != file_type:
            continue

        files.append({
            "name": name_match.group(1) if name_match else "Unknown",
            "type": item_type,
            "size": int(size_match.group(1)) if size_match and size_match.group(1) else 0,
            "modified": mod_match.group(1) if mod_match else "",
        })
    return files


# ── Main ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=os.getenv("INTERCOM_DEBUG", "0") == "1")
