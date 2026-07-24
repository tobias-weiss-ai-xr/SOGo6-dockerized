"""Integration tests for the SOGo 6 + Stalwart + OpenLDAP stack."""

import subprocess
import socket
import json
import os

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
ADMIN_USER = os.getenv("SOGO_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("SOGO_ADMIN_PASSWORD", "admin")

TEST_USERS = {
    "testuser@example.org": "password123",
    "testadmin@example.org": "password123",
    "testuser2@example.org": "password123",
}

pytestmark = pytest.mark.skipif(
    not os.getenv("SOGO_INTEGRATION_TESTS"),
    reason="Set SOGO_INTEGRATION_TESTS=1 to run integration tests"
)


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


class TestLdap:
    def ldapsearch(self, *args):
        cmd = [
            "ldapsearch", "-x",
            "-H", f"ldap://{LDAP_HOST}:{LDAP_PORT}",
            "-b", LDAP_BASE_DN,
            "-D", LDAP_BIND_DN,
            "-w", LDAP_BIND_PW,
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
        dn_count = sum(1 for line in result.stdout.splitlines() if line.startswith("dn:"))
        assert dn_count >= 1

    def test_user_login_bind(self):
        for username, password in TEST_USERS.items():
            cmd = [
                "ldapsearch", "-x",
                "-H", f"ldap://{LDAP_HOST}:{LDAP_PORT}",
                "-b", LDAP_BASE_DN,
                "-D", f"uid={username},{LDAP_BASE_DN}",
                "-w", password,
                "-s", "base",
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            assert result.returncode == 0, f"LDAP bind failed for {username}"


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

    def test_imap_port(self):
        assert self._check_port(SMTP_HOST, IMAP_PORT), "IMAP port not open"

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


class TestServices:
    def test_ui_accessible(self):
        resp = requests.get("http://localhost:3000/", timeout=10)
        assert resp.status_code in (200, 301, 302)

    def test_maildev_accessible(self):
        resp = requests.get("http://localhost:1080/", timeout=10)
        assert resp.status_code == 200

    def test_stalwart_health(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        try:
            result = sock.connect_ex((SMTP_HOST, SMTP_PORT))
            assert result == 0
        finally:
            sock.close()
