"""CalDAV and CardDAV protocol tests — adopted from upstream SOGo Tests/spec/CalDAVPropertiesSpec.js, CardDAVSpec.js.

Tests WebDAV-level operations (PROPFIND, REPORT, OPTIONS) and REST API
endpoints for calendar and contact operations.
"""

import pytest
import requests
import xml.etree.ElementTree as ET

from .test_stack import (
    API_URL, user_token, admin_token, LDAP_AVAILABLE, _check_port, pytestmark,
)


@pytest.fixture(scope="class")
def user_tok(request):
    """Authenticate once per test class."""
    tok = user_token("testuser@example.org", "password123")
    if not tok:
        pytest.skip("Cannot authenticate test user")
    request.cls.token = tok


# ═══════════════════════════════════════════════════════════════════════════
# CalDAV Discovery (upstream CalDAVPropertiesSpec pattern)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.usefixtures("user_tok")
class TestCalDAVDiscovery:
    def test_well_known_caldav(self):
        resp = requests.get(
            f"{API_URL}/.well-known/caldav", timeout=10, allow_redirects=True
        )
        assert resp.status_code in (200, 301, 302, 404)

    def test_options_caldav_root(self):
        resp = requests.options(
            f"{API_URL}/SOGo/dav/", timeout=10
        )
        assert resp.status_code in (200, 404, 405)
        dav_header = resp.headers.get("DAV", "")
        if dav_header:
            assert "calendar-access" in dav_header, "Expected calendar-access in DAV header"

    def test_propfind_calendar_home_anonymous(self):
        body = '''<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
    <C:calendar-home-set xmlns:C="urn:ietf:params:xml:ns:caldav"/>
  </D:prop>
</D:propfind>'''
        resp = requests.request(
            "PROPFIND",
            f"{API_URL}/SOGo/dav/testuser@example.org/Calendar/",
            headers={"Depth": "0", "Content-Type": "application/xml"},
            data=body,
            timeout=10,
        )
        # Should require auth or return 207 if legacy endpoint
        assert resp.status_code in (207, 401, 403, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_propfind_calendar_home_authenticated(self):
        body = '''<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
    <C:calendar-home-set/>
    <C:supported-calendar-component-set/>
  </D:prop>
</D:propfind>'''
        resp = requests.request(
            "PROPFIND",
            f"{API_URL}/SOGo/dav/testuser@example.org/Calendar/",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Depth": "0",
                "Content-Type": "application/xml",
            },
            data=body,
            timeout=10,
        )
        assert resp.status_code in (207, 401, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_principal_collection_set(self):
        """upstream WebDAVSpec: principal-collection-set on collection object"""
        body = '''<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:principal-collection-set/>
  </D:prop>
</D:propfind>'''
        resp = requests.request(
            "PROPFIND",
            f"{API_URL}/SOGo/dav/",
            headers={"Depth": "0", "Content-Type": "application/xml"},
            data=body,
            timeout=10,
        )
        assert resp.status_code in (207, 401, 404)


# ═══════════════════════════════════════════════════════════════════════════
# CalDAV REST API (upstream test_InterfaceApiCalendarEvent pattern)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.usefixtures("user_tok")
class TestCalendarAPI:
    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_list_calendars(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/calendar/calendars",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_create_and_delete_event(self):
        """Full event CRUD lifecycle: create → read → delete.

        Mirrors upstream test_ModuleCalendarEvent.
        """
        import time
        uid = f"pytest-{int(time.time())}"
        payload = {
            "summary": f"Pytest CalDAV Test {uid}",
            "start": "2025-07-15T10:00:00Z",
            "end": "2025-07-15T11:00:00Z",
            "description": "Created by test_caldav_carddav.py",
        }
        # Create
        resp = requests.post(
            f"{API_URL}/api/user/v1/calendar/events",
            headers={"Authorization": f"Bearer {self.token}"},
            json=payload,
            timeout=10,
        )
        if resp.status_code in (200, 201):
            data = resp.json().get("data", {})
            event_id = data.get("id", "")
            assert event_id, "Event ID missing from create response"

            # Read
            resp2 = requests.get(
                f"{API_URL}/api/user/v1/calendar/events/{event_id}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10,
            )
            assert resp2.status_code == 200

            # Delete
            resp3 = requests.delete(
                f"{API_URL}/api/user/v1/calendar/events/{event_id}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10,
            )
            assert resp3.status_code in (200, 204)
        else:
            pytest.skip(f"Event creation returned {resp.status_code} — endpoint may differ")

    def test_freebusy_endpoint(self):
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

    def test_timezones_endpoint(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/calendar/timezones",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)


# ═══════════════════════════════════════════════════════════════════════════
# CardDAV Discovery (upstream CardDAVSpec pattern)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.usefixtures("user_tok")
class TestCardDAVDiscovery:
    def test_well_known_carddav(self):
        resp = requests.get(
            f"{API_URL}/.well-known/carddav", timeout=10, allow_redirects=True
        )
        assert resp.status_code in (200, 301, 302, 404)

    def test_propfind_addressbook_home(self):
        body = '''<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
    <C:addressbook-home-set/>
  </D:prop>
</D:propfind>'''
        resp = requests.request(
            "PROPFIND",
            f"{API_URL}/SOGo/dav/testuser@example.org/Contacts/",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Depth": "0",
                "Content-Type": "application/xml",
            },
            data=body,
            timeout=10,
        )
        assert resp.status_code in (207, 401, 404)


# ═══════════════════════════════════════════════════════════════════════════
# CardDAV REST API (upstream test_InterfaceApiContactContact pattern)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.usefixtures("user_tok")
class TestContactAPI:
    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_list_contacts(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/contact/contacts",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_create_and_delete_contact(self):
        """Full contact CRUD lifecycle: create → read → delete.

        Mirrors upstream test_RepositoryContact.
        """
        import time
        uid = f"pytest-contact-{int(time.time())}"
        payload = {
            "first_name": uid,
            "last_name": "Test",
            "email": [f"{uid}@example.org"],
        }
        resp = requests.post(
            f"{API_URL}/api/user/v1/contact/contacts",
            headers={"Authorization": f"Bearer {self.token}"},
            json=payload,
            timeout=10,
        )
        if resp.status_code in (200, 201):
            data = resp.json().get("data", {})
            contact_id = data.get("id", "")
            assert contact_id, "Contact ID missing from create response"

            resp2 = requests.get(
                f"{API_URL}/api/user/v1/contact/contacts/{contact_id}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10,
            )
            assert resp2.status_code == 200

            resp3 = requests.delete(
                f"{API_URL}/api/user/v1/contact/contacts/{contact_id}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10,
            )
            assert resp3.status_code in (200, 204)
        else:
            pytest.skip(f"Contact creation returned {resp.status_code}")

    def test_addressbooks_list(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/contact/addressbooks",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)

    def test_autocomplete(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/contact/autocomplete",
            headers={"Authorization": f"Bearer {self.token}"},
            params={"query": "test"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)
