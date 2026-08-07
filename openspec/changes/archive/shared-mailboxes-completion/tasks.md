# Shared Mailboxes Completion — Tasks

## 1. Extended Data Model

- [x] 1.1 Add extended fields to ModuleSharedMailbox (quota, auto-responder, forwarding, signatures, member_roles)
- [x] 1.2 Update ensure_table to create new columns on existing tables
- [x] 1.3 Update _row_to_dict to handle new fields
- [x] 1.4 Update create() to accept extended fields
- [x] 1.5 Update update() to allow updating extended fields
- [x] 1.6 Add member role management (add_member with role, update_member_role, remove_member)
- [x] 1.7 Add get_member_role() helper for permission checks

## 2. Notes Module

- [x] 2.1 Create ModuleSharedMailboxNotes with CRUD for internal notes
- [x] 2.2 Create sogo6_shared_mailbox_notes table definition
- [x] 2.3 Add create_note, list_notes, delete_note, get_note methods
- [x] 2.4 Support per-email notes and per-mailbox notes
- [x] 2.5 Support private notes (is_private flag)
- [x] 2.6 Support mentions (JSON list of UIDs)

## 3. Assignment Module

- [x] 3.1 Create ModuleSharedMailboxAssignment with CRUD for email assignments
- [x] 3.2 Create sogo6_shared_mailbox_assignments table definition
- [x] 3.3 Add create_assignment, list_assignments, update_assignment, delete_assignment methods
- [x] 3.4 Support assignment status (pending, accepted, completed, cancelled)
- [x] 3.5 Add accept_assignment and complete_assignment convenience methods

## 4. Analytics Module

- [x] 4.1 Create ModuleSharedMailboxAnalytics with computed statistics
- [x] 4.2 Add get_analytics method (email count, active members, response time)
- [x] 4.3 Add get_trends method (7-day and 30-day trends)

## 5. Error Codes

- [x] 5.1 Add shared mailbox completion error codes (S00133x)

## 6. Admin API Extensions

- [x] 6.1 Update ApiSharedMailbox schemas with extended fields
- [x] 6.2 Update create/update endpoints to accept extended fields
- [x] 6.3 Add member role to member schema (member, moderator, admin)
- [x] 6.4 Add PUT /members/{uid} endpoint for updating member role
- [x] 6.5 Add GET /{id}/analytics endpoint
- [x] 6.6 Add notes endpoints (GET, POST, DELETE)
- [x] 6.7 Add assignment endpoints (GET, POST, PUT, DELETE)

## 7. User API Extensions

- [x] 7.1 Update ApiSharedMailboxes schema with role field
- [x] 7.2 Add GET /{id}/activity endpoint
- [x] 7.3 Add notes endpoints (GET, POST) for user
- [x] 7.4 Add assignment endpoints (GET, POST accept/complete) for user
- [x] 7.5 Add permission checks (membership + role)

## 8. Frontend (Admin UI)

- [x] 8.1 Update admin shared-mailboxes page with extended fields (quota, auto-responder, forwarding, signatures)
- [x] 8.2 Add member role management (role selector in member management)
- [x] 8.3 Add analytics dashboard section
- [x] 8.4 Add notes management section
- [x] 8.5 Add assignment management section
