## ADDED Requirements

### Requirement: Shared mailbox extended data model

The system SHALL support extended configuration fields for shared mailboxes: storage quota (enabled flag, max size in MB, max email count), an auto-responder (enabled flag, subject, message), email forwarding (list of destination addresses, keep-copy flag), and signatures (enabled flag, HTML and plain-text variants). Each mailbox SHALL also track a `member_roles` JSON structure mapping member UIDs to roles (`admin`, `moderator`, `member`) with `added_at` and `last_activity_at` timestamps. Existing mailbox tables SHALL be migrated automatically by adding the missing columns.

#### Scenario: Create shared mailbox with quota and auto-responder

- **WHEN** an admin creates a shared mailbox with `quota_enabled=true`, `quota_max_size=1024`, `quota_max_emails=10000`, `auto_respond_enabled=true`, and `auto_respond_subject="We received your email"`
- **THEN** the mailbox is stored with all extended fields
- **AND** the response contains the extended field values
- **AND** the quota limits are enforced by the mail module when the mailbox exceeds them

#### Scenario: Configure forwarding and signatures

- **WHEN** an admin updates a shared mailbox with `forward_to=["team@example.org"]`, `forward_keep_copy=true`, `signature_enabled=true`, and `signature_html="<p>Best regards</p>"`
- **THEN** the mailbox's forwarding and signature settings are persisted
- **AND** incoming mail is forwarded to the destination addresses with a copy retained in the shared mailbox
- **AND** the signature is appended to replies sent from the mailbox

#### Scenario: Migration of existing table

- **WHEN** the system starts with an existing `sogo6_shared_mailboxes` table that lacks the extended columns
- **THEN** the missing columns (`member_roles`, `quota_enabled`, `quota_max_size`, `quota_max_emails`, `auto_respond_enabled`, `auto_respond_subject`, `auto_respond_message`, `forward_to`, `forward_keep_copy`, `signature_enabled`, `signature_html`, `signature_plain`) are added via ALTER TABLE
- **AND** existing rows remain intact with default values for the new columns

### Requirement: Shared mailbox member roles

The system SHALL support three member roles (`admin`, `moderator`, `member`) with a role hierarchy of admin > moderator > member. Members can be added with an initial role, roles can be updated via a dedicated endpoint, and members can be removed. Permission checks SHALL use the role hierarchy to determine access for role-protected operations. When `member_roles` is missing for a legacy member, the member SHALL default to `member` role.

#### Scenario: Add member with role

- **WHEN** an admin calls `POST /admin/v1/shared-mailboxes/{id}/members` with `user_uid` and `role=moderator`
- **THEN** the member is added to `member_uids` and `member_roles` with role `moderator`
- **AND** the operation fails with `ERROR_SHARED_MAILBOX_MEMBER_ALREADY_EXISTS` if the member already exists

#### Scenario: Update member role

- **WHEN** an admin calls `PUT /admin/v1/shared-mailboxes/{id}/members/{uid}` with `role=admin`
- **THEN** the member's role is updated to `admin`
- **AND** the operation fails with `ERROR_SHARED_MAILBOX_MEMBER_NOT_FOUND` if the member does not exist
- **AND** the operation fails with `ERROR_SHARED_MAILBOX_ROLE_INVALID` for an unknown role value

#### Scenario: Role hierarchy permission check

- **WHEN** a permission check requires role `moderator` for a mailbox
- **AND** the requesting user has role `admin`
- **THEN** access is granted because admin outranks moderator
- **AND** a member with role `member` is denied access

### Requirement: Shared mailbox internal notes

The system SHALL support internal notes attached to shared mailboxes, optionally scoped to a specific email (`email_id`). Notes SHALL have an author UID, content, a private flag, and a mentions list (JSON array of member UIDs). Private notes SHALL only be visible to their author and to administrators. Notes are stored in the `sogo6_shared_mailbox_notes` table.

#### Scenario: Create a public note

- **WHEN** a mailbox member calls `POST /admin/v1/shared-mailboxes/{id}/notes` with `content="Follow up on Monday"` and `email_id="<msgid>"` and `is_private=false`
- **THEN** a note is created with the given content, author UID, and email reference
- **AND** the note is visible to all members of the mailbox

#### Scenario: Create a private note with mentions

- **WHEN** a member creates a note with `is_private=true` and `mentions=["user2@example.org"]`
- **THEN** the note is stored with the private flag
- **AND** only the author can see it in the standard note list
- **AND** the mentioned UIDs are persisted in the mentions field

#### Scenario: Delete a note

- **WHEN** the author (or an admin) deletes a note via `DELETE /admin/v1/shared-mailboxes/{id}/notes/{note_id}`
- **THEN** the note is removed from the table
- **AND** the operation fails with `ERROR_SHARED_MAILBOX_NOTE_NOT_FOUND` if the note does not exist

### Requirement: Shared mailbox email assignments

The system SHALL support assigning emails within a shared mailbox to team members, with status tracking (`pending`, `accepted`, `completed`, `cancelled`), an optional reason, assigner/assignee UIDs, and completion timestamps. An email SHALL have at most one active assignment (pending or accepted). Assignments are stored in the `sogo6_shared_mailbox_assignments` table.

#### Scenario: Create an assignment

- **WHEN** an admin calls `POST /admin/v1/shared-mailboxes/{id}/assignments` with `email_id`, `assigned_to`, and `reason`
- **THEN** an assignment is created with status `pending`
- **AND** the operation fails with `ERROR_SHARED_MAILBOX_ASSIGNMENT_ALREADY_EXISTS` if the email already has a pending or accepted assignment

#### Scenario: Accept and complete an assignment

- **WHEN** the assignee calls `POST /admin/v1/shared-mailboxes/{id}/assignments/{assignment_id}/accept` (user API)
- **THEN** the assignment status changes to `accepted`
- **AND** when the assignee calls the complete endpoint, the status changes to `completed` with `completed_at` set
- **AND** only the assignee can accept/complete their own assignment; others get `ERROR_SHARED_MAILBOX_ASSIGNMENT_ACCESS_DENIED`

#### Scenario: Cancel an assignment

- **WHEN** an admin updates an assignment with `status=cancelled`
- **THEN** the assignment status changes to `cancelled` and `completed_at` is recorded

### Requirement: Shared mailbox analytics

The system SHALL provide computed analytics for shared mailboxes including note counts (total, public, private, last 7/30 days) and assignment statistics (total, pending, accepted, completed, cancelled, last 7/30 days, completion rate, average completion time in seconds).

#### Scenario: Retrieve mailbox analytics

- **WHEN** an admin calls `GET /admin/v1/shared-mailboxes/{id}/analytics`
- **THEN** the response contains notes and assignments statistics as computed aggregates
- **AND** the completion rate is `completed/total * 100` (0 when no assignments exist)
- **AND** the average completion time is computed from `completed_at - created_at` over completed assignments

### Requirement: Shared mailbox admin API extensions

The admin API SHALL expose extended CRUD: creating/updating mailboxes with all extended fields, member management with roles, analytics retrieval, and notes/assignments management. Deleting a mailbox SHALL cascade to its notes and assignments.

#### Scenario: Admin list includes extended fields

- **WHEN** an admin calls `GET /admin/v1/shared-mailboxes`
- **THEN** each mailbox includes quota, auto-responder, forwarding, signature, and member-role fields

#### Scenario: Cascade delete

- **WHEN** an admin deletes a shared mailbox
- **THEN** all notes and assignments for that mailbox are deleted first
- **AND** the mailbox row is then removed

### Requirement: Shared mailbox user API extensions

The user API SHALL expose the shared mailboxes the current user is a member of, with their role, plus activity stats (note count, assignment counts per status), note listing/creation (public + own private), and assignment accept/complete operations restricted to the assignee.

#### Scenario: User lists accessible mailboxes

- **WHEN** a user calls `GET /api/v1/shared-mailboxes/`
- **THEN** the response contains only mailboxes where the user is a member
- **AND** each mailbox includes the user's `role`

#### Scenario: User activity endpoint

- **WHEN** a user calls `GET /api/v1/shared-mailboxes/{id}/activity`
- **THEN** the response includes the user's role, note count, and assignment counts by status for that mailbox

#### Scenario: User accepts assigned email

- **WHEN** the assignee calls `POST /api/v1/shared-mailboxes/{id}/assignments/{assignment_id}/accept`
- **THEN** the assignment status changes to `accepted`
- **AND** a non-assignee receives `ERROR_SHARED_MAILBOX_ASSIGNMENT_ACCESS_DENIED`

#### Scenario: User creates note in mailbox

- **WHEN** a member calls `POST /api/v1/shared-mailboxes/{id}/notes` with content
- **THEN** the note is created with the current user as author
- **AND** the note is only listed to other members if it is public
