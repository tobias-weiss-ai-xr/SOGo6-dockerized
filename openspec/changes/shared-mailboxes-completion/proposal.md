# Shared Mailboxes Completion

## Change Metadata

| Field | Value |
|-------|-------|
| **Change ID** | shared-mailboxes-completion |
| **Title** | Complete Shared Mailboxes Feature (45% → 100%) |
| **Status** | In Progress |
| **Priority** | High |
| **Type** | Feature Completion |
| **Created** | 2026-08-07 |
| **Spec** | sogo6-server/.openspec/specs/shared-mailboxes.spec.md |

## Problem

The shared mailboxes feature is at 45% spec compliance. The admin API and
basic CRUD exist, but the spec requires:

1. **Extended data model** — quota, auto-responder, forwarding, signatures
2. **Member roles** — member, moderator, admin (currently all users are "member")
3. **User API** — emails list, email assignment, internal notes, activity
4. **Analytics** — mailbox statistics (email count, response time, trends)
5. **Internal notes** — per-email and per-mailbox notes
6. **Email assignment** — assign emails to team members
7. **Admin UI** — extended fields, analytics dashboard
8. **User UI** — mailbox switcher, shared mailbox view

## Solution

Extend the existing `ModuleSharedMailbox` with new fields and create three
new modules:

- `ModuleSharedMailboxNotes` — internal notes system (per-email and per-mailbox)
- `ModuleSharedMailboxAssignment` — email assignment tracking
- `ModuleSharedMailboxAnalytics` — mailbox usage statistics

Extend both admin API (`ApiSharedMailbox`) and user API (`ApiSharedMailboxes`)
with new endpoints for notes, assignments, analytics, and extended fields.

## Scope

### In Scope

- Extended shared mailbox data model (quota, auto-responder, forwarding, signatures)
- Member roles (member, moderator, admin) with permission checks
- Internal notes system (per-email and per-mailbox)
- Email assignment system
- Analytics (email count, active members, response time, trends)
- User API endpoints (emails, notes, assignments, activity)
- Admin API endpoints (analytics, notes, assignments, bulk operations)
- Admin UI updates (extended fields, analytics, notes, assignments)
- Error codes for all new features

### Out of Scope

- IMAP access for shared mailboxes (Low priority — Phase 5)
- Webhook notifications for shared mailbox events (Low priority — Phase 5)
- User UI mailbox switcher (separate frontend task)
- Auto-responder email sending (configuration only — Stalwart handles sending)
