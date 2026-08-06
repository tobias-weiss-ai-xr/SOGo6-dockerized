# Undo Send — Implementation Summary

**Status**: ✅ COMPLETE (Tier 1 Core Experience feature #12)
**Spec**: `sogo6-server/.openspec/specs/mail.spec.md` (Special Features — Undo send)
**Changes**: `undo-send.change.md` + `tier1-implementation.change.md` (tracker)
**Date**: 2026-08-06

---

## 1. What Was Delivered

**Undo Send** gives users a safety net after clicking "Send": the email is held
for a configurable grace period (`SOGO_U_UNDO_SEND_SECONDS` user preference)
during which it can be recalled from the compose UI.

The backend machinery (Redis-pending + cancel endpoint) already existed but was
**incomplete**: pending emails were stored with a TTL and *never delivered* once
the window elapsed — the deferred delivery job was missing entirely. This change
closes that gap end-to-end.

### Backend (`sogo6-server`)

| Layer | File | Notes |
|---|---|---|
| Delivery job | `app/agent/jobs/UndoSendJob.py` | `UndoSendRequest` (name `undo_send`, max_try 3) + `UndoSendJob.process()`: reads `undo_send:{uid}:{pending_key}`, missing → no-op (cancelled); present → rebuilds `User` from the stored session, sends via `ModuleMailOutgoing`, saves to Sent, cleans tmp_draft, deletes the Redis entry (idempotent under at-least-once delivery). Delivery failure re-raises so the agent retries. |
| Send path | `app/interface/mail/InterfaceApiMailSend.py` | Undo branch now stores the **user session + outgoing login** in the pending payload, extends the Redis TTL past the grace period (`undo_seconds + 300`), and **enqueues `UndoSendRequest` with `eta = now + undo_seconds`** so the email is actually delivered after the window. If job enqueue fails → falls back to an immediate send (never lose the email). |
| Cancel | `POST /mailboxes/{account}/mail/pending/{key}/cancel` | Pre-existing; enforced by Redis TTL + `created_at` check. |

### Frontend (`sogo6-ui`)

| File | Notes |
|---|---|
| `store/mail-api-types.ts` | `SendMailResult` (`status: 'sent'|'scheduled'|'pending'`, `pending_key`, `undo_available_until`, …) + `CancelPendingSendArg` |
| `store/mail-api.ts` | `sendMail` now returns `BackendResponse<SendMailResult>`; new **`cancelPendingSend`** mutation → `POST mailboxes/:accountId/mail/pending/:pendingKey/cancel` with notification handler |
| `hooks/use-compose-send.ts` | On `status === 'pending'` + `pending_key`: keeps the compose window **open** and shows an "Email sent — Undo" sonner toast with a countdown (`undo_available_until`). Undo → `cancelPendingSend({accountId, pendingKey})`. All other outcomes behave as before (close draft on sent/scheduled). |
| `messages/en/notifications.json` | `mail_send.undo.*`, `mail_send.undo_cancelled.*`, `mail_send.undo_cancel_error.*` |

## 2. Verification

| Check | Result |
|---|---|
| Backend agent tests (`test_JobUndoSend.py`) | **6/6 PASS** |
| Backend interface tests (`test_InterfaceApiMailSend.py`) | **15/15 PASS** |
| Backend full suite (module+interface+agent+properties, real Redis) | **873 PASS, 0 FAIL** |
| Frontend `use-compose-send` tests | **12/12 PASS** (3 new undo-send cases) |
| Frontend mails suite | **1423 PASS** (129 suites; floating-compose mock updated) |
| Frontend `tsc --noEmit` | 458 errors — unchanged vs. baseline (no new) |

## 3. Design Notes

- **Never lose an email**: the delivery job is the single path that sends a
  pending email; if enqueueing the job fails, `send_mail` falls back to an
  immediate send. If delivery fails inside the job, the Redis entry is kept and
  the agent retries (max_try 3).
- **Idempotency**: the Redis entry is deleted right after a successful delivery,
  so a retried job (at-least-once delivery) finds nothing and skips — no double
  sends. The cancel endpoint deletes the same entry, so cancelling and a delayed
  job can't race into a double send either.
- **TTL vs. job**: the Redis TTL is `undo_seconds + 300` so a delayed worker can
  still find the entry; the *actual* undo window is enforced by the cancel
  endpoint's `created_at` check (and by the job's eta).
- **User reconstruction**: the pending payload carries the session
  (`uid/password/domain/mail/source_id`) plus `login_mail_outgoing`, and the job
  reloads the profile via `ModuleUserProfile.get_user_profile` — the same data an
  authenticated request would have.

## 4. Commits

| Repo | Commit |
|---|---|
| sogo6-server | *(to add)* — feat(undo-send): delivery job + enqueue in send_mail |
| sogo6-ui | *(to add)* — feat(undo-send): cancel endpoint hook + undo toast |
| root | *(to add)* — docs(undo-send): implementation summary + Tier 1 tracker |

## 5. Next Up (Tier 1)

Working Hours / Location (#11), Global Quick Search Cmd+K (#16), PWA (#17) —
tracked in `tier1-implementation.change.md`.
