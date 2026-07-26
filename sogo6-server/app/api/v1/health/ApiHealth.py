"""Enhanced health-check endpoint with per-dependency status.

Returns a JSON summary of all external-service reachability so that
load balancers, orchestrators and operators can make informed decisions
without having to scrape individual component logs.
"""

from __future__ import annotations

import os
import socket as socket_module
from time import time
from typing import Any

from flask import Response, current_app
from flask.views import MethodView
from flask_smorest import Blueprint

blp = Blueprint("Health", __name__, url_prefix="/health")
blp.public_access = True  # type: ignore[attr-defined]


def _get_process_config() -> Any:
    """Return the ``ProcessSetting`` instance stored in the Flask app config."""
    return current_app.config.get("process_config") or {}


def _get_env(key: str, default: str) -> str:
    """Return an environment variable or the process config attribute."""
    val = os.environ.get(key)
    if val:
        return val
    proc = _get_process_config()
    if hasattr(proc, key):
        return str(getattr(proc, key))
    return default


def _check_postgres() -> dict[str, Any]:
    """Return PostgreSQL connectivity status."""
    start = time()
    result: dict[str, Any] = {"status": "ok", "latency_ms": 0.0}
    try:
        import psycopg

        proc = _get_process_config()
        host = str(getattr(proc, "SOGO_P_DB_HOST", "localhost"))
        port = int(getattr(proc, "SOGO_P_DB_PORT", 5432))
        user = str(getattr(proc, "SOGO_P_DB_USER", "sogo"))
        password = str(getattr(proc, "SOGO_P_DB_PASS", "sogo"))
        dbname = os.environ.get("SOGO_P_DB_NAME", "sogo")

        conn = psycopg.connect(
            host=host, port=port, user=user,
            password=password, dbname=dbname,
            connect_timeout=5,
        )
        conn.execute("SELECT 1")
        conn.close()
        result["latency_ms"] = round((time() - start) * 1000, 1)
    except Exception as exc:  # pylint: disable=broad-except
        result["status"] = "error"
        result["error"] = str(exc)
        result["latency_ms"] = round((time() - start) * 1000, 1)
    return result


def _check_ldap() -> dict[str, Any]:
    """Return LDAP connectivity status."""
    start = time()
    result: dict[str, Any] = {"status": "ok", "latency_ms": 0.0}
    try:
        import ldap  # type: ignore[import-untyped]

        ldap_uri = _get_env("SOGO_LDAP_URI", "ldap://localhost:389")
        conn = ldap.initialize(ldap_uri)
        # Attempt an anonymous bind; if SASL/creds are required the server
        # will reject it, but that still proves TCP-level reachability.
        conn.simple_bind_s("", "")
        conn.unbind_s()
        result["latency_ms"] = round((time() - start) * 1000, 1)
    except ldap.SERVER_DOWN:  # type: ignore[attr-defined]
        result["status"] = "error"
        result["error"] = "LDAP server is down or unreachable"
        result["latency_ms"] = round((time() - start) * 1000, 1)
    except Exception as exc:  # pylint: disable=broad-except
        # A successful TCP connection but failed bind is still "ok" for
        # connectivity — the server is reachable even if auth is required.
        if "Can't contact LDAP server" in str(exc):
            result["status"] = "error"
            result["error"] = "LDAP server is down or unreachable"
        else:
            result["status"] = "ok"
            result["detail"] = f"Connected (bind rejected: {exc})"
        result["latency_ms"] = round((time() - start) * 1000, 1)
    return result


def _check_redis() -> dict[str, Any]:
    """Return Redis connectivity status."""
    start = time()
    result: dict[str, Any] = {"status": "ok", "latency_ms": 0.0}
    try:
        from app.manager.cache.ClientRedis import ClientRedis

        proc = _get_process_config()
        redis_url = str(getattr(proc, "SOGO_P_REDIS_URL", "redis://localhost:6379/0"))
        client = ClientRedis(url_str=redis_url, resp3=True)
        client.ping()
        result["latency_ms"] = round((time() - start) * 1000, 1)
    except Exception as exc:  # pylint: disable=broad-except
        result["status"] = "error"
        result["error"] = str(exc)
        result["latency_ms"] = round((time() - start) * 1000, 1)
    return result


def _check_stalwart() -> dict[str, Any]:
    """Return Stalwart (IMAP / SMTP) connectivity status (TCP port check).

    The Docker dev stack maps Stalwart to these ports:
      SMTP  25  → host 20025
      IMAP  143 → host 20143
      SUBM  587 → host 20587
    Inside the container network we connect directly to the service name.
    """
    start = time()
    result: dict[str, Any] = {"status": "ok", "latency_ms": 0.0}

    host = _get_env("SOGO_SMTP_SERVER", "sogo6-stalwart")

    # Try IMAP (143) first — it is the most protocol-agnostic indicator
    for label, port in [("IMAP", 143), ("SMTP", 25), ("SUBM", 587)]:
        try:
            sock = socket_module.create_connection((host, port), timeout=5)
            sock.close()
            result["latency_ms"] = round((time() - start) * 1000, 1)
            result["detail"] = f"Connected via {label}:{port}"
            return result
        except Exception:  # pylint: disable=broad-except
            continue

    result["status"] = "error"
    result["error"] = f"Cannot connect to {host} on IMAP(143), SMTP(25), or SUBM(587)"
    result["latency_ms"] = round((time() - start) * 1000, 1)
    return result


@blp.route("")
class ApiHealth(MethodView):
    """Enhanced health-check endpoint.

    Returns 200 with per-dependency status when all services are reachable,
    or 503 when at least one dependency is unhealthy.
    ---
    get:
      summary: "Health check with dependency status"
      responses:
        200:
          description: "All dependencies reachable"
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: ok
                  version:
                    type: string
                    example: 6.0.0-alpha1
                  uptime_seconds:
                    type: number
                  dependencies:
                    type: object
        503:
          description: "At least one dependency unreachable"
    """

    public_access = True  # type: ignore[attr-defined]

    def get(self) -> Response:
        # Run all checks sequentially (simple and deterministic)
        checks = {
            "postgresql": _check_postgres(),
            "ldap": _check_ldap(),
            "redis": _check_redis(),
            "stalwart_mail": _check_stalwart(),
        }

        overall = "ok" if all(c["status"] == "ok" for c in checks.values()) else "degraded"

        # Uptime: use process start time from the Flask app (set in run.py)
        uptime = time() - current_app.config.get("SOGO_START_TIME", time())

        body: dict[str, Any] = {
            "status": overall,
            "version": "6.0.0-alpha1",
            "uptime_seconds": round(uptime, 1),
            "dependencies": checks,
        }

        status_code = 200 if overall == "ok" else 503
        return Response(
            __import__("json").dumps(body, default=str, indent=2),
            status=status_code,
            content_type="application/json",
        )
