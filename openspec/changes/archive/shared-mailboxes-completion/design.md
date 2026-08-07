# Shared Mailboxes Completion — Design

## Architecture

### Current State

```
ModuleSharedMailbox (sogo6_shared_mailboxes)
├── id, email, name, description, member_uids (JSON), is_active, created_at, updated_at
├── Admin API: CRUD + members
└── User API: list + get (basic)
```

### Target State

```
ModuleSharedMailbox (sogo6_shared_mailboxes) — EXTENDED
├── + quota_enabled, quota_max_size, quota_max_emails
├── + auto_respond_enabled, auto_respond_subject, auto_respond_message
├── + forward_to (JSON), forward_keep_copy
├── + signature_enabled, signature_html, signature_plain
├── + member_roles (JSON: [{uid, role, added_at, last_activity_at}])
└── Admin API: CRUD + members (with roles) + analytics + notes + assignments

ModuleSharedMailboxNotes (sogo6_shared_mailbox_notes) — NEW
├── id, mailbox_id, email_id, author_uid, content, is_private, mentions (JSON), created_at, updated_at
└── API: create, list, delete notes

ModuleSharedMailboxAssignment (sogo6_shared_mailbox_assignments) — NEW
├── id, mailbox_id, email_id, assigned_to, assigned_by, reason, status, notified, created_at, completed_at
└── API: create, list, update, delete assignments

ModuleSharedMailboxAnalytics (computed from existing data) — NEW
├── email_count, unread_count, active_members, response_time, trends
└── API: get analytics per mailbox
```

## Data Model

### Extended `sogo6_shared_mailboxes` Table

New columns (added via `ensure_table` migration):

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| quota_enabled | bool | false | Enable storage quota |
| quota_max_size | int | null | Max storage in MB |
| quota_max_emails | int | null | Max email count |
| auto_respond_enabled | bool | false | Enable auto-responder |
| auto_respond_subject | str | null | Auto-responder subject |
| auto_respond_message | text | null | Auto-responder body |
| forward_to | json | null | List of forwarding addresses |
| forward_keep_copy | bool | true | Keep copy when forwarding |
| signature_enabled | bool | false | Enable signature |
| signature_html | text | null | HTML signature |
| signature_plain | text | null | Plain text signature |

### Member Roles

Instead of a separate table, member roles are stored as JSON in a new
`member_roles` column:

```json
[
  {"uid": "user@example.org", "role": "admin", "added_at": "2026-01-01T00:00:00Z", "last_activity_at": null},
  {"uid": "mod@example.org", "role": "moderator", "added_at": "2026-01-01T00:00:00Z", "last_activity_at": null},
  {"uid": "member@example.org", "role": "member", "added_at": "2026-01-01T00:00:00Z", "last_activity_at": null}
]
```

Roles:
- **admin**: Can manage mailbox (add/remove members, change settings, delete)
- **moderator**: Can assign emails, manage notes, view analytics
- **member**: Can read/send emails, add personal notes

### New Table: `sogo6_shared_mailbox_notes`

| Column | Type | Description |
|--------|------|-------------|
| id | str (64) | UUID |
| mailbox_id | str (64) | FK to shared mailbox |
| email_id | str (128) | Optional: associated email UID |
| author_uid | str (256) | Author's user UID |
| content | text | Note content |
| is_private | bool | Private note (only author) |
| mentions | json | List of mentioned UIDs |
| created_at | datetime | Creation timestamp |
| updated_at | datetime | Last update timestamp |

### New Table: `sogo6_shared_mailbox_assignments`

| Column | Type | Description |
|--------|------|-------------|
| id | str (64) | UUID |
| mailbox_id | str (64) | FK to shared mailbox |
| email_id | str (128) | Email UID |
| assigned_to | str (256) | Assigned user UID |
| assigned_by | str (256) | Assigning user UID |
| reason | text | Optional reason |
| status | str (32) | pending, accepted, completed, cancelled |
| notified | bool | Whether assignee was notified |
| created_at | datetime | Creation timestamp |
| completed_at | datetime | Completion timestamp |

## API Design

### Admin API (extended)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/v1/shared-mailboxes` | List (with pagination/filtering) |
| POST | `/admin/v1/shared-mailboxes` | Create (with extended fields) |
| GET | `/admin/v1/shared-mailboxes/{id}` | Get (with extended fields) |
| PUT | `/admin/v1/shared-mailboxes/{id}` | Update (with extended fields) |
| DELETE | `/admin/v1/shared-mailboxes/{id}` | Delete |
| GET | `/admin/v1/shared-mailboxes/{id}/members` | List members (with roles) |
| POST | `/admin/v1/shared-mailboxes/{id}/members` | Add member (with role) |
| PUT | `/admin/v1/shared-mailboxes/{id}/members/{uid}` | Update member role |
| DELETE | `/admin/v1/shared-mailboxes/{id}/members/{uid}` | Remove member |
| GET | `/admin/v1/shared-mailboxes/{id}/analytics` | Get analytics |
| GET | `/admin/v1/shared-mailboxes/{id}/notes` | List notes |
| POST | `/admin/v1/shared-mailboxes/{id}/notes` | Add note |
| DELETE | `/admin/v1/shared-mailboxes/{id}/notes/{note_id}` | Delete note |
| GET | `/admin/v1/shared-mailboxes/{id}/assignments` | List assignments |
| POST | `/admin/v1/shared-mailboxes/{id}/assignments` | Create assignment |
| PUT | `/admin/v1/shared-mailboxes/{id}/assignments/{assignment_id}` | Update assignment |
| DELETE | `/admin/v1/shared-mailboxes/{id}/assignments/{assignment_id}` | Delete assignment |

### User API (extended)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user/v1/shared-mailboxes` | List accessible mailboxes (with role) |
| GET | `/user/v1/shared-mailboxes/{id}` | Get mailbox details |
| GET | `/user/v1/shared-mailboxes/{id}/activity` | Get user activity |
| GET | `/user/v1/shared-mailboxes/{id}/notes` | List notes (non-private + own) |
| POST | `/user/v1/shared-mailboxes/{id}/notes` | Add note |
| GET | `/user/v1/shared-mailboxes/{id}/assignments` | List assignments for current user |
| POST | `/user/v1/shared-mailboxes/{id}/assignments/{assignment_id}/accept` | Accept assignment |
| POST | `/user/v1/shared-mailboxes/{id}/assignments/{assignment_id}/complete` | Complete assignment |

## Permission Model

```
Admin:    Full access (all operations)
Moderator: Read, assign emails, manage notes, view analytics
Member:   Read, send, add personal notes
```

Permission checks:
- Admin API: requires admin role (existing admin auth)
- User API: checks membership and role
- Notes: private notes only visible to author
- Assignments: only assignee can accept/complete
