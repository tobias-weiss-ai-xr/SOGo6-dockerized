# SOGo6 Backend Gaps

> **Status: all gaps resolved.** This document is retained for historical
> reference. F1–F3 were implemented and have passing tests. See the test files
> linked below for verification.

| Feature ID | Feature | Endpoints | Status |
|------------|---------|-----------|--------|
| F1 | Calendar team invites | `/api/v1/calendars/teams/*/invites` | ✅ Implemented |
| F2 | Mail attachments | `/api/v1/mail/*/attachments` | ✅ Implemented |
| F3 | Contact lists / address books | `/api/v1/addressbooks/*`, `/api/v1/contacts/*` | ✅ Implemented |

## F1: Calendar Team Invites

Implemented in `app/api/v1/calendar/ApiTeamCalendar.py` and
`app/module/calendar/ModuleTeamCalendar.py`.

- `POST /calendars/teams/{team_id}/invites` — send invite
- `GET /calendars/teams/invites` — list pending invites for current user
- `GET /calendars/teams/invites/{invite_id}` — get invite
- `POST /calendars/teams/invites/{invite_id}/accept` — accept
- `POST /calendars/teams/invites/{invite_id}/reject` — reject

Tests: `tests/test_module/test_calendar/test_module_team_calendar.py`,
`tests/test_interface/test_calendar/test_ApiTeamCalendar.py`

## F2: Mail Attachments

Implemented in `app/api/v1/mail/ApiMailSend.py` and
`app/module/mail/ModuleMail.py` (`upload_attachment`).

- `POST /mail/{account}/attachments` — upload (creates tmp_draft)
- `POST /mail/{account}/{key}/attachments` — upload to existing draft
- `DELETE /mail/{account}/{key}/attachments/{filename}` — remove

Upload storage is configurable via `SOGO_UPLOAD_PATH` / `SOGO_UPLOAD_TEMP_PATH`
(initialised in `app/__init__.py: init_upload_storage()`).

Tests: `tests/test_api/test_attachments_upload.py`,
`tests/test_api/test_attachment_cleanup.py`,
`tests/test_api/test_attachments_functional.py`

## F3: Contact Lists / Address Books

Implemented in `app/api/v1/contact/ApiContact.py`,
`app/module/contact/ModuleContact.py`, and
`app/module/contact/LDAPListService.py` (hybrid SQL + LDAP backend).

- `GET /addressbooks` — list all address books (SQL + LDAP)
- `POST /addressbooks` — create
- `GET /addressbooks/{key}/contacts` — list contacts in a book
- `POST /addressbooks/{key}/contacts` — create contact
- `GET /addressbooks/{key}/lists` — list contact lists
- `POST /addressbooks/lists` — create list
- `add_member` / `remove_member` on LDAP groups and SQL books

Tests: `tests/test_api/test_addressbooks_hybrid.py`,
`tests/test_module/test_contact/test_addressbook_shares.py`,
`tests/test_module/test_contact/test_repository_addressbook.py`
