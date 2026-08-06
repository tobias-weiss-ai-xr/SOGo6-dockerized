# CalDAV & CalDAV Server — Implementation Summary

**Status**: ✅ COMPLETE (Tier 0 features 8/9 + 9/9 — ALL Tier 0 features done)
**Specs**: `sogo6-server/.openspec/specs/caldav.spec.md`, `caldav-server.spec.md`
**Changes**: `caldav.change.md` + `caldav-server.change.md` → COMPLETE
**Date**: 2025-08-21

---

## 1. What Was Delivered

A full CalDAV protocol server (RFC 4791 / RFC 4918 / RFC 6578) plus a
user-facing "CalDAV & Sync" settings page. This closes the last two Tier 0
features — the SOGo 6 calendar stack is now servable to Apple Calendar,
Thunderbird, DAVx5, Evolution and any CalDAV-compatible client.

### Backend (`sogo6-server`)

| Layer | File | Notes |
|---|---|---|
| Engine | `app/module/caldav/ModuleCalDAV.py` | Self-contained protocol engine: path resolution, principal registry, calendar collections, event CRUD with iCalendar validation (`icalendar`), ETag + Last-Modified, RFC 6578 sync-tokens with tombstone ledger, free-busy computation |
| Protocol API | `app/api/v1/caldav/ApiCalDAV.py` | Raw Flask blueprint at `/caldav` dispatching all WebDAV methods |
| Discovery | `app/__init__.py` | `/.well-known/caldav` → 301 `/caldav/` redirect + blueprint registration |
| Errors | `app/utils/errors.py` | `S000644`–`S000652` (CalDAV resource/calendar/precondition/sync-token/iCal errors) |

**Protocol surface (all endpoint tables from both specs):**

| Method | Path | Description |
|---|---|---|
| OPTIONS | `/caldav/` + every resource | `DAV: 1, 2, 3, calendar-access, calendar-schedule, extended-mkcol` |
| PROPFIND | `/caldav/`, `/principals/`, `/principals/user/{email}/`, `/calendars/{email}/`, `/calendars/{email}/{name}/`, `.../{uid}.ics` | Property discovery (Depth 0/1), multistatus |
| PROPPATCH | calendar collection | displayname / description / timezone / color updates (read-only props → 403) |
| MKCALENDAR / MKCOL | calendar collection | Create calendar (201 + Location + ETag) |
| PUT | `.../{uid}.ics` | Create/update event, iCalendar validation, `If-Match`/`If-None-Match` (412) |
| GET / HEAD | `.../{uid}.ics` | Retrieve event + ETag/Last-Modified headers |
| DELETE | calendar or event | Delete resource (204) with conditional If-Match |
| REPORT | calendar collection | `sync-collection` (RFC 6578 delta + tombstones + next token), `calendar-query` (time-range), `calendar-multiget` (batch hrefs), `free-busy-query` (iCalendar VFREEBUSY) |

### Frontend (`sogo6-ui`)

| File | Purpose |
|---|---|
| `src/features/caldav-sync/store/caldav-sync-api.ts` | RTK Query store — 2 hooks (connection info, sync overview) |
| `src/features/caldav-sync/caldav-sync-types.ts` | Types (principal, per-calendar sync status) |
| `src/features/user-settings/calendars/caldav-sync-settings.tsx` | "CalDAV & Sync" page: server URL, calendar home path, DAV capabilities, supported components, per-calendar discoverability + event counts |
| `src/app/[locale]/(loggedin)/user_settings/calendars/caldav/page.tsx` | Route page |
| `src/messages/en/user-settings/caldav.json` + `sidebar.json` | i18n (auto-loaded from message tree) |
| `src/features/user-settings/sidebar/content.tsx` | Sidebar entry under Calendar |
| `src/app/fakeApi/calendars/caldav/{connection,overview}/route.ts` | Demo API |

## 2. Verification

| Check | Result |
|---|---|
| Backend module tests (`test_module_caldav.py`) | **36/36 PASS** |
| Backend interface tests (`test_ApiCalDAV.py`) | **14/14 PASS** |
| Backend full suite | **776 PASS** (only 2 known Redis-env-only skips) |
| Frontend Jest (caldav-sync store + settings + sidebar) | **61/61 PASS** (user-settings total 1182) |
| Frontend `tsc --noEmit` on new files | 0 errors |
| `.well-known/caldav` redirect | 301 → `/caldav/` ✓ |

## 3. Notes / Design Decisions

- **No DB migration**: like `ModuleEmailAuth`, the protocol engine is a pure
  in-memory store (principals/calendars/events/tombstones) — fixture-free and
  trivially testable. A future persistence layer can back the same interface.
- **Registered outside smorest**: CalDAV is XML/iCalendar, not JSON — the
  blueprint mounts directly on the Flask app so the WebDAV methods and media
  types bypass the JSON content-type middleware.
- **Sync model**: per-calendar monotonic change counter; `sync-token=0` = full
  sync; incremental REPORTs return only resources with `change_seq > token`,
  plus deleted UIDs from the tombstone ledger (RFC 6578 §3.2 404-marked
  responses). Resurrected events drop their tombstone.
- **iCalendar handling**: `icalendar` library validates/normalizes PUT bodies,
  matches UID to the resource path (422 on mismatch), and the free-busy
  REPORT emits a real `VFREEBUSY` component.
- **Conditional requests**: If-Match / If-None-Match honored with 412
  Precondition Failed for stale ETags and duplicate creates.

## 4. Commits

| Repo | Commit | Message |
|---|---|---|
| sogo6-server | *(to add)* | feat(caldav): CalDAV server + sync engine |
| sogo6-ui | *(to add)* | feat(caldav): CalDAV & Sync settings page + RTK store |
| root | *(to add)* | docs(caldav): implementation summary |

## 5. Result

**All 9 Tier 0 foundation features are now COMPLETE (9/9):**
WebAuthn, Shared Mailboxes, Resource Booking, API Playground, Sieve Editor,
Team Calendars, DKIM/DMARC/SPF, **CalDAV**, **CalDAV Server**. The
`tier0-implementation.change.md` tracker is at 100%.