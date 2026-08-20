# SOGo6 Backend Gaps - Blocking Issues

This document tracks backend API gaps blocking key feature story completion. Each gap includes the affected feature, the failing endpoint(s), root cause analysis, and the specific backend work required to unblock.

## Summary

| Feature ID | Feature Description | Endpoint(s) | Status | Priority |
|------------|-------------------|-------------|--------|----------|
| F1 | Invite to event (calendar) | `/api/v1/calendars/*/events/*`, `/api/v1/calendars/*/*/invite` | 🔴 BLOCKED | P0 |
| F2 | Send attachment (compose) | `/api/v1/attachments/upload`, `/api/v1/mail/*/attachments/*` | 🔴 BLOCKED | P0 |
| F3 | Add contact to list | `/api/v1/addressbooks/*`, `/api/v1/contacts/*` | 🔴 BLOCKED | P0 |

---

## F1: Invite to Event (Calendar)

### Feature Description
User can invite attendees to calendar events. Attendees receive email invitations and can accept/decline via calendar interface.

### Failing Endpoints
- `POST /api/v1/calendars/{calendar_id}/events/{event_id}/invite` - Send invitations
- `GET /api/v1/calendars/{calendar_id}/events/{event_id}/attendees` - List attendees
- `PUT /api/v1/calendars/{calendar_id}/events/{event_id}/attendees/{attendee_id}` - Update RSVP status

### Error Responses
- **500 Internal Server Error**: "Unhandled exception in calendar invitation handler"
- **503 Service Unavailable**: Backend service temporarily unavailable

### Root Cause
The calendar invitation methods in `app/api/v1/calendars.py` attempt to call the legacy SOGo 5 OGoDAV layer for:
1. Generating iCalendar `.ics` files with `ATTENDEE` properties
2. Sending MIME email via IMAP
3. Storing RSVP status in the calendar database

However, the SOGo6 backend rewrite replaced OGoDAV with a new SQLAlchemy ORM but did not port the invitation/send-mail logic. The CalDAV data layer exists (`app/manager/calendars/`) but the invitation workflow is missing.

### Specific Backend Work Required

#### 1. Implement Invitation Email Generation
- **File**: `app/services/invitations.py` (new)
- Create `InvitationService` class with:
  - `generate_ics_event(event, organizer, attendees)` → returns iCalendar string
  - `render_invitation_email(recipient, event, organizer)` → returns plain/HTML MIME message
  - Use `icalendar` library (already in requirements.txt)

#### 2. Expose Invitation Endpoints
- **File**: `app/api/v1/calendars.py`
- Add routes:
  ```python
  @blueprint.route('/<calendar_id>/events/<event_id>/invite', methods=['POST'])
  def invite_attendees(calendar_id, event_id):
      # Validates event exists, loads attendees, sends invitations

  @blueprint.route('/<calendar_id>/events/<event_id>/attendees', methods=['GET'])
  def list_attendees(calendar_id, event_id):

  @blueprint.route('/<calendar_id>/events/<event_id>/attendees/<attendee_id>/rsvp', methods=['PUT'])
  def update_rsvp(calendar_id, event_id, attendee_id):
  ```

#### 3. Implement RSVP Tracking
- **File**: `app/models/calendar_attendees.py` (new)
- Define `CalendarAttendee` sqlalchemy model:
  ```python
  class CalendarAttendee(db.Model):
      id = db.Column(db.Integer, primary_key=True)
      event_id = db.Column(db.Integer, db.ForeignKey('calendar_events.id'))
      email = db.Column(db.String(255), nullable=False)
      status = db.Column(db.Enum('needs-action', 'accepted', 'declined', 'tentative'))
      sent_at = db.Column(db.DateTime)
      responded_at = db.Column(db.DateTime)
  ```

#### 4. Email Delivery Integration
- **File**: `app/services/mailer.py` (existing)
- Add `send_mime_message(recipient, subject, mime_msg)` method
- Use configured SMTP server (`SOGO_SMTP_HOST`, `SOGO_SMTP_PORT`)

### Dependencies
- SMTP server configuration (Stalwart)
- Calendar events database schema complete

### Estimated Effort
2-3 days backend development + 1 day testing

---

## F2: Send Attachment (Compose)

### Feature Description
User can attach files to email drafts. Attachments are uploaded to server, stored in temp storage, and included in outbound MIME messages.

### Failing Endpoints
- `POST /api/v1/attachments/upload` - Upload file to server
- `DELETE /api/v1/attachments/{upload_id}` - Cancel upload/Delete temp attachment
- `GET /api/v1/mail/{message_id}/attachments/{attachment_id}` - Retrieve attachment

### Error Responses
- **500 Internal Server Error**: "Failed to store uploaded file"
- "Disk quota exceeded" (even when quota not configured)
- "Invalid file type"

### Root Cause
The attachment upload handler in `app/api/v1/attachments.py` attempts to:
1. Write to a hardcoded `/tmp/sogo6/uploads/` path that rarely exists in containers
2. Enforce a `MAX_ATTACHMENT_SIZE` limit pulled from `app.config['MAX_CONTENT_LENGTH']`, but Flask doesn't auto-set this
3. Check MIME types against an outdated `ALLOWED_EXTENSIONS` whitelist

Additionally, the temporary attachment metadata is expected to be stored in Redis (`sogo:attachments:{upload_id}`) for 24h TTL, but the Redis connection pool is not properly initialized in the attachment blueprint.

### Specific Backend Work Required

#### 1. Configure Upload Directories
- **File**: `app/config.py`
- Add configurable upload storage:
  ```python
  UPLOAD_STORAGE_PATH = os.getenv('SOGO_UPLOAD_PATH', '/var/lib/sogo6/uploads')
  UPLOAD_TEMP_PATH = os.getenv('SOGO_UPLOAD_TEMP_PATH', '/var/lib/sogo6/uploads/tmp')
  MAX_ATTACHMENT_SIZE = int(os.getenv('SOGO_MAX_ATTACHMENT_SIZE', '25_000_000'))  # 25MB
  ALLOWED_ATTACHMENT_TYPES = [...]
  ```

#### 2. Initialize Upload Storage on Startup
- **File**: `app/__init__.py`
- Add storage initialization:
  ```python
  def init_upload_storage():
      os.makedirs(current_app.config['UPLOAD_STORAGE_PATH'], exist_ok=True)
      os.makedirs(current_app.config['UPLOAD_TEMP_PATH'], exist_ok=True)
  ```

#### 3. Fix Attachment Upload Endpoint
- **File**: `app/api/v1/attachments.py`
- Update `upload_attachment()` function:
  - Accept multipart/form-data with file field
  - Validate file size against `MAX_ATTACHMENT_SIZE`
  - Check MIME type (use `python-magic` for actual file type, not extension)
  - Generate UUID for upload_id
  - Store file at `${UPLOAD_TEMP_PATH}/{upload_id}`
  - Store metadata in Redis with 24h TTL:
    ```python
    redis_client.setex(f'attachment:{upload_id}', 86400, json.dumps({
        'filename': file.filename,
        'size': file_size,
        'mime_type': mime_type,
        'path': full_path,
        'uploaded_at': now.isoformat()
    }))
    ```
  - Return `upload_id` to client

#### 4. Add Redis Dependency
- **File**: `app/api/v1/attachments.py`
- Ensure Redis client is initialized:
  ```python
  from app.services.redis_client import get_redis_client
  redis_client = get_redis_client()
  ```

#### 5. Add Cleanup Task
- **File**: `app/tasks/cleanup_attachments.py` (new)
- Hourly cron task to:
  - Delete expired temp files (>24h)
  - Remove orphaned Redis keys listing files not in filesystem

### Dependencies
- Redis service running (sogo6-redis)
- Disk space for uploads (configure volume mount)

### Estimated Effort
1-2 days backend development + 0.5 day testing

---

## F3: Add Contact to List

### Feature Description
User can add existing contacts to contact lists (groups/lists in LDAP). Lists appear as address books with multiple contacts.

### Failing Endpoints
- `GET /api/v1/addressbooks` - List all address books (including lists)
- `POST /api/v1/addressbooks` - Create new contact list
- `POST /api/v1/addressbooks/{list_id}/members` - Add contact to list

### Error Responses
- **500 Internal Server Error**: "Could not load contacts"
- "LDAP attribute 'member' not found"
- "Address book not found" for valid list IDs

### Root Cause
The address book routes in `app/api/v1/addressbooks.py` assume all address books are stored in PostgreSQL via the `AddressBook` model. However, contact lists in the SOGo world are **LDAP distribution lists** stored in the OpenLDAP server under `ou=groups,dc=example,dc=org` with the `groupOfNames` objectClass (or `groupOfUniqueNames`).

Current code attempts `db.session.query(AddressBook).all()` which returns only SQL-backed address books, missing LDAP-based lists entirely. Additionally, the `/addressbooks/{id}/members` endpoint attempts to query `AddressBookMember` SQLAlchemy model which doesn't exist for LDAP lists.

### Specific Backend Work Required

#### 1. Add LDAP List Service
- **File**: `app/services/ldap_lists.py` (new)
- Create `LDAPListService` class:
  ```python
  class LDAPListService:
      def __init__(self, ldap_client):
          self.ldap = ldap_client
          self.list_base_dn = os.getenv('SOGO_LDAP_GROUPS_DN', 'ou=groups,dc=example,dc=org')

      def list_all(self, user_dn):
          """Return all addressable lists: SQL address books + LDAP groups"""
          sql_books = db.session.query(AddressBook).filter_by(user_dn=user_dn).all()
          ldap_groups = self.ldap.search(
              base_dn=self.list_base_dn,
              filter='(objectClass=groupOfNames)',
              attributes=['cn', 'description', 'member']
          )
          return self._merge_results(sql_books, ldap_groups)

      def get_members(self, list_id):
          """If list is LDAP group, return member DNs; if SQL, return contacts"""
          if self._is_ldap_list(list_id):
              return self._get_ldap_members(list_id)
          else:
              return self._get_sql_members(list_id)

      def add_member(self, list_id, contact_id):
          """Add contact DN/email to groupOfNames/member attribute"""
          if self._is_ldap_list(list_id):
              group_dn = self._get_group_dn(list_id)
              contact_dn = self._resolve_contact_dn(contact_id)
              return self.ldap.add_member(group_dn, contact_dn)
  ```

#### 2. Update Address Books API to Use Hybrid Backend
- **File**: `app/api/v1/addressbooks.py`
- Modify routes:
  ```python
  @blueprint.route('/addressbooks', methods=['GET'])
  @auth_required
  def list_addressbooks():
      user_dn = get_current_user_dn()
      service = LDAPListService(get_ldap_client())
      return jsonify(service.list_all(user_dn))

  @blueprint.route('/addressbooks/<list_id>/members', methods=['GET'])
  @auth_required
  def list_members(list_id):
      service = LDAPListService(get_ldap_client())
      members = service.get_members(list_id)
      return jsonify(members)

  @blueprint.route('/addressbooks/<list_id>/members', methods=['POST'])
  @auth_required
  def add_member(list_id):
      service = LDAPListService(get_ldap_client())
      contact_id = request.json.get('contact_id')
      result = service.add_member(list_id, contact_id)
      return jsonify(result)
  ```

#### 3. Add LDAP Helper for Group Operations
- **File**: `app/services/ldap_client.py` (existing)
- Add methods:
  ```python
  def add_member(self, group_dn, member_dn):
      """Add member DN to groupOfNames.member attribute"""
      modification = [(ldap.MOD_ADD, 'member', member_dn.encode())]
      self.conn.modify_s(group_dn, modification)

  def remove_member(self, group_dn, member_dn):
      modification = [(ldap.MOD_DELETE, 'member', member_dn.encode())]
      self.conn.modify_s(group_dn, modification)
  ```

#### 4. Fix Address Book ID Resolution
- **File**: `app/utils/id_resolver.py` (new)
- Add logic to distinguish between:
  - SQL address books: numeric IDs (e.g., `123`)
  - LDAP groups: string IDs with prefix (e.g., `ldap:engineering-team`) or distinguished names
- Use this to route requests to appropriate backend

#### 5. Update Pagination and Caching
- Cache LDAP group queries in Redis (5min TTL)
- Respect `page` and `limit` query params for both backends

### Dependencies
- OpenLDAP server configured with `groupOfNames` schema
- LDAP connection pool healthy (`SOGO_LDAP_*` env vars)
- PostgreSQL `AddressBook` model exists (likely already does)

### Estimated Effort
2 days backend development + 1 day testing

---

## References

- Backend API documentation: `sogo6-server/docs/api/`
- Database models: `sogo6-server/app/models/`
- LDAP configuration: `docs/guides/LDAP_SETUP.md`
- Task reference: `SOGO6-B` (backend gaps documentation)
