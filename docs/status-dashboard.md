# SOGo6 Feature Status Dashboard

| Last Updated | 2026-10-03 |
|-------------|------------|

All six feature stories (F1–F6) are implemented with passing tests.

| Feature | Status | Tests |
|---------|--------|------|
| F1: Calendar team invites | ✅ | `test_module_team_calendar.py`, `test_ApiTeamCalendar.py` |
| F2: Mail attachments | ✅ | `test_attachments_upload.py`, `test_attachment_cleanup.py`, `test_attachments_functional.py` |
| F3: Contact lists / address books | ✅ | `test_addressbooks_hybrid.py`, `test_addressbook_shares.py`, `test_repository_addressbook.py` |
| F4: Open email in new window | ✅ | UI component tests |
| F5: Threaded email view | ✅ | UI component tests |
| F6: Quick filters | ✅ | UI component tests |

Backend gaps documented in [`BACKEND-GAPS.md`](../../BACKEND-GAPS.md) are
resolved. See that file for endpoint and module references.
