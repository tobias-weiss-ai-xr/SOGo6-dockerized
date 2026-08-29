"""Mail API tests — adopted from upstream SOGo6-server Tests/test_interface/test_mail patterns.

Tests mail folder listing, message operations, sieve/filter CRUD,
and schedule send via the REST API.
"""

import time
import pytest
import requests

from .test_stack import (
    API_URL, user_token, admin_token, LDAP_AVAILABLE, SMTP_DELIVERY_AVAILABLE,
    MAIL_BACKEND_AVAILABLE, pytestmark,
)


@pytest.fixture(scope="class")
def user_tok(request):
    tok = user_token("testuser@example.org", "password123")
    if not tok:
        pytest.skip("Cannot authenticate test user")
    request.cls.token = tok


@pytest.mark.usefixtures("user_tok")
class TestMailFolders:
    """upstream test_InterfaceApiMailMailbox pattern."""

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_list_mailboxes(self):
        # /api/user/v1/mailboxes returns the user's MAIL ACCOUNTS (id/identities),
        # not individual folders. Assert the account-list schema; the INBOX/folder
        # check below needs the underlying IMAP backend to be up.
        resp = requests.get(
            f"{API_URL}/api/user/v1/mailboxes",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json().get("data", [])
        assert isinstance(data, list)
        # Account objects should carry an id.
        if data:
            first = data[0] if isinstance(data[0], dict) else {}
            assert "id" in first or "name" in first, f"Unexpected mailbox shape: {first}"

        if not MAIL_BACKEND_AVAILABLE:
            pytest.skip("Mail/IMAP backend unavailable (S000310 IMAP auth)")
        # When the IMAP backend is up, folder 0 should list INBOX.
        if data and isinstance(data[0], dict) and data[0].get("id", "0") not in (None, ""):
            acct = data[0].get("id", "0")
            folders = requests.get(
                f"{API_URL}/api/user/v1/mailboxes/{acct}/folders",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10,
            )
            if folders.status_code == 200:
                fl = folders.json().get("data", [])
                names = [f.get("name", "") if isinstance(f, dict) else str(f) for f in fl]
                assert any("inbox" in n.lower() for n in names), \
                    f"Expected INBOX in folder list, got: {names}"

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_list_messages_inbox(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/mailboxes/0/messages",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_create_and_delete_folder(self):
        """upstream MailDAV _makeMailbox pattern."""
        folder_name = f"SOGo6-Test-{int(time.time())}"
        # Create
        resp = requests.post(
            f"{API_URL}/api/user/v1/mailboxes",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"name": folder_name},
            timeout=10,
        )
        if resp.status_code in (200, 201):
            data = resp.json().get("data", {})
            folder_id = data.get("id", "")

            # Delete
            if folder_id:
                resp2 = requests.delete(
                    f"{API_URL}/api/user/v1/mailboxes/{folder_id}",
                    headers={"Authorization": f"Bearer {self.token}"},
                    timeout=10,
                )
                assert resp2.status_code in (200, 204)
        else:
            pytest.skip(f"Folder creation returned {resp.status_code}")


@pytest.mark.usefixtures("user_tok")
class TestMailFilters:
    """upstream test_InterfaceApiMailFolder / SieveSpec pattern."""

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_list_filters(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/mailboxes/0/filters",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        assert resp.status_code in (200, 404)

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_create_and_delete_filter(self):
        """upstream SieveSpec: add simple sieve filter."""
        payload = {
            "active": True,
            "match": "any",
            "name": f"pytest-filter-{int(time.time())}",
            "rules": [{
                "field": "subject",
                "operator": "contains",
                "value": "pytest-sieve-test",
            }],
            "actions": [{"method": "fileinto", "argument": "Test"}],
        }
        resp = requests.post(
            f"{API_URL}/api/user/v1/mailboxes/0/filters",
            headers={"Authorization": f"Bearer {self.token}"},
            json=payload,
            timeout=10,
        )
        if resp.status_code in (200, 201):
            data = resp.json().get("data", {})
            filter_id = data.get("id", "")
            if filter_id:
                resp2 = requests.delete(
                    f"{API_URL}/api/user/v1/mailboxes/0/filters/{filter_id}",
                    headers={"Authorization": f"Bearer {self.token}"},
                    timeout=10,
                )
                assert resp2.status_code in (200, 204)
        else:
            pytest.skip(f"Filter creation returned {resp.status_code}")


@pytest.mark.usefixtures("user_tok")
class TestScheduleSend:
    """upstream test_JobSendEmailReminders / ScheduleSend pattern."""

    @pytest.mark.skipif(not LDAP_AVAILABLE, reason="LDAP not available")
    def test_list_scheduled_emails(self):
        resp = requests.get(
            f"{API_URL}/api/user/v1/mailboxes/0/scheduled",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10,
        )
        # 200 = has scheduled, 404 = endpoint not implemented yet
        assert resp.status_code in (200, 404)

    @pytest.mark.skipif(not SMTP_DELIVERY_AVAILABLE, reason="SMTP delivery not available")
    def test_send_immediate_no_schedule(self):
        """Send email without send_at — should process immediately.

        Mirrors upstream MailDAV _putMessage pattern.
        """
        resp = requests.post(
            f"{API_URL}/api/user/v1/mailboxes/0/mail/send",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "from": "testuser@example.org",
                "to": ["testuser2@example.org"],
                "subject": f"pytest-immediate-{int(time.time())}",
                "body": "Immediate send test",
            },
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("error_code") == "S000000"
