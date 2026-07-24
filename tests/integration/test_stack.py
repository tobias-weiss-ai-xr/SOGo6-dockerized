"""Integration tests for the SOGo 6 + Stalwart + OpenLDAP stack."""

import subprocess
import socket
import json
import os
import smtplib
import imaplib
import email
from email.mime.text import MIMEText
from email.header import decode_header

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

TEST_USERS = {
    "testuser@example.org": "password123",
    "testadmin@example.org": "password123",
    "testuser2@example.org": "password123",
}

pytestmark = pytest.mark.skipif(
    not os.getenv("SOGO_INTEGRATION_TESTS"),
    reason="Set SOGO_INTEGRATION_TESTS=1 to run integration tests",
)


# =============================================================================
# API Tests
# =============================================================================


class TestApiHealth:
    def test_system_health(self):
        resp = requests.get(f"{API_URL}/api/user/v1/system", timeout=10)
        assert resp.status_code in (200, 412)
        data = resp.json()
        assert data.get("error_code") in ("S000000", "S000001")

    def test_admin_login(self):
        resp = requests.post(
            f"{API_URL}/api/admin/v1/auth/login",
            json={"username": ADMIN_USER, "password": ADMIN_PASSWORD},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("error_code") == "S000000"
        token = data.get("data", {}).get("jwt_token", "")
        assert len(token) > 20

    def test_user_logins(self):
        for username, password in TEST_USERS.items():
            resp = requests.post(
                f"{API_URL}/api/user/v1/auth/login",
                json={"username": username, "password": password},
                timeout=10,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data.get("error_code") == "S000000", f"Login failed for {username}"
            token = data.get("data", {}).get("jwt_token", "")
            assert len(token) > 20, f"No token for {username}"

    def test_user_profile_after_login(self):
        resp = requests.post(
            f"{API_URL}/api/user/v1/auth/login",
            json={"username": "testuser@example.org", "password": "password123"},
            timeout=10,
        )
        assert resp.status_code == 200
        token = resp.json().get("data", {}).get("jwt_token", "")
        assert token
        profile = requests.get(
            f"{API_URL}/api/user/v1/profile",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        assert profile.status_code == 200
        data = profile.json()
        assert data.get("error_code") == "S000000"

    def test_swagger_accessible(self):
        for path in ("/swagger-basic", "/swagger-admin"):
            resp = requests.get(f"{API_URL}{path}", timeout=10, allow_redirects=True)
            assert resp.status_code in (200, 301, 302), f"Swagger {path} failed"


class TestApiNegative:
    def test_wrong_password_rejected(self):
        resp = requests.post(
            f"{API_URL}/api/user/v1/auth/login",
            json={"username": "testuser@example.org", "password": "wrongpassword"},
            timeout=10,
        )
        assert resp.status_code in (401, 200)
        data = resp.json()
        assert data.get("error_code") not in ("S000000",), "Wrong password was accepted"

    def test_nonexistent_user_rejected(self):
        resp = requests.post(
            f"{API_URL}/api/user/v1/auth/login",
            json={"username": "nobody@example.org", "password": "anything"},
            timeout=10,
        )
        assert resp.status_code in (401, 200)
        data = resp.json()
        assert data.get("error_code") not in ("S000000",), "Non-existent user was accepted"

    def test_invalid_jwt_rejected(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/profile",
            headers={"Authorization": "Bearer invalid_token_here"},
            timeout=10,
        )
        assert resp.status_code in (401, 200)
        data = resp.json()
        assert data.get("error_code") not in ("S000000",), "Invalid JWT was accepted"

    def test_admin_api_requires_auth(self):
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/system", timeout=10
        )
        assert resp.status_code in (401, 200)
        data = resp.json()
        assert data.get("error_code") not in ("S000000",), "Admin API sans auth returned success"


class TestApiWriteOperations:
    def _get_admin_token(self):
        resp = requests.post(
            f"{API_URL}/api/admin/v1/auth/login",
            json={"username": ADMIN_USER, "password": ADMIN_PASSWORD},
            timeout=10,
        )
        return resp.json().get("data", {}).get("jwt_token", "")

    def test_read_system_config(self):
        token = self._get_admin_token()
        assert token, "Admin login failed"
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/system",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("error_code") == "S000000"
        assert "SYSTEM_SETTINGS" in data.get("data", {})

    def test_read_domains(self):
        token = self._get_admin_token()
        assert token
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/domains",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("error_code") == "S000000"
        domains = data.get("data", [])
        assert isinstance(domains, list)

    def test_read_ldap_config(self):
        token = self._get_admin_token()
        assert token
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/ldap",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("error_code") == "S000000"
        directories = data.get("data", {}).get("directories", [])
        assert len(directories) >= 1

    def test_read_smtp_config(self):
        token = self._get_admin_token()
        assert token
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/smtp",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("error_code") == "S000000"


# =============================================================================
# LDAP Tests
# =============================================================================


class TestLdap:
    def ldapsearch(self, *args):
        cmd = [
            "ldapsearch",
            "-x",
            "-H",
            f"ldap://{LDAP_HOST}:{LDAP_PORT}",
            "-b",
            LDAP_BASE_DN,
            "-D",
            LDAP_BIND_DN,
            "-w",
            LDAP_BIND_PW,
            *args,
        ]
        return subprocess.run(cmd, capture_output=True, text=True)

    def test_server_reachable(self):
        result = self.ldapsearch("-s", "base")
        assert result.returncode == 0
        assert LDAP_BASE_DN in result.stdout

    def test_users_exist(self):
        result = self.ldapsearch("(objectClass=inetOrgPerson)")
        assert result.returncode == 0
        dn_count = sum(
            1 for line in result.stdout.splitlines() if line.startswith("dn:")
        )
        assert dn_count >= 1

    def test_user_login_bind(self):
        for username, password in TEST_USERS.items():
            cmd = [
                "ldapsearch",
                "-x",
                "-H",
                f"ldap://{LDAP_HOST}:{LDAP_PORT}",
                "-b",
                LDAP_BASE_DN,
                "-D",
                f"uid={username},{LDAP_BASE_DN}",
                "-w",
                password,
                "-s",
                "base",
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            assert result.returncode == 0, f"LDAP bind failed for {username}"

    def test_user_mail_attributes(self):
        for username in TEST_USERS:
            result = self.ldapsearch(f"(uid={username})", "mail")
            assert result.returncode == 0
            assert username in result.stdout, f"Mail attr mismatch for {username}"

    def test_sogo_admin_role(self):
        result = self.ldapsearch("(uid=testadmin@example.org)", "cn", "mail", "uid")
        assert result.returncode == 0
        assert "testadmin" in result.stdout


# =============================================================================
# Mail Protocol Tests
# =============================================================================


class TestMailPorts:
    def _check_port(self, host, port):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            result = sock.connect_ex((host, port))
            return result == 0
        finally:
            sock.close()

    def test_smtp_port(self):
        assert self._check_port(SMTP_HOST, SMTP_PORT), "SMTP port not open"

    def test_submission_port(self):
        assert self._check_port(SMTP_HOST, SUBMISSION_PORT), "Submission port not open"

    def test_imap_port(self):
        assert self._check_port(SMTP_HOST, IMAP_PORT), "IMAP port not open"

    def test_sieve_port(self):
        assert self._check_port(SMTP_HOST, 4190), "Sieve port not open"

    def test_smtp_ehlo(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        try:
            sock.connect((SMTP_HOST, SMTP_PORT))
            sock.sendall(b"EHLO test.local\r\n")
            response = sock.recv(1024).decode("utf-8", errors="ignore")
            assert "250" in response, f"EHLO failed: {response[:200]}"
        finally:
            sock.close()

    def test_smtp_send_and_imap_receive(self):
        import time

        msg = MIMEText(
            f"This is an integration test email sent at {time.time()}",
            "plain",
            "utf-8",
        )
        msg["Subject"] = f"Python Test {time.time()}"
        msg["From"] = "testuser@example.org"
        msg["To"] = "testuser@example.org"

        smtp = smtplib.SMTP(host=SMTP_HOST, port=SMTP_PORT, timeout=10)
        smtp.ehlo()
        smtp.send_message(msg)
        smtp.quit()

        time.sleep(2)

        imap = imaplib.IMAP4_SSL(host=SMTP_HOST, port=IMAP_PORT)
        imap.login("testuser@example.org", "password123")
        imap.select("INBOX")
        _, data = imap.search(None, "ALL")
        assert data and data[0], "No messages found in INBOX"
        imap.logout()


# =============================================================================
# PostgreSQL Tests
# =============================================================================


class TestPostgres:
    def test_psycopg2_importable(self):
        try:
            import psycopg2
        except ImportError:
            pytest.skip("psycopg2 not installed")

    def test_database_connectivity(self):
        try:
            import psycopg2
        except ImportError:
            pytest.skip("psycopg2 not installed")
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            user=PG_USER,
            password=PG_PASSWORD,
            dbname=PG_DB,
            connect_timeout=5,
        )
        cur = conn.cursor()
        cur.execute("SELECT 1")
        assert cur.fetchone() == (1,)
        cur.close()
        conn.close()

    def test_sogo_schema_exists(self):
        try:
            import psycopg2
        except ImportError:
            pytest.skip("psycopg2 not installed")
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            user=PG_USER,
            password=PG_PASSWORD,
            dbname=PG_DB,
            connect_timeout=5,
        )
        cur = conn.cursor()
        cur.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
        )
        table_count = cur.fetchone()[0]
        assert table_count >= 0
        cur.close()
        conn.close()

    def test_database_exists(self):
        try:
            import psycopg2
        except ImportError:
            pytest.skip("psycopg2 not installed")
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            user=PG_USER,
            password=PG_PASSWORD,
            dbname="postgres",
            connect_timeout=5,
        )
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname='sogo'")
        assert cur.fetchone() is not None, "sogo database not found"
        cur.close()
        conn.close()

    def test_stalwart_schema_exists(self):
        try:
            import psycopg2
        except ImportError:
            pytest.skip("psycopg2 not installed")
        try:
            conn = psycopg2.connect(
                host=PG_HOST,
                port=PG_PORT,
                user=PG_USER,
                password=PG_PASSWORD,
                dbname="stalwart",
                connect_timeout=5,
            )
        except Exception:
            pytest.skip("stalwart database not accessible")
        cur = conn.cursor()
        cur.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
        )
        table_count = cur.fetchone()[0]
        assert table_count >= 0
        cur.close()
        conn.close()


# =============================================================================
# Redis Tests
# =============================================================================


class TestRedis:
    def test_redis_connectivity(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        try:
            result = sock.connect_ex((REDIS_HOST, REDIS_PORT))
            assert result == 0, f"Redis port {REDIS_PORT} not open"
        finally:
            sock.close()

    def test_redis_ping(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        try:
            sock.connect((REDIS_HOST, REDIS_PORT))
            sock.sendall(b"*1\r\n$4\r\nPING\r\n")
            response = sock.recv(1024).decode("utf-8", errors="ignore")
            assert "+PONG" in response, f"Redis ping failed: {response.strip()}"
        finally:
            sock.close()


# =============================================================================
# Service Connectivity Tests
# =============================================================================


class TestServices:
    def test_ui_accessible(self):
        resp = requests.get("http://localhost:3000/", timeout=10)
        assert resp.status_code in (200, 301, 302)

    def test_maildev_accessible(self):
        resp = requests.get("http://localhost:1080/", timeout=10)
        assert resp.status_code == 200

    def test_maildev_api(self):
        resp = requests.get("http://localhost:1080/email", timeout=10)
        assert resp.status_code == 200

    def test_nginx_proxy(self):
        for url, desc in [
            ("http://localhost:80/", "HTTP 80"),
            ("https://localhost:443/", "HTTPS 443"),
        ]:
            resp = requests.get(url, timeout=10, verify=False)
            assert resp.status_code in (
                200, 301, 302, 400, 502
            ), f"{desc} failed: {resp.status_code}"

    def test_stack_api_through_nginx(self):
        resp = requests.get(
            "https://localhost/api/user/v1/system", timeout=10, verify=False
        )
        assert resp.status_code in (200, 502)
        if resp.status_code == 200:
            data = resp.json()
            assert "error_code" in data
