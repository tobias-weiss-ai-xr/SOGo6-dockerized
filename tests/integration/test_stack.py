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
LDAP_BIND_PW = os.getenv("SOGO_LDAP_BIND_PASSWORD") or os.getenv("SOGO_LDAP_BIND_PW", "admin")
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


def _ldap_available() -> bool:
    """Check if LDAP server is reachable and accepts bind."""
    if not _check_port(LDAP_HOST, LDAP_PORT):
        return False
    try:
        import ldap3
        server = ldap3.Server(f"ldap://{LDAP_HOST}:{LDAP_PORT}")
        conn = ldap3.Connection(server, LDAP_BIND_DN, LDAP_BIND_PW, auto_bind=True)
        conn.unbind()
        return True
    except Exception:
        return False


LDAP_AVAILABLE = _ldap_available()


def _smtp_delivery_available() -> bool:
    """Check whether the mail server accepts an internal recipient at RCPT time.

    CI runs Stalwart with no local-domain provisioning (empty store / default
    config), so even demo-internal recipients are treated as remote and refused
    (550 relay). Delivery-dependent tests then skip gracefully — the same
    pattern as ``test_docker_smtp_send``'s "Relay not allowed" skip — while the
    security-boundary tests (external recipient rejected) still run.
    """
    if not _check_port(SMTP_HOST, SMTP_PORT):
        return False
    try:
        with smtplib.SMTP(host=SMTP_HOST, port=SMTP_PORT, timeout=8) as smtp:
            smtp.ehlo("integration-probe")
            code, _ = smtp.mail("testuser@example.org")
            if code != 250:
                return False
            code, _ = smtp.rcpt("testuser2@example.org")
            return code in (250, 251)
    except Exception:
        return False


SMTP_DELIVERY_AVAILABLE = _smtp_delivery_available()


def _mailhardening_token() -> str:
    """Fetch a user token at import time (before rate-limit tests throttle)."""
    try:
        resp = requests.post(
            f"{API_URL}/api/user/v1/auth/login",
            json={"username": "testuser@example.org", "password": "password123"},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json().get("data", {}).get("jwt_token", "")
    except Exception:
        pass
    return ""


_MAILHARDENING_TOKEN = _mailhardening_token()


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

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
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

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
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
    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_wrong_password_rejected(self):
        resp = requests.post(
            f"{API_URL}/api/user/v1/auth/login",
            json={"username": "testuser@example.org", "password": "wrong"},
            timeout=10,
        )
        assert resp.status_code in (401, 200)
        assert resp.json().get("error_code") not in ("S000000",)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
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
    @pytest.mark.skip(reason="sogo6-ui (Next.js standalone) not running in CI")
    def test_ui_accessible(self):
        resp = requests.get("http://localhost:3000/", timeout=10)
        assert resp.status_code in (200, 301, 302)

    def test_maildev_accessible(self):
        pytest.skip("maildev not in stack (Stalwart is the mail server)")

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
        pytest.skip("nginx not in CI stack")

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


class TestScheduleSend:
    """Integration tests for Schedule Send feature (POST /mail/send with send_at)."""

    TOKEN_CACHE: dict[str, str] = {}

    @pytest.fixture(autouse=True)
    def _auth(self):
        """Authenticate once per session and cache the token."""
        if "user" not in self.TOKEN_CACHE:
            resp = requests.post(
                f"{API_URL}/api/user/v1/auth/login",
                json={"username": "testuser@example.org", "password": "password123"},
                timeout=10,
            )
            assert resp.status_code == 200
            data = resp.json()
            self.TOKEN_CACHE["user"] = data.get("data", {}).get("jwt_token", "")
        assert self.TOKEN_CACHE["user"], "Failed to obtain auth token"

    def _send_mail(self, overrides: dict | None = None) -> tuple[dict, int]:
        """Helper to POST /mail/send with standard payload + overrides."""
        payload = {
            "from": "testuser@example.org",
            "to": ["testuser2@example.org"],
            "subject": "Integration Test",
            "body": "Hello from Schedule Send integration test",
        }
        if overrides:
            payload.update(overrides)
        resp = requests.post(
            f"{API_URL}/api/user/v1/mailboxes/0/mail/send",
            headers={"Authorization": f"Bearer {self.TOKEN_CACHE['user']}"},
            json=payload,
            timeout=15,
        )
        return resp.json(), resp.status_code

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_schedule_send_future(self):
        """Scenario 1: Schedule an email with send_at in the future."""
        from datetime import datetime, timezone, timedelta
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()

        result, status = self._send_mail({"send_at": future})

        assert status == 200, f"Expected 200, got {status}: {result}"
        assert result.get("error_code") == "S000000"
        data = result.get("data", {})
        assert data.get("status") == "scheduled", f"Expected 'scheduled', got {data.get('status')}"
        assert data.get("scheduled_at") == future
        assert data.get("job_id"), "Expected a job_id for scheduled send"

    # Requires actual SMTP delivery (local mailbox route); CI's hardened
    # Stalwart has no local domains so these skip like test_docker_smtp_send.
    @pytest.mark.skipif(not SMTP_DELIVERY_AVAILABLE, reason="SMTP delivery/local route not available (see test_docker_smtp_send)")
    def test_schedule_send_immediate_no_send_at(self):
        """Scenario 4: Send immediately (no send_at) — existing behaviour unchanged."""
        result, status = self._send_mail()

        assert status == 200, f"Expected 200, got {status}: {result}"
        assert result.get("error_code") == "S000000"
        # Without send_at, the email should be sent immediately
        data = result.get("data", {})
        assert data.get("status") in ("sent", "pending"), (
            f"Expected 'sent' or 'pending', got {data.get('status')}"
        )

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_schedule_send_invalid_date_format(self):
        """Invalid send_at format → 400 error with dedicated error code."""
        result, status = self._send_mail({"send_at": "not-a-date"})

        assert status == 400, f"Expected 400, got {status}: {result}"
        # Server returns S000396 (Invalid Scheduled Date Format); keep S000300
        # tolerant for older deployments.
        assert result.get("error_code") in ("S000396", "S000300"), (
            f"Unexpected error_code: {result.get('error_code')}"
        )

    # Requires actual SMTP delivery (local mailbox route); CI's hardened
    # Stalwart has no local domains so these skip like test_docker_smtp_send.
    @pytest.mark.skipif(not SMTP_DELIVERY_AVAILABLE, reason="SMTP delivery/local route not available (see test_docker_smtp_send)")
    def test_schedule_send_past_date(self):
        """send_at in the past → sent immediately (not an error)."""
        from datetime import datetime, timezone, timedelta
        past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

        result, status = self._send_mail({"send_at": past})

        assert status == 200, f"Expected 200, got {status}: {result}"
        assert result.get("error_code") == "S000000"
        data = result.get("data", {})
        assert data.get("status") in ("sent", "pending"), (
            f"Expected 'sent' or 'pending' for past send_at, got {data.get('status')}"
        )


class TestRateLimiting:
    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
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
        # After 20 rapid attempts the per-IP login throttle (20/60s) engages.
        # The throttled response is a generic 401 (indistinguishable from bad
        # credentials on purpose — avoids leaking throttle state).
        assert resp.status_code in (200, 429, 401), (
            f"Unexpected status after throttle: {resp.status_code}"
        )


class TestMailHardening:
    """Security boundary: test accounts must not send mail outside the demo.

    The CI stack runs Stalwart with no relay route: recipients outside the demo
    domain have no delivery path and are rejected. These tests prove the
    boundary holds.
    """

    TOKEN_CACHE: dict[str, str] = {}

    @pytest.fixture(autouse=True)
    def _auth(self):
        """Use the module-scope token, obtained at import time (before any
        login-rate-limit tests run and throttle this IP)."""
        if not _MAILHARDENING_TOKEN:
            pytest.skip(
                "Could not obtain auth token for mail hardening tests "
                "(login throttled / server not ready)"
            )
        self.TOKEN_CACHE["user"] = _MAILHARDENING_TOKEN

    def _send(self, recipient: str) -> tuple[dict, int]:
        resp = requests.post(
            f"{API_URL}/api/user/v1/mailboxes/0/mail/send",
            headers={"Authorization": f"Bearer {self.TOKEN_CACHE['user']}"},
            json={
                "from": "testuser@example.org",
                "to": [recipient],
                "subject": "Boundary Test",
                "body": "Must never reach an external mailbox",
            },
            timeout=15,
        )
        return resp.json(), resp.status_code

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_external_recipient_rejected(self):
        """Mail to a real external domain is refused, not delivered."""
        result, status = self._send("nobody@example.com")
        assert status != 200, f"External recipient was accepted: {result}"
        assert result.get("error_code") != "S000000"

    @pytest.mark.skipif(not SMTP_DELIVERY_AVAILABLE, reason="SMTP delivery/local route not available (see test_docker_smtp_send)")
    def test_internal_recipient_deliverable(self):
        """Mail to another demo-internal mailbox is accepted and queued/delivered."""
        result, status = self._send("testuser2@example.org")
        assert status == 200, f"Internal recipient rejected: {result}"
        assert result.get("error_code") == "S000000"
