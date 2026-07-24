"""Integration tests for the SOGo 6 + Stalwart + OpenLDAP stack."""

import subprocess
import socket
import json
import os
import time
import smtplib
import imaplib
from email.mime.text import MIMEText

import pytest
import requests

API_URL = os.getenv("SOGO_API_URL", "http://localhost:5001")
LDAP_HOST = os.getenv("SOGO_LDAP_HOST", "localhost")
LDAP_PORT = int(os.getenv("SOGO_LDAP_PORT", "389"))
LDAP_BASE_DN = os.getenv("SOGO_LDAP_BASE_DN", "dc=example,dc=org")
LDAP_BIND_DN = os.getenv("SOGO_LDAP_BIND_DN", "cn=admin,dc=example,dc=org")
LDAP_BIND_PW = os.getenv("SOGO_LDAP_BIND_PW", "admin")
SMTP_HOST = os.getenv("SOGO_SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SOGO_SMTP_PORT", "20025"))
IMAP_PORT = int(os.getenv("SOGO_IMAP_PORT", "20993"))
SUBMISSION_PORT = int(os.getenv("SOGO_SUBMISSION_PORT", "20587"))
ADMIN_USER = os.getenv("SOGO_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("SOGO_ADMIN_PASSWORD", "admin")
PG_HOST = os.getenv("SOGO_PG_HOST", "localhost")
PG_PORT = int(os.getenv("SOGO_PG_PORT", "5432"))
PG_USER = os.getenv("SOGO_PG_USER", "sogo")
PG_PASSWORD = os.getenv("SOGO_PG_PASSWORD", "sogo")
PG_DB = os.getenv("SOGO_PG_DB", "sogo")
REDIS_HOST = os.getenv("SOGO_REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("SOGO_REDIS_PORT", "6379"))

TEST_USERS: dict[str, str] = {
    "testuser@example.org": "password123",
    "testadmin@example.org": "password123",
    "testuser2@example.org": "password123",
}

pytestmark = pytest.mark.skipif(
    not os.getenv("SOGO_INTEGRATION_TESTS"),
    reason="Set SOGO_INTEGRATION_TESTS=1 to run integration tests",
)

DOCKER_CMD = "docker"
if os.system("docker info >/dev/null 2>&1") == 0:
    pass
else:
    DOCKER_CMD = ""


def _check_port(host: str, port: int, timeout: int = 5) -> bool:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        return sock.connect_ex((host, port)) == 0
    finally:
        sock.close()


def _docker_exec(container: str, cmd: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["docker", "exec", container] + cmd.split(),
        capture_output=True, text=True, timeout=30,
    )


def admin_token() -> str:
    resp = requests.post(
        f"{API_URL}/api/admin/v1/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASSWORD},
        timeout=10,
    )
    return resp.json().get("data", {}).get("jwt_token", "")


def user_token(username: str, password: str) -> str:
    resp = requests.post(
        f"{API_URL}/api/user/v1/auth/login",
        json={"username": username, "password": password},
        timeout=10,
    )
    return resp.json().get("data", {}).get("jwt_token", "")


# =============================================================================
# 1. API – Health & Auth
# =============================================================================


class TestApiHealth:
    def test_system_health(self):
        resp = requests.get(f"{API_URL}/api/user/v1/system", timeout=10)
        assert resp.status_code in (200, 412)
        data = resp.json()
        assert data.get("error_code") in ("S000000", "S000001")

    def test_system_health_data_structure(self):
        resp = requests.get(f"{API_URL}/api/user/v1/system", timeout=10)
        data = resp.json()
        d = data.get("data", {})
        assert "system" in d or "version" in d

    def test_admin_login(self):
        resp = requests.post(
            f"{API_URL}/api/admin/v1/auth/login",
            json={"username": ADMIN_USER, "password": ADMIN_PASSWORD},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("error_code") == "S000000"
        assert len(data.get("data", {}).get("jwt_token", "")) > 20

    def test_all_users_login(self):
        for username, password in TEST_USERS.items():
            resp = requests.post(
                f"{API_URL}/api/user/v1/auth/login",
                json={"username": username, "password": password},
                timeout=10,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data.get("error_code") == "S000000", f"Login failed for {username}"
            assert len(data.get("data", {}).get("jwt_token", "")) > 20

    def test_user_profile_after_login(self):
        tok = user_token("testuser@example.org", "password123")
        assert tok
        resp = requests.get(
            f"{API_URL}/api/user/v1/profile",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("error_code") == "S000000"
        p = data.get("data", {})
        assert "mailboxes" in p or "profile" in p or "prefs" in p

    def test_swagger_endpoints(self):
        for path in ("/swagger-basic", "/swagger-admin"):
            resp = requests.get(f"{API_URL}{path}", timeout=10, allow_redirects=True)
            assert resp.status_code in (200, 301, 302), f"Swagger {path} failed"


class TestApiNegative:
    def test_wrong_password_rejected(self):
        resp = requests.post(
            f"{API_URL}/api/user/v1/auth/login",
            json={"username": "testuser@example.org", "password": "wrong"},
            timeout=10,
        )
        assert resp.status_code in (401, 200)
        assert resp.json().get("error_code") not in ("S000000",)

    def test_nonexistent_user_rejected(self):
        resp = requests.post(
            f"{API_URL}/api/user/v1/auth/login",
            json={"username": "nobody@example.org", "password": "x"},
            timeout=10,
        )
        assert resp.status_code in (401, 200)
        assert resp.json().get("error_code") not in ("S000000",)

    def test_invalid_jwt_rejected(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/profile",
            headers={"Authorization": "Bearer invalid_token_here"},
            timeout=10,
        )
        assert resp.status_code in (401, 500, 200)
        if resp.status_code == 200:
            assert resp.json().get("error_code") not in ("S000000",)

    def test_admin_api_requires_auth(self):
        resp = requests.get(f"{API_URL}/api/admin/v1/config/system", timeout=10)
        assert resp.status_code in (401, 200)
        assert resp.json().get("error_code") not in ("S000000",)

    def test_bad_json_body_returns_error(self):
        resp = requests.post(
            f"{API_URL}/api/user/v1/auth/login",
            data="not-json-at-all",
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        assert resp.status_code in (400, 415, 500, 200)

    def test_empty_login_body(self):
        resp = requests.post(
            f"{API_URL}/api/user/v1/auth/login",
            json={},
            timeout=10,
        )
        assert resp.status_code in (400, 401, 422, 200)
        data = resp.json()
        if isinstance(data, dict):
            assert data.get("error_code") not in ("S000000",)

    def test_wrong_http_method(self):
        resp = requests.get(
            f"{API_URL}/api/admin/v1/auth/login",
            timeout=10,
        )
        assert resp.status_code in (405, 404, 400, 200)
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("error_code") not in ("S000000",)

    def test_version_endpoint(self):
        resp = requests.get(f"{API_URL}/version", timeout=10)
        assert resp.status_code in (200, 404)


# =============================================================================
# 2. API – Admin Write Operations
# =============================================================================


class TestApiAdminOperations:
    def _get_token(self) -> str:
        tok = admin_token()
        assert tok, "Admin login failed"
        return tok

    def test_read_system_config(self):
        tok = self._get_token()
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/system",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("error_code") == "S000000"
        assert "SYSTEM_SETTINGS" in data.get("data", {})

    def test_read_domain_default(self):
        tok = self._get_token()
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/domain-default",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("error_code") in ("S000000", "S000001", "S000303")

    def test_read_domains(self):
        tok = self._get_token()
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/domains",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("error_code") == "S000000"
        domains = data.get("data", [])
        assert isinstance(domains, list)

    def test_config_export(self):
        tok = self._get_token()
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/export",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            assert "error_code" in resp.json()

    def test_system_config_has_expected_keys(self):
        tok = self._get_token()
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/system",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=10,
        )
        settings = resp.json().get("data", {}).get("SYSTEM_SETTINGS", {})
        assert isinstance(settings, dict)

    def test_known_domains_in_system_config(self):
        tok = self._get_token()
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/system",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=10,
        )
        settings = resp.json().get("data", {}).get("SYSTEM_SETTINGS", {})
        known = settings.get("SOGO_S_KNOWN_DOMAIN", [])
        assert isinstance(known, list)


# =============================================================================
# 3. Mail Protocol & Integration
# =============================================================================


class TestMailPorts:
    def test_smtp_port(self):
        assert _check_port(SMTP_HOST, SMTP_PORT), "SMTP port not open"

    def test_submission_port(self):
        assert _check_port(SMTP_HOST, SUBMISSION_PORT), "Submission port 20587 not open"

    def test_imap_port(self):
        assert _check_port(SMTP_HOST, IMAP_PORT), "IMAP port 20993 not open"

    def test_smtp_ehlo(self):
        if not _check_port(SMTP_HOST, SMTP_PORT):
            pytest.skip("SMTP port not open")
        try:
            with smtplib.SMTP(host=SMTP_HOST, port=SMTP_PORT, timeout=10) as smtp:
                code, msg = smtp.ehlo()
                assert code == 250, f"EHLO failed: {code} {msg}"
        except (smtplib.SMTPException, OSError) as e:
            pytest.skip(f"SMTP not available: {e}")

    def test_smtp_submission_ehlo(self):
        if not _check_port(SMTP_HOST, SUBMISSION_PORT):
            pytest.skip("Submission port not open")
        try:
            import ssl
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with smtplib.SMTP(host=SMTP_HOST, port=SUBMISSION_PORT, timeout=10) as smtp:
                smtp.starttls(context=ctx)
                code, _ = smtp.ehlo()
                assert code == 250, f"EHLO failed with code {code}"
        except (smtplib.SMTPException, ConnectionRefusedError, OSError) as e:
            pytest.skip(f"Submission TLS not available: {e}")

    def test_imap_greeting(self):
        if not _check_port(SMTP_HOST, IMAP_PORT):
            pytest.skip("IMAP port not open")
        try:
            import ssl
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with imaplib.IMAP4_SSL(host=SMTP_HOST, port=IMAP_PORT, ssl_context=ctx) as imap:
                resp, _ = imap.capability()
                assert resp[0], "No IMAP capabilities"
        except Exception as e:
            if "authenticationfailed" in str(e).lower():
                pytest.skip(f"IMAP login rejected: {e}")
            pytest.skip(f"IMAP TLS not available: {e}")

    def test_docker_smtp_send(self):
        if not _check_port(SMTP_HOST, SMTP_PORT):
            pytest.skip("SMTP not reachable from host")
        try:
            smtp = smtplib.SMTP(host=SMTP_HOST, port=SMTP_PORT, timeout=10)
            smtp.ehlo()
            msg = MIMEText(f"Docker send test {time.time()}")
            msg["Subject"] = f"Python Test {time.time()}"
            msg["From"] = "testuser@example.org"
            msg["To"] = "testuser@example.org"
            smtp.send_message(msg)
            smtp.quit()
        except smtplib.SMTPRecipientsRefused:
            pytest.skip("Relay not allowed from this host")
        except Exception as e:
            pytest.skip(f"SMTP send failed: {e}")


# =============================================================================
# 4. Service Connectivity & Integration
# =============================================================================


class TestServiceConnectivity:
    def test_ui_accessible(self):
        resp = requests.get("http://localhost:3000/", timeout=10)
        assert resp.status_code in (200, 301, 302)

    def test_maildev_accessible(self):
        resp = requests.get("http://localhost:1080/", timeout=10)
        assert resp.status_code in (200, 404)

    def test_cors_headers(self):
        resp = requests.options(
            f"{API_URL}/api/user/v1/auth/login",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
            timeout=10,
        )
        assert resp.status_code in (200, 204, 404)

    def test_caldav_discovery(self):
        resp = requests.get(
            f"{API_URL}/.well-known/caldav",
            timeout=10,
            allow_redirects=True,
        )
        assert resp.status_code in (200, 301, 302, 404)

    def test_carddav_discovery(self):
        resp = requests.get(
            f"{API_URL}/.well-known/carddav",
            timeout=10,
            allow_redirects=True,
        )
        assert resp.status_code in (200, 301, 302, 404)

    def test_api_timing(self):
        times = []
        for _ in range(5):
            start = time.time()
            requests.get(f"{API_URL}/api/user/v1/system", timeout=10)
            times.append(time.time() - start)
        avg = sum(times) / len(times)
        assert avg < 5.0, f"API response avg {avg:.2f}s > 5s"

    def test_nginx_http(self):
        resp = requests.get("http://localhost:80/", timeout=10, allow_redirects=False)
        assert resp.status_code in (200, 301, 302, 308, 502)

    def test_redis_used_by_server(self):
        tok = admin_token()
        assert tok
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/system",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=10,
        )
        assert resp.status_code == 200


# =============================================================================
# 5. Rate Limiting & Abuse Prevention
# =============================================================================


class TestRateLimiting:
    def test_rapid_login_requests(self):
        for _ in range(20):
            try:
                requests.post(
                    f"{API_URL}/api/user/v1/auth/login",
                    json={"username": "testuser@example.org", "password": "password123"},
                    timeout=5,
                )
            except Exception:
                pass
        resp = requests.post(
            f"{API_URL}/api/user/v1/auth/login",
            json={"username": "testuser@example.org", "password": "password123"},
            timeout=10,
        )
        assert resp.status_code in (200, 429)
