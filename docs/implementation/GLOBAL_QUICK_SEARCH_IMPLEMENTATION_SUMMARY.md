# Global Quick Search (Cmd+K) — Implementation Summary

**Status**: ✅ COMPLETE (Tier 1 Core Experience feature #16)
**Changes**: `global-quick-search.change.md` + `tier1-implementation.change.md` (tracker)
**Date**: 2026-08-06

---

## 1. What Was Delivered

**Global Quick Search (Cmd+K)** — press `Cmd+K` / `Ctrl+K` anywhere in the app
to open a command palette that searches **contacts, calendar events and
directory users** simultaneously (mail remains available through the existing
per-account search; settings/navigation shortcuts are always listed).

The palette UI already existed with a keyboard binding and static navigation
shortcuts, but its dynamic search was a TODO stub. This change adds the
backend aggregation endpoint and wires the palette to real live results.

### Backend (`sogo6-server`)

| Layer | File | Notes |
|---|---|---|
| API | `app/api/v1/user/ApiGlobalSearch.py` | `GET /search/global?q=&limit=` (user API, registered in `user/__init__.py`). Marshmallow query schema (`q` required, `limit` 1–50 default 8). |
| Interface | `app/interface/user/InterfaceApiGlobalSearch.py` | Aggregates three sources, each isolated in its own try/except |
| Contacts | `ModuleContact.get_contacts(search=...)` | Transverse across all the user's address books, capped at 8 |
| Calendar | `ModuleCalendar.get_all_events(search=...)` | Title/description search in a 1-year rolling window (`now..now+365d`) |
| Users | `ModuleAdminUser.list_users(query=...)` | LDAP directory search (uid/cn/sn/givenName/mail), capped at 8 |

Response shape: `{ data: { contacts: [{key, addressbook_key, fullname, email}], events: [{key, calendar_key, title, date_start, date_end}], users: [{uid, cn, mail}] } }`.

### Frontend (`sogo6-ui`)

| File | Notes |
|---|---|
| `features/search/store/global-search-api.ts` | RTK `globalSearch` query (debounced at call site, `skip` until query ≥ 2 chars, 30 s cache, tag `global_search:{q}`) |
| `features/search/global-search-types.ts` | Result/arg types |
| `features/search/components/GlobalQuickSearch.tsx` | Keeps Cmd+K binding + nav group; adds debounced search, grouped results (Contacts / Calendar events / Users), spinner, empty state, per-item navigation |
| `messages/en/search.json` | `contactsHeading`, `calendarHeading`, `usersHeading`, `searching`, `untitledEvent` |
| `app/fakeApi/search/global/route.ts` | Demo route with 3 contacts/events/users |

## 2. Verification

| Check | Result |
|---|---|
| Backend interface tests (`test_InterfaceApiGlobalSearch.py`) | **4/4 PASS** |
| Backend structural tests (`test_ApiGlobalSearch.py`) | **9/9 PASS** |
| Backend full suite (module+interface+agent+properties+config, real Redis) | **892 PASS, 0 FAIL** |
| Frontend store tests (`global-search-api.test.ts`) | **6/6 PASS** |
| Frontend component tests (`GlobalQuickSearch.test.tsx`) | **4/4 PASS** |
| Frontend layout test (search store mock added) | **20/20 PASS** |
| Frontend `tsc --noEmit` | no new errors (459, unchanged) |

## 3. Design Notes

- **Section isolation**: each search source is wrapped independently — an LDAP
  outage or DB error degrades that section to empty but never fails the whole
  palette.
- **Schema-driven validation**: using a Marshmallow `Schema` (not an inline
  dict) keeps apispec happy — an inline dict breaks OpenAPI generation.
- **Debounce + skip**: the palette only fires the query once the user has typed
  ≥ 2 chars, then debounces 200 ms — no request per keystroke.
- **Fake-first**: `fakeApi/search/global` mirrors the backend shape so the UI
  works in demo mode.

## 4. Commits

| Repo | Commit |
|---|---|
| sogo6-server | *(to add)* — feat(global-search): unified /search/global endpoint |
| sogo6-ui | *(to add)* — feat(global-search): wire Cmd+K palette to live results |
| root | *(to add)* — docs(global-search): implementation summary + tracker |

## 5. Next Up (Tier 1)

PWA / Mobile Web (#17) is the last remaining Tier 1 feature — tracked in
`tier1-implementation.change.md`.
