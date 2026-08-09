# Working Hours / Location — Implementation Summary

**Status**: ✅ COMPLETE (Tier 1 Core Experience feature #11)
**Spec**: `sogo6-server/.openspec/specs/calendar.spec.md` (Working hours, Free/Busy)
**Changes**: `working-hours-location.change.md` + `tier1-implementation.change.md` (tracker)
**Date**: 2026-08-06

---

## 1. What Was Delivered

**Working Hours / Location** gives every user control over their working
schedule — workday start/end, which weekdays are non-working, whether to show
as busy during off-hours, and a default meeting location pre-filled when
creating events. These preferences feed the free/busy computation so other
users' scheduling views respect each user's availability.

The backend already defined and honored the working-hours preferences
(`SOGO_U_WORKDAY_START_TIME/END_TIME`, `SOGO_U_BUSY_OFF_HOURS`,
`SOGO_U_NON_WORKING_WEEKDAYS`) through `FreeBusyPrefs` in `FreeBusyEngine`.
This change added the **default meeting location** preference and exposed all
four working-hours controls in the Calendar → General settings UI.

### Backend (`sogo6-server`)

| Layer | File | Notes |
|---|---|---|
| Preference schema | `app/config/settings/UserSettings.py` | Added `SOGO_U_DEFAULT_LOCATION` (String, default "") to `UserCalendarGeneralSettings`; auto-exposed by the preferences API |
| Free/busy | `app/module/calendar/freebusy/FreeBusyEngine.py` | Pre-existing — `FreeBusyPrefs(busy_off_hours, workday_start, workday_end, timezone, non_working_weekdays)` already produces UNAVAILABLE periods outside working hours / on non-working days |
| Tests | `tests/test_config/test_UserCalendarGeneralSettings.py` | 6 tests: defaults, load, non-working weekdays, default location, dump round-trip, invalid weekday rejection |

### Frontend (`sogo6-ui`)

| File | Notes |
|---|---|
| `features/user-settings/calendar/general/components/calendar-general-form-core.tsx` | New `nonWorkingWeekdays` MultiSelect + `defaultLocation` text input |
| `features/user-settings/calendar/general/components/calendar-general-schema.tsx` | zod: `nonWorkingWeekdays` (0..6 array) + `defaultLocation` (string) |
| `features/user-settings/store/user-preferences-api-types.ts` | `UserCalendarGeneral` gains `SOGO_U_NON_WORKING_WEEKDAYS` + `SOGO_U_DEFAULT_LOCATION` |
| `features/user-settings/store/user-preferences-types.ts` | `CalendarGeneralSettings` form type gains both fields |
| `features/user-settings/calendar/store/calendar-utils.tsx` | Mapping both directions (`calendarGeneralToApi` / `apiToCalendarGeneral`) |
| `app/fakeApi/{preferences,profile}/route.ts` | Demo data includes the new fields |
| `messages/en/user-settings/calendars.json` | `nonWorkingWeekdays.*` + `defaultLocation.*` strings |

## 2. Verification

| Check | Result |
|---|---|
| Backend config tests (`test_UserCalendarGeneralSettings.py`) | **6/6 PASS** |
| Backend full suite (module+interface+agent+properties+config, real Redis) | **879 PASS, 0 FAIL** |
| Frontend calendar + user-settings + fakeApi suites | **1566 PASS** (144 suites) |
| Frontend `tsc --noEmit` | unchanged vs. baseline (only pre-existing errors) |

## 3. Design Notes

- **Schema-driven API**: the preferences endpoints serialize
  `UserCalendarGeneralSettings` directly, so the new field is immediately
  readable/writable without new routes — a pure schema addition.
- **Reuse**: `nonWorkingWeekdays` reuses the existing day-of-week MultiSelect
  (same options/labels as `calendarDaysShowed`), values 0=Sunday..6=Saturday.
- **Consistent defaults**: backend `[5, 6]` (weekend) matches the frontend
  fallback `[5, 6]` and the pre-existing `DEFAULT_WORKING_DAYS` used by the
  timeline free/busy views.
- **Backward compatible**: all new fields have safe defaults ("" / [5, 6]), so
  existing stored preferences without them still load.

## 4. Commits

| Repo | Commit |
|---|---|
| sogo6-server | *(to add)* — feat(working-hours): default location pref + config tests |
| sogo6-ui | *(to add)* — feat(working-hours): non-working days + default location settings |
| root | *(to add)* — docs(working-hours): implementation summary + tracker |

## 5. Next Up (Tier 1)

Global Quick Search Cmd+K (#16), PWA (#17) — tracked in
`tier1-implementation.change.md`.
