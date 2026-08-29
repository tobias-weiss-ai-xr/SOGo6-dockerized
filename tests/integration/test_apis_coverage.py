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

    def test_webhooks_listable(self, admin_tok):
        resp = requests.get(f"{API_URL}/api/admin/v1/webhooks",
                             headers={"Authorization": f"Bearer {admin_tok}"}, timeout=10)
        assert resp.status_code == 200
        assert "webhooks" in resp.json().get("data", {})

    def test_workflows_listable(self, admin_tok):
        resp = requests.get(f"{API_URL}/api/admin/v1/workflows",
                             headers={"Authorization": f"Bearer {admin_tok}"}, timeout=10)
        assert resp.status_code == 200
        assert "workflows" in resp.json().get("data", {})

    def test_audit_log_listable(self, admin_tok):
        resp = requests.get(f"{API_URL}/api/admin/v1/audit-log",
                             headers={"Authorization": f"Bearer {admin_tok}"}, timeout=10)
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        assert "entries" in data and "total" in data


# ─────────────────────────────────────────────────────────────────────────────
# JMAP protocol (RFC 8620) — session + one method call
# ─────────────────────────────────────────────────────────────────────────────

class TestJmapProtocol:
    # JMAP is a user mail protocol: it is mounted under /api/user/v1/jmap and
    # resolves the caller's real mail account (main account id "0").

    def test_jmap_session(self, user_tok):
        # RFC 8620 §2: the session advertises capabilities + apiUrl and the
        # caller's accountId (the mail module's main-account id, "0").
        resp = requests.get(f"{API_URL}/api/user/v1/jmap/session",
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "urn:ietf:params:jmap:core" in data.get("capabilities", {})
        assert data.get("apiUrl") == "/jmap"
        assert "0" in data.get("accounts", {})

    def test_jmap_status(self, user_tok):
        resp = requests.get(f"{API_URL}/api/user/v1/jmap/status",
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        assert data.get("enabled") is True
        assert isinstance(data.get("capabilities", []), list) and data["capabilities"]

    def test_jmap_mailbox_get(self, user_tok):
        # RFC 8620 §2.1: POST with `using` + top-level `accountId` + `methodCalls`.
        # The gateway is wired (registered under the user API), so Mailbox/get
        # returns the caller's real mailboxes (INBOX, Drafts, ...).
        body = {
            "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
            "accountId": "0",
            "methodCalls": [["Mailbox/get", {"ids": None}, "0"]],
        }
        resp = requests.post(f"{API_URL}/api/user/v1/jmap", json=body,
                              headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        env = resp.json()
        assert "methodResponses" in env and isinstance(env["methodResponses"], list)
        name, result, _cid = env["methodResponses"][0]
        assert name == "Mailbox/get"
        assert isinstance(result.get("list", []), list) and len(result["list"]) >= 1

    def test_jmap_requires_core_capability(self, user_tok):
        # RFC 8620 §2.1: omitting urn:ietf:params:jmap:core yields an
        # unknownCapability method error (still HTTP 200 — protocol-level, not 4xx).
        body = {"using": [], "methodCalls": [["Mailbox/get", {"ids": None}, "0"]]}
        resp = requests.post(f"{API_URL}/api/user/v1/jmap", json=body,
                              headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        env = resp.json()
        assert env["methodResponses"][0][0] == "error"
        assert env["methodResponses"][0][1].get("type") == "unknownCapability"


class TestUserAuthApis:
    """User auth/security blueprints previously orphaned or probed at the wrong
    path. Mounted under /api/user/v1/auth/..., /api/user/v1/oauth, /api/user/v1/push."""

    def test_app_passwords_listable(self, user_tok):
        resp = requests.get(f"{API_URL}/api/user/v1/auth/app-passwords/",
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json().get("data", []), list)

    def test_oauth_clients_listable(self, user_tok):
        resp = requests.get(f"{API_URL}/api/user/v1/oauth/clients",
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        assert "clients" in resp.json().get("data", {})

    def test_push_vapid_public_key(self, user_tok):
        resp = requests.get(f"{API_URL}/api/user/v1/push/vapid-public-key",
                             headers={"Authorization": f"Bearer {user_tok}"}, timeout=10)
        assert resp.status_code == 200
        assert "public_key" in resp.json()


class TestAdminCoverageExtended2:
    """Admin endpoints that earlier 404'd only because they were probed at the
    blueprint root instead of their real sub-paths."""

    def test_file_shares_listable(self, admin_tok):
        resp = requests.get(f"{API_URL}/api/admin/v1/files/shares",
                             headers={"Authorization": f"Bearer {admin_tok}"}, timeout=10)
        assert resp.status_code == 200
        assert "shares" in resp.json().get("data", {})

    def test_domain_branding(self, admin_tok):
        resp = requests.get(f"{API_URL}/api/admin/v1/branding/example.org",
                             headers={"Authorization": f"Bearer {admin_tok}"}, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)
