# Schedule Send — Specification

> **Status:** Draft · **Priority:** Tier 1 (#13) · **Target parity:** SOGo 5 Schedule Send

---

## 1. Overview

Schedule Send allows users to compose an email now and have it delivered automatically at a future date/time. The email is queued on the server and released by a background worker when the scheduled time arrives.

### Why Schedule Send?

- **Expected UX:** Every modern mail client (Gmail, Outlook, Apple Mail) ships it.
- **Low effort:** Reuses the existing send infrastructure + Celery agent with `eta` support.
- **High gratitude:** Users rely on it for after-hours communication, birthday reminders, deadline notifications.

### Feature Parity with SOGo 5

SOGo 5 supports:
- Date + time picker in compose (datetime-local)
- Sending at a scheduled time (server-side deferred delivery)
- Visual indicator in sent folder showing "Scheduled" badge
- Ability to cancel a scheduled send before delivery (via drafts / pending folder)

This spec implements all of the above.

---

## 2. User Stories

| ID | Story |
|----|-------|
| US-1 | As a user, I can set a future date+time when composing an email and click "Schedule send" instead of "Send" |
| US-2 | As a user, I see a confirmation that my email is scheduled for delivery at the specified time |
| US-3 | As a user, I can find my scheduled emails in a "Scheduled" folder/pane |
| US-4 | As a user, I can cancel a scheduled send before it's delivered |
| US-5 | As a user, I can see a "Scheduled" badge next to the subject in the sent items |

---

## 3. API Contract

### 3.1 Send Email with `send_at`

**`POST /api/user/v1/mailboxes/{account_id}/mail/send`**

```json
{
  "from": "user@example.org",
  "to": ["recipient@example.org"],
  "subject": "Meeting Tomorrow",
  "body": "See you at 10am.",
  "send_at": "2026-08-01T14:00:00.000Z"
}
```

**Response (scheduled):**

```json
{
  "error_code": "S000000",
  "error_msg": "No Error",
  "data": {
    "status": "scheduled",
    "scheduled_at": "2026-08-01T14:00:00.000Z",
    "job_id": "uuid-abc-123"
  }
}
```

**Response (immediate, `send_at` in past or omitted):**

```json
{
  "error_code": "S000000",
  "error_msg": "No Error",
  "data": {
    "status": "sent",
    "uid": "12345"
  }
}
```

**Errors:**

| Code | Condition |
|------|-----------|
| `S000300` | Invalid `send_at` format (not ISO 8601) |
| `S000386` | Failed to schedule (agent unreachable, Redis down) |
| `S000208` | `send_at` is more than 30 days in the future (configurable limit via domain settings) |

### 3.2 Cancel Scheduled Send

**`POST /api/user/v1/mailboxes/{account_id}/mail/scheduled/{job_id}/cancel`**

```json
{
  "error_code": "S000000",
  "error_msg": "No Error",
  "data": {
    "status": "cancelled",
    "job_id": "uuid-abc-123"
  }
}
```

**Errors:**

| Code | Condition |
|------|-----------|
| `S000387` | Scheduled send not found (already sent or invalid id) |
| `S000388` | Cannot cancel — already being delivered |

### 3.3 List Scheduled Sends

**`GET /api/user/v1/mailboxes/{account_id}/mail/scheduled`**

```json
{
  "error_code": "S000000",
  "error_msg": "No Error",
  "data": [
    {
      "job_id": "uuid-abc-123",
      "subject": "Meeting Tomorrow",
      "to": [{"name": "", "email": "recipient@example.org"}],
      "scheduled_at": "2026-08-01T14:00:00.000Z",
      "created_at": "2026-07-28T10:00:00.000Z",
      "status": "pending"
    }
  ]
}
```

---

## 4. Data Model

### 4.1 `SendMailSchema` (addition)

```python
send_at = fields.String(
    required=False,
    allow_none=True,
    load_default=None,
    metadata={
        "description": "ISO 8601 datetime for scheduled delivery",
        "example": "2026-08-01T14:00:00.000Z",
    },
)
```

### 4.2 Redis (pending queue)

Prefix: `schedule_send:{user_uid}:{job_id}`

```json
{
  "account_id": "0",
  "mail_data": { "...": "..." },
  "extra_headers": null,
  "tmp_draft_key": null,
  "created_at": "2026-07-28T10:00:00.000Z"
}
```

### 4.3 Celery Job

- **Name:** `schedule_send`
- **Request:** `ScheduleSendRequest(account_id, mail_data, extra_headers, tmp_draft_key)`
- **Worker:** `ScheduleSendJob.process()` → calls `_execute_send()`
- **ETA:** `send_at` datetime (passed to `ClientAgent.enqueue(eta=send_at)`)
- **Max retries:** 3
- **Soft timeout:** 120s

### 4.4 Domain Settings (optional, for admin limits)

| Setting | Default | Description |
|---------|---------|-------------|
| `SOGO_D_SCHEDULE_SEND_ENABLED` | `true` | Feature toggle |
| `SOGO_D_SCHEDULE_SEND_MAX_DELAY_DAYS` | `30` | Maximum days in future allowed |

---

## 5. Implementation Plan

### Phase 1 — Backend (done: schema + error codes + job skeleton)
- [x] Add `send_at` field to `SendMailSchema`
- [x] Add error codes `S000386`–`S000388`
- [x] Create `ScheduleSendJob` + `ScheduleSendRequest`
- [ ] Modify `InterfaceApiMailSend.send_mail()` to handle `send_at`
- [ ] Add cancel scheduled send endpoint
- [ ] Add list scheduled sends endpoint
- [ ] Wire `ScheduleSendJob` into agent auto-discovery

### Phase 2 — Frontend
- [ ] Add date/time picker to compose view
- [ ] Add "Schedule send" button (with dropdown: "Send now" / "Schedule…")
- [ ] Show scheduled confirmation toast
- [ ] Show "Scheduled" badge in sent folder
- [ ] Add "Scheduled" filter/pane
- [ ] Add cancel action on scheduled items
- [ ] i18n for all new UI strings

### Phase 3 — Domain settings (admin)
- [ ] Add `SOGO_D_SCHEDULE_SEND_ENABLED` + `SOGO_D_SCHEDULE_SEND_MAX_DELAY_DAYS`
- [ ] Enforce limits in `send_mail()`

---

## 6. Test Pyramid

```
        ╱  E2E (Playwright)      ╲     ← 2 critical paths
       ╱   Integration (API)      ╲    ← 4 API scenarios
      ╱    Unit (backend)          ╲   ← 10 unit tests
     ╯     Unit (frontend)          ╰  ← 4 component tests
    ╱──────────────────────────────────╲
```

> **Status:** Backend unit tests ✅ (10), frontend unit tests ✅ (4),
> integration tests ❌ (0 — planned), E2E ❌ (0 — planned).

### 6.1 Unit Tests — Backend (10 tests)

| # | Test | File | What it covers |
|---|------|------|----------------|
| 1 | `send_mail_with_future_send_at_returns_scheduled` | `test_InterfaceApiMailSend.py` | `send_at` in future → agent enqueue called |
| 2 | `send_mail_with_past_send_at_sends_immediately` | `test_InterfaceApiMailSend.py` | `send_at` in past → `_execute_send` called |
| 3 | `send_mail_without_send_at_sends_immediately` | `test_InterfaceApiMailSend.py` | No `send_at` → existing behaviour unchanged |
| 4 | `send_mail_with_invalid_send_at_format` | `test_InterfaceApiMailSend.py` | Malformed ISO → 400 error |
| 5 | `send_mail_with_send_at_beyond_max_delay` | `test_InterfaceApiMailSend.py` | >30 days → 400 error |
| 6 | `ScheduleSendJob_process_calls_execute_send` | `test_ScheduleSendJob.py` | Worker invokes send correctly |
| 7 | `ScheduleSendJob_process_removes_send_at` | `test_ScheduleSendJob.py` | `send_at` stripped before forwarding |
| 8 | `cancel_scheduled_send_removes_redis_entry` | `test_InterfaceApiMailSend.py` | Cancel deletes job + clears Redis |
| 9 | `cancel_scheduled_send_already_sent` | `test_InterfaceApiMailSend.py` | Cancelling non-existent job → 404 |

### 6.2 Unit Tests — Frontend (4 tests)

| # | Test | What it covers |
|---|------|----------------|
| 1 | `ScheduleSendPicker renders date/time inputs` | Component mounts correctly |
| 2 | `ScheduleSendPicker enforces min=now` | Past dates disallowed |
| 3 | `ScheduleSendPicker max=now+30d` | Beyond-admin-limit dates disallowed |
| 4 | `ComposeFooter shows "Send now" / "Schedule…" split` | Dropdown has both options |

### 6.3 Integration Tests — API (4 scenarios) ❌ Not Yet Implemented

| # | Scenario | Steps |
|---|----------|-------|
| 1 | **Schedule an email** | `POST /mail/send` with `send_at` in future → assert 200 + `status: "scheduled"` |
| 2 | **Cancel before delivery** | Schedule → immediately cancel → assert 200 + `status: "cancelled"` |
| 3 | **List scheduled** | Schedule → `GET /mail/scheduled` → item appears in list |
| 4 | **Send immediately (no send_at)** | `POST /mail/send` without `send_at` → assert 200 + mail arrives in inbox |

### 6.4 E2E Tests — Playwright (2 critical paths) ❌ Not Yet Implemented

| # | Path | Steps |
|---|------|-------|
| 1 | **Happy path: schedule → delivery** | 1. Open compose → fill fields → set date+time → click "Schedule send" → see confirmation → wait for ETA → verify email arrives in recipient's inbox |
| 2 | **Schedule → cancel** | 1. Open compose → schedule → navigate to "Scheduled" pane → click cancel → verify cancelled → verify email NOT delivered |

---

## 7. Error Codes

```python
ERROR_MAIL_SCHEDULE_SEND_FAILED     = E("S000386", "Failed To Schedule Send For Later Delivery", HTTPStatus.INTERNAL_SERVER_ERROR)
ERROR_MAIL_SCHEDULE_NOT_FOUND        = E("S000387", "Scheduled Send Not Found Or Already Delivered", HTTPStatus.NOT_FOUND)
ERROR_MAIL_SCHEDULE_IN_DELIVERY      = E("S000388", "Scheduled Send Is Currently Being Delivered", HTTPStatus.CONFLICT)
ERROR_MAIL_SCHEDULE_MAX_DELAY        = E("S000389", "Scheduled Date Exceeds Maximum Allowed Delay", HTTPStatus.BAD_REQUEST)
```

---

## 8. Security & Constraints

| Constraint | Detail |
|------------|--------|
| **Max delay** | 30 days (configurable via `SOGO_D_SCHEDULE_SEND_MAX_DELAY_DAYS`) |
| **Min delay** | 1 minute (prevents accidental immediate-schedule confusion) |
| **Rate limit** | Max 50 scheduled sends per user (configurable) |
| **Auth** | User must be authenticated; scheduled sends are owned by the creating user |
| **Agent restart** | Jobs persisted in Redis; survive agent restart if Redis is up |
| **Redis failure** | If Redis is down, schedule send falls back to immediate send (with warning log) |

---

## 9. Open Questions

1. **Should scheduled sends appear in "Sent" folder before delivery?** → Yes, as a "pending" item with a clock icon, like Gmail.
2. **Should the tmp_draft be deleted when scheduling?** → Yes, the draft content is captured in the Redis/Celery payload.
3. **How to handle user credential changes before delivery?** → The `_execute_send` re-authenticates via IMAP at delivery time; if credentials changed, the job fails with auth error.
4. **Should there be a user preference for default send delay?** → Yes, `SOGO_U_SCHEDULE_SEND_DEFAULT` could be added later.

---

## 10. Success Criteria

- [ ] User can compose and schedule an email for a future time
- [ ] Email is delivered at (or within 60s of) the scheduled time
- [ ] User can cancel a scheduled send before delivery
- [ ] User can view all scheduled sends in a dedicated view
- [ ] All error states return appropriate HTTP codes and messages
- [x] 100% of unit tests pass (10 backend + 4 frontend) ✅
- [ ] 2 E2E Playwright tests pass (not yet implemented)
- [ ] 4 API integration tests pass (not yet implemented)
- [ ] Feature parity with SOGo 5 Schedule Send
