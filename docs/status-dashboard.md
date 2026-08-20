# SOGo6 Feature Status Dashboard

Dashboard tracking the F1–F6 feature story batch implementation status. Updated after each sprint completion.

| Last Updated | 2025-08-22 |
|-------------|------------|

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Features | 6 |
| ✅ Pass | 3 (F4, F5, F6) |
| ❌ Fail / Blocked | 3 (F1, F2, F3) |
| 🔄 In Progress | 0 |
| Overall Progress | 50% (3/6) |

**Status**: 🔴 **BLOCKED** - Backend API gaps prevent F1, F2, F3 completion. See blocking issues document [`BACKEND-GAPS.md`](../../BACKEND-GAPS.md).

---

## Feature Status Details

### F1: Invite to Event (Calendar)

| Attribute | Value |
|-----------|-------|
| ID | F1 |
| Description | User can invite attendees to calendar events; attendees receive email invitations and can RSVP |
| Status | 🔴 **BLOCKED** |
| Frontend Status | ✅ Complete |
| Backend Status | ❌ Incomplete |
| Pass/Fail | **FAIL** - API returns 500/503 |

#### Root Cause
Missing backend invitation workflow:
- No `POST /api/v1/calendars/{id}/events/{id}/invite` endpoint
- Calendar invitation email generation not implemented
- RSVP tracking storage (`CalendarAttendee` model) missing
- Legacy OGoDAV layer removed but invitation logic not ported

#### Required Actions
| Priority | Action | Owner | ETA |
|----------|--------|-------|-----|
| P0 | Implement `app/services/invitations.py` with iCalendar generation | Backend | 1d |
| P0 | Add invitation endpoints in `app/api/v1/calendars.py` | Backend | 1d |
| P0 | Create `CalendarAttendee` SQL model for RSVP tracking | Backend | 0.5d |
| P0 | Integrate SMTP email delivery for invitations | Backend | 0.5d |
| P1 | Add unit tests for invitation flow | QA | 0.5d |

#### Blocked By
- None (pure implementation gap)

#### See Also
- [BACKEND-GAPS.md - F1 Section](../../BACKEND-GAPS.md#f1-invite-to-event-calendar)

---

### F2: Send Attachment (Compose)

| Attribute | Value |
|-----------|-------|
| ID | F2 |
| Description | User can attach files to email drafts; uploaded files stored on server and included in outbound MIME messages |
| Status | 🔴 **BLOCKED** |
| Frontend Status | ✅ Complete |
| Backend Status | ❌ Incomplete |
| Pass/Fail | **FAIL** - Upload endpoint returns 500 |

#### Root Cause
Attachment upload handler misconfigured:
- Hardcoded `/tmp/sogo6/uploads/` path doesn't exist in containers
- `MAX_CONTENT_LENGTH` not configured (Flask allows upload of any size)
- Redis connection for attachment metadata not initialized
- No cleanup task for orphaned temp files

#### Required Actions
| Priority | Action | Owner | ETA |
|----------|--------|-------|-----|
| P0 | Configure `SOGO_UPLOAD_PATH` and `SOGO_UPLOAD_TEMP_PATH` in `app/config.py` | Backend | 0.5d |
| P0 | Initialize upload directories on app startup in `app/__init__.py` | Backend | 0.5d |
| P0 | Fix `POST /api/v1/attachments/upload` endpoint with proper Redis integration | Backend | 1d |
| P0 | Add MIME type validation using `python-magic` | Backend | 0.5d |
| P1 | Create `app/tasks/cleanup_attachments.py` for hourly cleanup | Backend | 0.5d |
| P1 | Add unit tests for upload/attachment endpoints | QA | 0.5d |

#### Blocked By
- Redis service must be running (`sogo6-redis` container)
- Volume mount for upload storage must be configured

#### See Also
- [BACKEND-GAPS.md - F2 Section](../../BACKEND-GAPS.md#f2-send-attachment-compose)

---

### F3: Add Contact to List

| Attribute | Value |
|-----------|-------|
| ID | F3 |
| Description | User can add existing contacts to contact lists (LDAP distribution lists); lists appear as address books |
| Status | 🔴 **BLOCKED** |
| Frontend Status | ✅ Complete |
| Backend Status | ❌ Incomplete |
| Pass/Fail | **FAIL** - `/addressbooks` returns 500 "Could not load contacts" |

#### Root Cause
Hybrid address book backend missing:
- Code assumes all address books are in PostgreSQL (`AddressBook` model)
- LDAP distribution lists (`groupOfNames`) not queried
- `AddressBookMember` SQLAlchemy model doesn't exist for LDAP groups
- No service to merge SQL + LDAP results

#### Required Actions
| Priority | Action | Owner | ETA |
|----------|--------|-------|-----|
| P0 | Create `app/services/ldap_lists.py` with `LDAPListService` | Backend | 1d |
| P0 | Update `/api/v1/addressbooks` routes to use hybrid backend | Backend | 1d |
| P0 | Add `add_member()` / `remove_member()` to LDAP client service | Backend | 0.5d |
| P0 | Implement ID resolution logic (`id_resolver.py`) to route SQL vs LDAP | Backend | 0.5d |
| P1 | Add Redis caching for LDAP group queries (5min TTL) | Backend | 0.5d |
| P1 | Add unit tests for address book and member management | QA | 0.5d |

#### Blocked By
- None (implementation gap) - OpenLDAP server is running correctly

#### See Also
- [BACKEND-GAPS.md - F3 Section](../../BACKEND-GAPS.md#f3-add-contact-to-list)

---

### F4: Open Email in New Window

| Attribute | Value |
|-----------|-------|
| ID | F4 |
| Description | User can open email messages in a new browser tab/window without navigating away from mailbox view |
| Status | ✅ **PASS** |
| Frontend Status | ✅ Complete |
| Backend Status | ✅ Complete |
| Pass/Fail | **PASS** |

#### Implementation Summary
- Frontend: Added "Open in new window" button in email toolbar; routes to `/mailbox/[account]/[folder]/[message]` page
- Backend: Existing `GET /api/v1/mail/{message_id}` endpoint serves message data
- UX: Window title updates with email subject; keyboard shortcut (`Ctrl+Shift+O`) added

#### Test Results
| Test Suite | Result |
|------------|--------|
| Playwright E2E (`open-email-new-window.spec.ts`) | ✅ 3/3 pass |
| Jest Unit (`email-toolbar.test.tsx`) | ✅ 5/5 pass |

#### Notes
No blocking issues. Feature is production-ready.

---

### F5: Threaded Email View

| Attribute | Value |
|-----------|-------|
| ID | F5 |
| Description | Email conversations displayed as threaded views; users can collapse/expand threads; visual indicators for unread count |
| Status | ✅ **PASS** |
| Frontend Status | ✅ Complete |
| Backend Status | ✅ Complete |
| Pass/Fail | **PASS** |

#### Implementation Summary
- Frontend: Added `ThreadedEmailList` component; collapsible thread groups; read/unread indicators per thread
- Backend: Enhanced `GET /api/v1/mailbox/{folder_id}/messages` to include `thread_id` and `thread_parent_id` fields
- UX: Toggle switch for "View Conversations" (threaded vs flat); persists in user preferences

#### Test Results
| Test Suite | Result |
|------------|--------|
| Playwright E2E (`threaded-email-view.spec.ts`) | ✅ 4/4 pass |
| Jest Unit (`threaded-email-list.test.tsx`) | ✅ 6/6 pass |

#### Notes
No blocking issues. Feature is production-ready.

---

### F6: Quick Filters (Mailbox)

| Attribute | Value |
|-----------|-------|
| ID | F6 |
| Description | Pre-defined filters to quickly show unread, starred, attachments, or flagged emails in mailbox |
| Status | ✅ **PASS** |
| Frontend Status | ✅ Complete |
| Backend Status | ✅ Complete |
| Pass/Fail | **PASS** |

#### Implementation Summary
- Frontend: Added filter chips above mailbox list; active filter state in Redux; URL params (`?filter=unread`)
- Backend: Added `filter` query param support to `GET /api/v1/mailbox/{folder_id}/messages`
- UX: Keyboard shortcuts (`1`=All, `2`=Unread, `3`=Starred, `4`=Attachments, `5`=Flagged)

#### Test Results
| Test Suite | Result |
|------------|--------|
| Playwright E2E (`quick-filters.spec.ts`) | ✅ 5/5 pass |
| Jest Unit (`quick-filters.test.tsx`) | ✅ 4/4 pass |

#### Notes
No blocking issues. Feature is production-ready.

---

## Blocking Issues Summary

All blocked features (F1, F2, F3) are blocked by **backend implementation gaps**, not external dependencies:

| Feature | Primary Blocker | Type | Est. Completion |
|---------|----------------|------|-----------------|
| F1 | Missing invitation endpoints + RSVP tracking | Implementation | 3 days |
| F2 | Upload storage misconfiguration + Redis integration | Implementation | 2 days |
| F3 | Hybrid SQL+LDAP address book service missing | Implementation | 2 days |

**Total backend work estimated:** 7 days development + 1.5 days testing

---

## Progress Timeline

```
Week 1: [████████████████████████████████████] 100% - F4, F5, F6 completed
Week 2: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   0% - F1, F2, F3 blocked
Week 3: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   0% - Pending
```

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Stalwart Mail Server | ✅ Running | SMTP/IMAP available |
| PostgreSQL | ✅ Running | Database models complete |
| Redis | ✅ Running | Caching/queues available |
| OpenLDAP | ✅ Running | Directory service healthy |
| sogo6-ui (Frontend) | ✅ Passes tests | All F1-F6 UI components complete |
| sogo6-server (Backend) | ⚠️ Partial | Missing F1-F3 endpoints |

---

## Next Steps

1. **Immediate (This Sprint)**
   - [ ] Prioritize F1 (calendar invitations) - highest user impact
   - [ ] Begin F2 implementation (attachments) - medium complexity

2. **Upcoming (Next Sprint)**
   - [ ] Complete F3 (contact lists) - LDAP integration complexity
   - [ ] Integration testing for F1-F3
   - [ ] E2E Playwright tests for all features

3. **Future**
   - [ ] Consider UX polish for threaded view (F5) - nicer animations
   - [ ] Add email attachment preview (depends on F2 completion)
   - [ ] Calendar event RSVP reminders (depends on F1 completion)

---

## Related Documents

- **[BACKEND-GAPS.md](../BACKEND-GAPS.md)** - Detailed root cause analysis and implementation plans for F1-F3
- **[docs/specs/schedule-send.md](./schedule-send.md)** - Feature spec for scheduled emails
- **[docs/reports/SOGO6-EVALUATION.md](./reports/SOGO6-EVALUATION.md)** - Overall project evaluation
- **[docs/development/DEVELOPMENT.md](./development/DEVELOPMENT.md)** - Development setup guide

---

**Dashboard Version**: 1.0
**Last Modified**: 2025-08-22
**Maintained By**: SOGo6 Development Team
