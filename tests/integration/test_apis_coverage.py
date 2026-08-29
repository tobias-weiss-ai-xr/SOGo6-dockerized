"""Coverage-gap tests for user-facing + admin APIs listed in GAP-ANALYSIS §6.

These exercise the "73 blueprint prefixes" surface that the suite previously left
untested: global search, resources, scheduling polls, preferences, profile,
WebAuthn status, customization themes (user), and usage quotas, approval
workflows, backup status, config-as-code export (admin).

NOTE: a few §6 blueprints are NOT mounted in this build and are intentionally
excluded here (`/api/user/v1/oauth/clients`, `/app-passwords`,
`/push/vapid-public-key` all return 404 — those blueprints are not registered
in the running image). Re-add them if a future build mounts them.

Run with: cd tests/integration && PYTHONPATH=. SOGO_INTEGRATION_TESTS=1 \
         SOGO_ADMIN_PASSWORD=<pw> pytest test_apis_coverage.py -v
"""

import os
import pytest
import requests

from .test_stack import (
    API_URL,
    LDAP_AVAILABLE,
    user_token,
    admin_token,
)

pytestmark = pytest.mark.skipif(
    not os.getenv("SOGO_INTEGRATION_TESTS"),
    reason="Set SOGO_INTEGRATION_TESTS=1 to run integration tests",
)


@pytest.fixture(scope="module")
def user_tok():
    t = user_token("testuser@example.org", "password123")
    if not t:
        pytest.skip("could not obtain user token")
    return t


@pytest.fixture(scope="module")
def admin_tok():
    t = admin_token()
    if not t:
        pytest.skip("could not obtain admin token")
    return t


# ─────────────────────────────────────────────────────────────────────────────
# User-facing APIs
# ─────────────────────────────────────────────────────────────────────────────


class TestUserFacingApis:
    def test_resources_listable(self, user_tok):
        resp = requests.get(f"{API_URL}/api/user/v1/resources",
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        body = resp.json()
        # Endpoint returns a top-level JSON array of resource entries.
        assert isinstance(body, list) and len(body) >= 0

    def test_scheduling_polls_listable(self, user_tok):
        resp = requests.get(f"{API_URL}/api/user/v1/polls",
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        assert "polls" in data and isinstance(data["polls"], list)

    def test_preferences_readable(self, user_tok):
        resp = requests.get(f"{API_URL}/api/user/v1/preferences",
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json().get("data", {}), dict)

    def test_profile_readable_with_identity(self, user_tok):
        resp = requests.get(f"{API_URL}/api/user/v1/profile",
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        mailboxes = data.get("mailboxes", [])
        assert isinstance(mailboxes, list) and len(mailboxes) >= 1
        identities = mailboxes[0].get("identities", [])
        assert any(i.get("mail") == "testuser@example.org" for i in identities)

    def test_webauthn_status(self, user_tok):
        resp = requests.get(f"{API_URL}/api/user/v1/webauthn",
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "supported" in data and isinstance(data["supported"], bool)
        assert "passkey_count" in data and isinstance(data["passkey_count"], int)

    def test_customization_themes(self, user_tok):
        resp = requests.get(f"{API_URL}/api/user/v1/customization/themes",
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200

    def test_global_search(self, user_tok):
        resp = requests.get(f"{API_URL}/api/user/v1/search/global",
                             params={"q": "meeting"},
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        # Search returns a JSON envelope; accept either a data wrapper or a
        # top-level list — just confirm it parsed and the call succeeded.
        assert resp.json() is not None


# ─────────────────────────────────────────────────────────────────────────────
# Admin APIs
# ─────────────────────────────────────────────────────────────────────────────


class TestAdminApis:
    def test_usage_quotas(self, admin_tok):
        resp = requests.get(f"{API_URL}/api/admin/v1/quotas/testuser@example.org",
                             headers={"Authorization": f"Bearer {admin_tok}"}, timeout=10)
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        assert "sources" in data and "usage" in data

    def test_approval_workflows(self, admin_tok):
        resp = requests.get(f"{API_URL}/api/admin/v1/approvals",
                             headers={"Authorization": f"Bearer {admin_tok}"}, timeout=10)
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        assert "approvals" in data and isinstance(data["approvals"], list)

    def test_backup_status(self, admin_tok):
        resp = requests.get(f"{API_URL}/api/admin/v1/backup",
                             headers={"Authorization": f"Bearer {admin_tok}"}, timeout=10)
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        assert isinstance(data.get("config", {}), dict)
        assert isinstance(data.get("entries", []), list)

    def test_config_as_code_export(self, admin_tok):
        resp = requests.get(f"{API_URL}/api/admin/v1/config-as-code/export",
                             headers={"Authorization": f"Bearer {admin_tok}"}, timeout=10)
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        assert isinstance(data.get("config", {}), dict)
        assert isinstance(data.get("checksum", ""), str) and data.get("checksum")
