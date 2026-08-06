# Team Calendars — Implementation Summary

**Status**: ✅ COMPLETE (Tier 0 feature 6/9)
**Spec**: `sogo6-server/.openspec/specs/team-calendars.spec.md`
**Change**: `sogo6-server/.openspec/changes/team-calendars.change.md`
**Date**: 2025-08-21

---

## 1. What Was Delivered

Team Calendars gives users the ability to create shared team calendars, manage
membership, and control access through the existing calendar share/ACL model —
extended with a first-class **team calendar** source type and an **invitation
lifecycle** for joining teams.

### Backend (`sogo6-server`)

| Layer | Files | Notes |
|---|---|---|
| Enum | `app/module/calendar/model/enums/CalendarSourceType.py` | Added `TEAM` |
| Model | `app/module/calendar/model/CalendarInvite.py` | Invite entity (status: pending/accepted/rejected/cancelled) |
| Repository | `app/module/calendar/repository/RepositoryCalendarInvite.py` | DB access for invites |
| Module | `app/module/calendar/ModuleTeamCalendar.py` | Business logic: team CRUD, membership via shares, invite lifecycle |
| Interface | `app/interface/calendar/InterfaceApiTeamCalendar.py` | Auth-aware pass-through layer |
| API | `app/api/v1/calendar/ApiTeamCalendar.py` | 14 endpoints (blueprint registered in `app/api/v1/calendar/__init__.py`) |
| Schemas | `app/api/v1/calendar/schemas/team_calendar.py` | Marshmallow payloads + examples |
| DB | `sogo6_calendar_invites` table | Registered in `ProcessSetting.SOGO_P_TABLE_CALENDAR_INVITES` + `app/config/db/tables.py` |
| Errors | `app/utils/errors.py` | `S000631`–`S000635` (invite not found, invite already exists, invalid status, not a team, member not found) |

**Endpoints (14):**

| Method | Path | Description |
|---|---|---|
| GET | `/calendars/teams` | List team calendars |
| POST | `/calendars/teams` | Create team calendar |
| GET | `/calendars/teams/{id}` | Get team calendar detail |
| PATCH | `/calendars/teams/{id}` | Update team calendar |
| DELETE | `/calendars/teams/{id}` | Delete team calendar |
| GET | `/calendars/teams/{id}/members` | List members |
| POST | `/calendars/teams/{id}/members` | Add member |
| PATCH | `/calendars/teams/{id}/members/{memberId}` | Update member share level |
| DELETE | `/calendars/teams/{id}/members/{memberId}` | Remove member |
| POST | `/calendars/teams/invites` | Send invitation |
| GET | `/calendars/teams/invites` | List pending invites |
| GET | `/calendars/teams/invites/{inviteId}` | Get invite detail |
| POST | `/calendars/teams/invites/{inviteId}/accept` | Accept invite |
| POST | `/calendars/teams/invites/{inviteId}/reject` | Reject invite |
| DELETE | `/calendars/teams/invites/{inviteId}` | Cancel invite |

### Frontend (`sogo6-ui`)

| File | Purpose |
|---|---|
| `src/features/team-calendars/store/team-calendars-api.ts` | RTK Query store — 15 hooks (CRUD, members, invites) with tags `team_calendars`, `team_calendar_members`, `team_calendar_invites` |
| `src/features/team-calendars/team-calendars-types.ts` | `TeamCalendar`, `TeamCalendarMember`, `TeamCalendarInvite`, request/response bodies |
| `src/app/[locale]/(loggedin)/calendars/team/page.tsx` | Team calendar management page: list, create, edit, delete; member panel; invite panel with accept/reject |
| `src/features/team-calendars/__tests__/team-calendars-api.test.ts` | 22 Jest tests — endpoint query builders, provides/invalidates tags, exported hooks |

## 2. Verification

| Check | Result |
|---|---|
| Backend `test_module` Team Calendar suite | 15/15 PASS (stub repos) |
| Backend `test_interface` Team Calendar suite | 21/21 PASS (structural) |
| Backend full suite (`test_module` + `test_interface`) | **672 PASS** (2 Redis-env-only skips) |
| CI property tests (`tests/test_properties/`) | 4/4 PASS |
| Frontend Jest (team-calendars + filters + resources) | 173/173 PASS |
| Frontend `tsc --noEmit` (new files) | 0 errors in team-calendars files |
| `py_compile` all new backend files | PASS |

## 3. Critical Latent Defects Fixed (discovered while enabling the test suite)

To run the backend test suite locally for the first time, several latent bugs
had to be fixed. These are unrelated to Team Calendars but blocked **every**
backend import:

1. **Duplicate error codes** — `app/utils/errors.py` contained colliding codes
   (`S000318`, `S000371`, `S000380`–`S000386`). Flask-Smorest crashed at import
   because error codes must be unique. Renumbered (e.g. `ERROR_FILTER_NOT_FOUND`
   → `S000637`, `ERROR_TMP_DRAFT_LOCKED` → `S000636`).
2. **ModuleWebAuthn** — used the removed webauthn 0.x API (`WebAuthn`,
   `PublicKeyCredential`, `User` classes, `webauthn_base64url_to_bytes`,
   `verify_authentication_response` signature). Migrated to webauthn 3.x
   (`verify_authentication_response` with `AuthenticationCredential`).
3. **Missing modules** — `app/orm.py` (PydanticBaseModel) and
   `app/utils/db/UtlocationDatabase.py` were referenced but never created.
4. **ApiSharedMailboxes** — used a non-existent `@requires_auth` decorator and
   `g.current_user`; switched to the app's `g.user` auth model.
5. **ApiWebAuthn** — removed `@blp.login_required` / `roles_required` (no longer
   in the Blueprint auth API) in favor of local `login_required`/`admin_required`.
6. **ModuleMail.purge_folder_mails** — `%d` format against string folder path.
7. **ModuleSnooze** — `AndCondition` constructed with a list + datetime/str handling.
8. **ModuleResourceBooking** — `ERROR_VALIDATION_FAILED` alias missing.
9. **FilterReorderPayloadSchema.example()** — referenced non-existent fields.
10. **ApiMailFilter** — duplicate `Dict`/`String` schema definition entries.

**Environment**: tests now runnable locally with Python 3.13 (uv) + env vars
(`SOGO_P_REDIS_URL`, `SOGO_P_VOUCHER_SECRET` 32 chars, `SOGO_AES_ENC_KEY`
32 chars).

## 4. Files Changed

### sogo6-server
- `app/module/calendar/model/enums/CalendarSourceType.py`
- `app/module/calendar/model/CalendarInvite.py` (new)
- `app/module/calendar/repository/RepositoryCalendarInvite.py` (new)
- `app/module/calendar/ModuleTeamCalendar.py` (new)
- `app/interface/calendar/InterfaceApiTeamCalendar.py` (new)
- `app/api/v1/calendar/ApiTeamCalendar.py` (new)
- `app/api/v1/calendar/schemas/team_calendar.py` (new)
- `app/api/v1/calendar/__init__.py`
- `app/config/settings/ProcessSetting.py`
- `app/config/db/tables.py`
- `app/utils/errors.py`
- `app/orm.py` (new)
- `app/utils/db/UtlocationDatabase.py` (new)
- `app/module/auth/ModuleWebAuthn.py`
- `app/api/v1/user/ApiSharedMailboxes.py`
- `app/api/v1/user/ApiWebAuthn.py`
- `app/module/mail/ModuleMail.py`
- `app/module/mail/ModuleSnooze.py`
- `app/module/calendar/ModuleResourceBooking.py`
- `app/api/v1/mail/ApiMailFilter.py`
- `app/api/v1/mail/schemas/filter.py`
- `tests/test_module/test_calendar/test_module_team_calendar.py` (new)
- `tests/test_interface/test_calendar/test_ApiTeamCalendar.py` (new)
- `.openspec/changes/team-calendars.change.md` → COMPLETE
- `.openspec/changes/tier0-implementation.change.md` → 100% (6/9)

### sogo6-ui
- `src/features/team-calendars/store/team-calendars-api.ts` (new)
- `src/features/team-calendars/team-calendars-types.ts` (new)
- `src/features/team-calendars/__tests__/team-calendars-api.test.ts` (new)
- `src/app/[locale]/(loggedin)/calendars/team/page.tsx` (new)
- `src/features/admin-panel/store/admin-panel-api.ts` (fix: invalid `builder.query(a,b)(c)` syntax on `listSharedMailboxes`)

## 5. Commits

| Repo | Commit | Message |
|---|---|---|
| sogo6-server | `eb78a21` | feat(team-calendars): Complete Team Calendars backend + fix latent import blockers |
| sogo6-ui | `a53e96f` | feat(team-calendars): Team Calendar management UI + RTK API store |

## 6. Next Steps (Tier 0 remaining: 3/9)

1. **DKIM/DMARC/SPF** — DnsWizard backend + `/dns/*` routes exist; spec requires
   `/admin/v1/email-auth/*` (25 endpoints). Medium gap, self-contained.
2. **CalDAV** — client-side CalDAV sync support (contacts CalDAV patterns exist).
3. **CalDAV Server** — most complex; full server-side CalDAV endpoint.
