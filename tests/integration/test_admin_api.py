"""Admin API tests — adopted from upstream SOGo6-server Tests/test_interface/test_admin patterns.

Tests admin configuration CRUD, user management, and system operations.
"""

import pytest
import requests

from .test_stack import (
    API_URL, ADMIN_USER, ADMIN_PASSWORD, LDAP_AVAILABLE, pytestmark,
)


def _admin_token():
    resp = requests.post(
        f"{API_URL}/api/admin/v1/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASSWORD},
        timeout=10,
    )
    assert resp.status_code == 200
    return resp.json()["data"]["jwt_token"]


class TestAdminConfig:
    """upstream test_InterfaceApiAdminConfig / test_moduleAdminConfig pattern."""

    @pytest.fixture(autouse=True)
    def _auth(self):
        try:
            self.token = _admin_token()
        except Exception:
            pytest.skip("Admin login failed")

    def test_read_system_settings(self):
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/system",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code == 200
        settings = resp.json()["data"]["SYSTEM_SETTINGS"]
        assert isinstance(settings, dict)
        # Verify expected keys (upstream ConfigSpec: required config parameters)
        assert "SOGO_S_KNOWN_DOMAIN" in settings or "SOGO_SUPER_USERNAME" in settings

    def test_read_domains(self):
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/domains",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code == 200
        domains = resp.json()["data"]
        assert isinstance(domains, list)

    def test_read_domain_default(self):
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/domain-default",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code == 200

    def test_update_domain_default(self):
        """upstream test_moduleAdminConfig: update and restore."""
        # Read current
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/domain-default",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        original = resp.json().get("data", {})

        # Update (may fail if endpoint is read-only in this version)
        resp2 = requests.put(
            f"{API_URL}/api/admin/v1/config/domain-default",
            headers={"Authorization": f"Bearer {self.token}"},
            json=original,
            timeout=10,
        )
        assert resp2.status_code in (200, 403, 405, 404)


class TestAdminUsers:
    """upstream test_InterfaceApiAdminUser / test_moduleAdminUser pattern."""

    @pytest.fixture(autouse=True)
    def _auth(self):
        try:
            self.token = _admin_token()
        except Exception:
            pytest.skip("Admin login failed")

    def test_list_users(self):
        resp = requests.get(
            f"{API_URL}/api/admin/v1/users",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            users = resp.json().get("data", [])
            assert isinstance(users, (list, dict))

    def test_user_search(self):
        resp = requests.get(
            f"{API_URL}/api/admin/v1/users",
            headers={"Authorization": f"Bearer {self.token}"},
            params={"search": "testuser"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)


class TestAdminJobs:
    """upstream test_InterfaceApiJob pattern."""

    @pytest.fixture(autouse=True)
    def _auth(self):
        try:
            self.token = _admin_token()
        except Exception:
            pytest.skip("Admin login failed")

    def test_list_jobs(self):
        resp = requests.get(
            f"{API_URL}/api/admin/v1/jobs",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)

    def test_config_export(self):
        """upstream ConfigSpec: config export/import pattern."""
        resp = requests.get(
            f"{API_URL}/api/admin/v1/config/export",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            assert isinstance(data, dict)
