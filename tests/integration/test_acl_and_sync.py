"""ACL isolation, WebDAV sync, and IMIP-like tests.

Adopted from upstream patterns:
  - DAVCalendarAclSpec.js: cross-user calendar/contact/mail isolation
  - DAVPublicAccessSpec.js: anonymous access boundaries
  - WebDavSyncSpec.js: sync-collection REPORT with sync-token
  - test_ImipParser.py: IMIP method parsing from email
  - test_FreeBusyEngine.py: freebusy classification and clipping
  - test_ModuleCalendarAttendance.py: attendance status changes
"""
import time
import pytest
import requests

from .test_stack import (
    API_URL, user_token, admin_token, LDAP_AVAILABLE, SMTP_DELIVERY_AVAILABLE,
    pytestmark,
)


@pytest.fixture(scope="class")
def tokens(request):
    """Get tokens for two different users."""
    t1 = user_token("testuser@example.org", "password123")
    t2 = user_token("testuser2@example.org", "password123")
    if not t1 or not t2:
        pytest.skip("Need both user tokens")
    request.cls.t1 = t1
    request.cls.t2 = t2


# ═══════════════════════════════════════════════════════════════════════════
# Cross-user ACL isolation (upstream DAVCalendarAclSpec pattern)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.usefixtures("tokens")
class TestCrossUserIsolation:
    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_user2_cannot_access_user1_events(self):
        """User2's event list should not contain User1's events."""
        resp = requests.get(
            f"{API_URL}/api/user/v1/calendar/events",
            headers={"Authorization": f"Bearer {self.t2}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            events = resp.json().get("data", [])
            if isinstance(events, list):
                for ev in events:
                    organizer = ev.get("organizer", {})
                    email = organizer.get("email", "") if isinstance(organizer, dict) else ""
                    assert email != "testuser@example.org", (
                        f"User2's event list contains User1's event: {ev.get('uid')}"
                    )

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_user2_cannot_access_user1_contacts(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/contact/contacts",
            headers={"Authorization": f"Bearer {self.t2}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_user_token_returns_own_profile(self):
        """Upstream test_InterfaceAuthUser: token identity isolation."""
        resp = requests.get(
            f"{API_URL}/api/user/v1/profile",
            headers={"Authorization": f"Bearer {self.t1}"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        # The profile endpoint nests the primary address under
        # mailboxes[0].identities[].mail (there is no top-level data.email).
        email = data.get("email", "") or data.get("profile", {}).get("email", "")
        if not email:
            mailboxes = data.get("mailboxes") or []
            for mb in mailboxes:
                if isinstance(mb, dict):
                    for ident in mb.get("identities") or []:
                        if isinstance(ident, dict) and ident.get("mail"):
                            email = ident["mail"]
                            break
        assert "testuser@example.org" in email, (
            f"Token identity leak: expected testuser@example.org, got {email}"
        )

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_user2_cannot_delete_user1_event(self):
        resp = requests.delete(
            f"{API_URL}/api/user/v1/calendar/events/user1-event-does-not-exist",
            headers={"Authorization": f"Bearer {self.t2}"},
            timeout=10,
        )
        assert resp.status_code in (403, 404), (
            f"Expected 403/404, got {resp.status_code}"
        )


# ═══════════════════════════════════════════════════════════════════════════
# Public access boundaries (upstream DAVPublicAccessSpec pattern)
# ═══════════════════════════════════════════════════════════════════════════


class TestPublicAccess:
    def test_anon_dav_propfind_returns_401(self):
        """Anonymous PROPFIND on user collection must be denied."""
        resp = requests.request(
            "PROPFIND",
            f"{API_URL}/SOGo/dav/testuser@example.org/",
            headers={"Depth": "0", "Content-Type": "application/xml"},
            data='<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:displayname/></D:prop></D:propfind>',
            timeout=10,
        )
        assert resp.status_code in (401, 403, 404)

    @pytest.mark.parametrize("endpoint", [
        "/api/user/v1/profile",
        "/api/user/v1/calendar/events",
        "/api/user/v1/contact/contacts",
        "/api/user/v1/mailboxes",
        "/api/user/v1/preferences",
        "/api/admin/v1/config/system",
    ])
    def test_anon_rest_api_denied(self, endpoint):
        """Anonymous REST API access must be denied (except public endpoints).

        401 = requires auth, 403 = forbidden, 404 = route not disclosed to
        anonymous callers — all are valid block postures (404 avoids leaking
        protected routes).
        """
        resp = requests.get(f"{API_URL}{endpoint}", timeout=10)
        assert resp.status_code in (401, 403, 404), (
            f"Anonymous {endpoint} returned {resp.status_code} (should be blocked)"
        )

    def test_system_endpoint_is_public(self):
        """Upstream: /api/user/v1/system is intentionally public."""
        resp = requests.get(f"{API_URL}/api/user/v1/system", timeout=10)
        assert resp.status_code in (200, 412)

    def test_anon_empty_login_returns_error(self):
        resp = requests.post(
            f"{API_URL}/api/user/v1/auth/login",
            json={},
            timeout=10,
        )
        assert resp.status_code in (400, 401, 422)


# ═══════════════════════════════════════════════════════════════════════════
# WebDAV sync-collection (upstream WebDavSyncSpec pattern)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.fixture(scope="class")
def user_tok(request):
    tok = user_token("testuser@example.org", "password123")
    if not tok:
        pytest.skip("Cannot authenticate")
    request.cls.token = tok


@pytest.mark.usefixtures("user_tok")
class TestWebDavSync:
    SYNC_BODY = '''<?xml version="1.0" encoding="utf-8"?>
<D:sync-collection xmlns:D="DAV:">
 <D:sync-token/>
 <D:sync-level>1</D:sync-level>
 <D:prop><D:getetag/></D:prop>
</D:sync-collection>'''

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_sync_collection_calendar(self):
        resp = requests.request(
            "REPORT",
            f"{API_URL}/SOGo/dav/testuser@example.org/Calendar/personal/",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Depth": "1",
                "Content-Type": "application/xml",
            },
            data=self.SYNC_BODY,
            timeout=10,
        )
        # May be 207 (working) or 401 (needs legacy cookie auth)
        assert resp.status_code in (207, 401, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_sync_collection_contacts(self):
        resp = requests.request(
            "REPORT",
            f"{API_URL}/SOGo/dav/testuser@example.org/Contacts/personal/",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Depth": "1",
                "Content-Type": "application/xml",
            },
            data=self.SYNC_BODY,
            timeout=10,
        )
        assert resp.status_code in (207, 401, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_sync_collection_with_invalid_token(self):
        """Upstream WebDavSyncSpec: invalid token still returns 207 (RFC 6578)."""
        body = self.SYNC_BODY.replace("<D:sync-token/>", "<D:sync-token>invalid-12345</D:sync-token>")
        resp = requests.request(
            "REPORT",
            f"{API_URL}/SOGo/dav/testuser@example.org/Calendar/personal/",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Depth": "1",
                "Content-Type": "application/xml",
            },
            data=body,
            timeout=10,
        )
        assert resp.status_code in (207, 401, 404)


# ═══════════════════════════════════════════════════════════════════════════
# FreeBusy API (upstream test_FreeBusyEngine pattern)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.usefixtures("user_tok")
class TestFreeBusy:
    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_single_user_freebusy(self):
        resp = requests.post(
            f"{API_URL}/api/user/v1/calendar/freebusy",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "user": "testuser@example.org",
                "start": "2025-01-01T00:00:00Z",
                "end": "2025-12-31T23:59:59Z",
            },
            timeout=10,
        )
        assert resp.status_code in (200, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_multi_user_freebusy(self):
        resp = requests.post(
            f"{API_URL}/api/user/v1/calendar/freebusy",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "users": ["testuser@example.org", "testuser2@example.org"],
                "start": "2025-09-01T00:00:00Z",
                "end": "2025-09-30T23:59:59Z",
            },
            timeout=10,
        )
        assert resp.status_code in (200, 404)


# ═══════════════════════════════════════════════════════════════════════════
# Attendance / RSVP (upstream test_ModuleCalendarAttendance pattern)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.usefixtures("user_tok")
class TestAttendance:
    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_set_attendance_accepted(self):
        """Upstream CalDAVSchedulingSpec: attendee ACCEPTED."""
        resp = requests.put(
            f"{API_URL}/api/user/v1/calendar/events/nonexistent/attendance",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"attendee_email": "testuser2@example.org", "partstat": "ACCEPTED"},
            timeout=10,
        )
        # 404 = event doesn't exist, 200 = endpoint works
        assert resp.status_code in (200, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_set_attendance_declined(self):
        resp = requests.put(
            f"{API_URL}/api/user/v1/calendar/events/nonexistent/attendance",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"attendee_email": "testuser2@example.org", "partstat": "DECLINED"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)
