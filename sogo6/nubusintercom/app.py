"""
nubusintercom — OIDC token exchange proxy between SOGo 6 and OpenCloud.

Provides:
- Token exchange: fetches user's OIDC token from Redis, exchanges for OpenCloud audience
- File picker API: browse/select OpenCloud files via WebDAV with real user token
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.request
from typing import Any

from flask import Flask, g, jsonify, request

app = Flask(__name__)

# ── Config ────────────────────────────────────────────────────────────────

OPENCLOUD_BASE_URL = os.getenv("OPENCLOUD_BASE_URL", "http://localhost:8080")
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "https://id.home.opendesk-edu.org")
REALM_NAME = os.getenv("REALM_NAME", "opendesk")
OPENCLOUD_CLIENT_ID = os.getenv("OPENCLOUD_CLIENT_ID", "opendesk-opencloud")
INTERCOM_CLIENT_ID = os.getenv("INTERCOM_CLIENT_ID", "opendesk-intercom")
INTERCOM_CLIENT_SECRET = os.getenv("INTERCOM_CLIENT_SECRET", "")
SHARED_SECRET = os.getenv("INTERCOM_SHARED_SECRET", "")
PORT = int(os.getenv("INTERCOM_PORT", "8100"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ── Redis client ──────────────────────────────────────────────────────────

def _get_redis():
    """Lazy Redis client for fetching OIDC tokens."""
    import redis
    return redis.from_url(REDIS_URL, decode_responses=True)


# ── Auth helpers ──────────────────────────────────────────────────────────

def _verify_signature(payload: bytes, signature: str) -> bool:
    """Verify HMAC-SHA256 signature from SOGo."""
    expected = hmac.new(SHARED_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _exchange_token(user_access_token: str) -> dict[str, Any] | None:
    """
    Exchange user's SOGo OIDC access token for an OpenCloud-audience token.
    
    Uses Keycloak's token-exchange grant:
    POST {issuer}/protocol/openid-connect/token
    grant_type=urn:ietf:params:oauth:grant-type:token-exchange
    client_id=opendesk-intercom
    client_secret=...
    subject_token={user_access_token}
    audience=opendesk-opencloud
    """
    issuer = f"{KEYCLOAK_URL}/realms/{REALM_NAME}"
    token_url = f"{issuer}/protocol/openid-connect/token"
    
    data = {
        "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
        "client_id": INTERCOM_CLIENT_ID,
        "client_secret": INTERCOM_CLIENT_SECRET,
        "subject_token": user_access_token,
        "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
        "audience": OPENCLOUD_CLIENT_ID,
    }
    
    try:
        req = urllib.request.Request(
            token_url,
            data=urllib.parse.urlencode(data).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST"
        )
        resp = urllib.request.urlopen(req, timeout=10)
        return json.loads(resp.read().decode())
    except Exception as e:
        app.logger.warning("Token exchange failed: %s", e)
        return None


def _webdav_propfind(base_url: str, path: str, access_token: str) -> list[dict]:
    """PROPFIND to list WebDAV files/folders."""
    dav_url = f"{base_url}/dav/files/{path}"
    
    req_headers = {
        "Authorization": f"Bearer {access_token}",
        "Depth": "1",
        "Content-Type": "application/xml",
    }
    
    propfind_body = '''<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:getcontenttype/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>'''
    
    try:
        req = urllib.request.Request(
            dav_url,
            data=propfind_body.encode(),
            headers=req_headers,
            method="PROPFIND"
        )
        resp = urllib.request.urlopen(req, timeout=10)
        return _parse_webdav_propfind(resp.read().decode())
    except urllib.error.HTTPError as e:
        app.logger.warning("WebDAV PROPFIND failed: %s %s", e.code, e.reason)
        return []
    except Exception as e:
        app.logger.warning("WebDAV PROPFIND error: %s", e)
        return []


def _parse_webdav_propfind(xml_str: str) -> list[dict]:
    """Parse WebDAV PROPFIND XML into file list."""
    import re
    files = []
    for response in re.findall(r'<d:response>(.*?)</d:response>', xml_str, re.DOTALL):
        href_match = re.search(r'<d:href>([^<]+)</d:href>', response)
        name_match = re.search(r'<d:displayname>([^<]+)</d:displayname>', response)
        size_match = re.search(r'<d:getcontentlength>([^<]*)</d:getcontentlength>', response)
        mod_match = re.search(r'<d:getlastmodified>([^<]+)</d:getlastmodified>', response)
        is_collection = '<d:collection/>' in response
        
        # Extract filename from href if no displayname
        href = href_match.group(1) if href_match else ""
        name = name_match.group(1) if name_match else href.rstrip('/').split('/')[-1]
        if not name or name == "/":
            continue
        
        files.append({
            "name": name,
            "type": "folder" if is_collection else "file",
            "size": int(size_match.group(1)) if size_match and size_match.group(1) else 0,
            "modified": mod_match.group(1) if mod_match else "",
        })
    return files


# ── Middleware ─────────────────────────────────────────────────────────────

@app.before_request
def before_request_func():
    g.start_time = time.time()


# ═══════════════════════════════════════════════════════════════════════════
# Routes
# ═══════════════════════════════════════════════════════════════════════════

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "nubusintercom", "uptime": time.time()})


@app.route("/api/v1/token/exchange", methods=["POST"])
def token_exchange():
    """
    Exchange a SOGo user's OIDC token for an OpenCloud-audience token.
    
    Request body (JSON, signed):
    {
        "user_uid": "user1@example.org",
        "scopes": ["files.read", "files.write"],
        "timestamp": 1700000000
    }
    
    Headers:
        X-Intercom-Signature: HMAC-SHA256 of body using SHARED_SECRET
    
    Returns:
    {
        "access_token": "<exchanged_token>",
        "token_type": "Bearer",
        "expires_in": 3600,
        "scopes": ["files.read", "files.write"]
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
    
    user_uid = body.get("user_uid", "")
    scopes = body.get("scopes", ["files.read"])
    
    if not user_uid:
        return jsonify({"error": "user_uid_required"}), 400
    
    # Timestamp check (replay protection, 5 min window)
    ts = body.get("timestamp", 0)
    if abs(time.time() - ts) > 300:
        return jsonify({"error": "expired_request"}), 400
    
    # Fetch user's OIDC tokens from Redis
    try:
        r = _get_redis()
        oidc_tokens = r.get(f"user_oidc_session:{user_uid}")
        if oidc_tokens:
            oidc_tokens = json.loads(oidc_tokens)
    except Exception as e:
        app.logger.warning("Redis fetch failed for %s: %s", user_uid, e)
        oidc_tokens = None
    
    if not oidc_tokens or not oidc_tokens.get("access_token"):
        app.logger.warning("No OIDC token found for user %s", user_uid)
        return jsonify({"error": "no_oidc_token"}), 404
    
    # Exchange for OpenCloud audience
    exchanged = _exchange_token(oidc_tokens["access_token"])
    if not exchanged:
        return jsonify({"error": "token_exchange_failed"}), 502
    
    return jsonify({
        "access_token": exchanged.get("access_token", ""),
        "token_type": exchanged.get("token_type", "Bearer"),
        "expires_in": exchanged.get("expires_in", 3600),
        "scopes": scopes,
    }), 201


@app.route("/api/v1/files/browse", methods=["GET"])
def files_browse():
    """
    Browse OpenCloud files via WebDAV.
    
    Query params:
        path: folder path (default /)
        type: filter type (file, folder, all)
    
    Headers:
        Authorization: Bearer <exchanged_token>
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "missing_token"}), 401
    
    access_token = auth_header[7:]
    path = request.args.get("path", "/")
    file_type = request.args.get("type", "all")
    
    # WebDAV path: OpenCloud uses /dav/files/{user_uid} at root
    # We need the user_uid - extract from token or pass as param
    user_uid = request.args.get("user_uid", "")
    if not user_uid:
        # Fallback: assume path includes user context
        dav_path = path
    else:
        dav_path = f"/{user_uid}{path}"
    
    files = _webdav_propfind(OPENCLOUD_BASE_URL, dav_path, access_token)
    
    # Filter by type
    if file_type != "all":
        files = [f for f in files if f["type"] == file_type]
    
    return jsonify({"path": path, "files": files})


@app.route("/api/v1/files/select", methods=["POST"])
def files_select():
    """
    Select a file for attachment/linking.
    
    Request body:
    {
        "file_path": "/Documents/report.pdf",
        "action": "attach" | "link"
    }
    
    Headers:
        Authorization: Bearer <exchanged_token>
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "missing_token"}), 401
    
    body = request.get_json(force=True)
    file_path = body.get("file_path", "")
    action = body.get("action", "attach")
    
    if not file_path:
        return jsonify({"error": "file_path_required"}), 400
    
    # Build share URL (OpenCloud public link endpoint)
    # In production: call OCS API to create share, return real URL
    share_url = f"{OPENCLOUD_BASE_URL}/index.php/f/{file_path.lstrip('/')}"
    
    return jsonify({
        "file_path": file_path,
        "share_url": share_url,
        "action": action,
    })


@app.route("/api/v1/portal/config", methods=["GET"])
def portal_config():
    """Return configuration for embedding SOGo in the portal."""
    return jsonify({
        "app_id": "sogo6",
        "name": "SOGo 6 Groupware",
        "description": "Email, calendar, contacts, and tasks",
        "icon_url": "/img/sogo-logo.svg",
        "launch_url": "http://localhost:5000",
        "intercom_url": f"http://localhost:{PORT}",
        "scopes": ["openid", "profile", "email", "files.read", "files.write"],
        "category": "productivity",
    })


if __name__ == "__main__":
    import urllib.parse
    app.run(host="0.0.0.0", port=PORT, debug=os.getenv("INTERCOM_DEBUG", "0") == "1")
