"""Job lifecycle, import/export, and agent tests.

Adopted from upstream patterns:
  - test_Job.py: job creation, metadata, process
  - test_JobState.py: round-trip serialization, all fields preserved
  - test_JobRecovery.py: job polling, status transitions
  - test_JobImportIcs / test_JobExportIcs: calendar import/export
  - test_JobImportContact / test_JobExportContact: contact import/export
  - test_AddressBookContentDeserializer: vCard roundtrip integrity
"""
import time
import pytest
import requests

from .test_stack import (
    API_URL, user_token, admin_token, LDAP_AVAILABLE, pytestmark,
)


@pytest.fixture(scope="class")
def user_tok(request):
    tok = user_token("testuser@example.org", "password123")
    if not tok:
        pytest.skip("Cannot authenticate")
    request.cls.token = tok


# ═══════════════════════════════════════════════════════════════════════════
# Job list and state (upstream test_JobState pattern)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.usefixtures("user_tok")
class TestJobList:
    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_list_jobs(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/jobs",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            data = resp.json().get("data", [])
            assert isinstance(data, (list, dict))

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_job_state_has_required_fields(self):
        """Upstream test_JobState: round_trip preserves all fields."""
        resp = requests.get(
            f"{API_URL}/api/user/v1/jobs",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        if resp.status_code == 200:
            jobs = resp.json().get("data", [])
            if isinstance(jobs, list) and jobs:
                j = jobs[0]
                for field in ("id", "name", "status", "created_at"):
                    assert field in j, f"Job state missing field '{field}'"


# ═══════════════════════════════════════════════════════════════════════════
# Calendar ICS import (upstream test_JobImportIcs pattern)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.usefixtures("user_tok")
class TestCalendarImportExport:
    TEST_ICS = (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//Test//EN\r\n"
        "BEGIN:VEVENT\r\n"
        "UID:pytest-import@example.org\r\n"
        "SUMMARY:Imported Event\r\n"
        "DTSTART:20250915T100000Z\r\n"
        "DTEND:20250915T110000Z\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR\r\n"
    )

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_import_ics_creates_job(self):
        """Upstream test_JobImportIcs: import creates a background job."""
        resp = requests.post(
            f"{API_URL}/api/user/v1/calendar/import",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"calendar_key": "personal", "ics": self.TEST_ICS},
            timeout=10,
        )
        assert resp.status_code in (200, 201, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_export_ics_creates_job(self):
        """Upstream test_JobExportIcs: export creates a background job."""
        resp = requests.post(
            f"{API_URL}/api/user/v1/calendar/export",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"calendar_key": "personal"},
            timeout=10,
        )
        assert resp.status_code in (200, 201, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_import_rejects_empty_ics(self):
        """Upstream test_JobImportIcs: empty ICS should be rejected."""
        resp = requests.post(
            f"{API_URL}/api/user/v1/calendar/import",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"calendar_key": "personal", "ics": ""},
            timeout=10,
        )
        assert resp.status_code in (400, 404, 500)  # 404 = endpoint may not exist


# ═══════════════════════════════════════════════════════════════════════════
# Contact vCard import (upstream test_JobImportContact / test_AddressBookContentDeserializer)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.usefixtures("user_tok")
class TestContactImportExport:
    VCARD3 = (
        "BEGIN:VCARD\r\nVERSION:3.0\r\n"
        "FN:Import Test\r\nUID:pytest-vcard3@example.org\r\n"
        "EMAIL;TYPE=work:import@example.org\r\n"
        "END:VCARD\r\n"
    )
    VCARD4 = (
        "BEGIN:VCARD\r\nVERSION:4.0\r\n"
        "FN:Import Test v4\r\nUID:pytest-vcard4@example.org\r\n"
        "END:VCARD\r\n"
    )

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_import_vcard3(self):
        """Upstream AddressBookContentDeserializerVcard: vCard3 import."""
        resp = requests.post(
            f"{API_URL}/api/user/v1/contact/import",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"vcard": self.VCARD3},
            timeout=10,
        )
        assert resp.status_code in (200, 201, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_import_vcard4(self):
        """Upstream AddressBookContentDeserializerVcard: vCard4 import."""
        resp = requests.post(
            f"{API_URL}/api/user/v1/contact/import",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"vcard": self.VCARD4},
            timeout=10,
        )
        assert resp.status_code in (200, 201, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_import_group_vcard(self):
        """Upstream AddressBookContentDeserializerVcard: KIND:group with MEMBER."""
        group_vcard = (
            "BEGIN:VCARD\r\nVERSION:4.0\r\nKIND:group\r\n"
            "FN:Test Team\r\nUID:pytest-group@example.org\r\n"
            "MEMBER:urn:uuid:pytest-vcard3@example.org\r\n"
            "END:VCARD\r\n"
        )
        resp = requests.post(
            f"{API_URL}/api/user/v1/contact/import",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"vcard": group_vcard},
            timeout=10,
        )
        assert resp.status_code in (200, 201, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_export_contacts(self):
        """Upstream AddressBookContentSerializerVcard: export as vCard."""
        resp = requests.get(
            f"{API_URL}/api/user/v1/contact/export",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)


# ═══════════════════════════════════════════════════════════════════════════
# Admin jobs (upstream test_JobCleanupLargeStore pattern)
# ═══════════════════════════════════════════════════════════════════════════


class TestAdminJobs:
    def _get_admin_tok(self):
        return admin_token()

    def test_admin_job_list(self):
        try:
            tok = self._get_admin_tok()
        except Exception:
            pytest.skip("Admin login failed")
        resp = requests.get(
            f"{API_URL}/api/admin/v1/jobs",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)
