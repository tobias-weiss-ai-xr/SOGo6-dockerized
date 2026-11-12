# agent-actions Delta Spec

## Purpose

Defines the semantic, token-efficient action surface for AI agents over mail, calendar, and contacts: one-call actions, compact responses, an action manifest, and the MCP tool surface derived 1:1 from the REST facade.

## ADDED Requirements

### Requirement: Mail action endpoints
The system SHALL expose under `/api/v1/agent/mail/`: `GET messages` (list with summaries, no bodies), `GET messages/{uid}` (full body, optional `strip_quotes`, `max_chars`), `POST send` (single call, inline base64 attachments allowed), `GET search`, `POST messages/batch-action` (mark read/unread/flag/star, move, trash), `GET folders`, `POST drafts`, `POST drafts/{key}/send`.

#### Scenario: List messages returns compact summaries
- **WHEN** `GET /api/v1/agent/mail/messages?folder=INBOX&limit=10` is called with a `mail:read` token
- **THEN** the response contains `total` and up to 10 entries of `{uid, from, subject, snippet (<=200 chars), date, flags, has_attachments}` and no message bodies

#### Scenario: Read message truncates and strips quotes
- **WHEN** `GET /api/v1/agent/mail/messages/{uid}?strip_quotes=true&max_chars=4000` is called
- **THEN** the returned body contains at most 4000 characters with quoted reply sections removed

#### Scenario: Send with inline attachments is one call
- **WHEN** `POST /api/v1/agent/mail/send` is called with `to`, `subject`, `body`, and `attachments: [{filename, content_b64}]`
- **THEN** the system uploads, sends, and returns the send result in a single request; the agent never handles an intermediate upload key

#### Scenario: Batch action marks messages
- **WHEN** `POST /api/v1/agent/mail/messages/batch-action` is called with `{uids, action: "mark_read"}`
- **THEN** all listed messages are marked read and the response reports per-uid success/failure

### Requirement: Calendar action endpoints
The system SHALL expose under `/api/v1/agent/calendar/`: `GET events` (range query), `GET events/{key}`, `POST events` (attendees and invitations in one call), `PATCH events/{key}` (partial update, attendee changes trigger invitations), `DELETE events/{key}`, `GET freebusy`, `GET slots` + `POST slots/{id}/book` (appointment booking), `POST invitations/{event_key}/respond`.

#### Scenario: Create event with attendees in one call
- **WHEN** `POST /api/v1/agent/calendar/events` is called with title, start, end, and attendees
- **THEN** the event is created and invitation mails are dispatched without further calls

#### Scenario: Range query returns occurrences
- **WHEN** `GET /api/v1/agent/calendar/events?from=...&to=...` is called
- **THEN** recurring events are expanded to their occurrences within the range

#### Scenario: Respond to invitation
- **WHEN** `POST /api/v1/agent/calendar/invitations/{event_key}/respond` is called with `{status: "accepted"}`
- **THEN** the attendance record is updated and the organizer is notified

### Requirement: Contacts action endpoints
The system SHALL expose under `/api/v1/agent/contacts/`: `GET search` (includes autocomplete behavior), `GET contacts/{key}`, `POST contacts`, `PATCH contacts/{key}`, `DELETE contacts/{key}`, `GET addressbooks`.

#### Scenario: Contact search is compact
- **WHEN** `GET /api/v1/agent/contacts/search?q=smith&limit=20` is called
- **THEN** the response returns at most 20 matches with `{key, name, email, primary_phone}` fields

#### Scenario: Create contact minimal payload
- **WHEN** `POST /api/v1/agent/contacts` is called with `{first_name, last_name, email}`
- **THEN** the contact is created in the user's default address book and its key is returned

### Requirement: AI-assist action endpoints
The system SHALL expose under `/api/v1/agent/ai/`: `POST summarize/{mail_uid}`, `POST suggest-reply/{mail_uid}`, `POST nl-search`, delegating to the existing AI service backend; these require `mail:read` scope.

#### Scenario: Summarize a message
- **WHEN** `POST /api/v1/agent/ai/summarize/{mail_uid}` is called
- **THEN** the response contains a short summary produced by the configured AI backend (rule-based fallback included)

### Requirement: Action manifest
The system SHALL expose `GET /api/v1/agent/manifest` returning the action catalog (id, method, path, description, required scope, parameter schema reference) so agents can bootstrap without parsing OpenAPI.

#### Scenario: Manifest lists all facade actions
- **WHEN** `GET /api/v1/agent/manifest` is called by an authenticated agent
- **THEN** every facade action appears exactly once with its scope and schema reference

### Requirement: OpenAPI contract for the facade
Facade endpoints SHALL carry full request/response marshmallow schemas and appear under the `agent` tag in `/openapi-basic.json`.

#### Scenario: Agent imports OpenAPI
- **WHEN** `/openapi-basic.json` is fetched
- **THEN** all `/api/v1/agent/*` paths are present with request and response schemas (no placeholder entries)

### Requirement: Response envelope and error codes
All facade endpoints SHALL use the standard `ApiBaseResponse` envelope. Scope violations return `S000513`; invalid impersonation target returns `S000514`.

#### Scenario: Consistent envelope
- **WHEN** any facade endpoint returns success or error
- **THEN** the body contains `error_code`, `error_msg`, and `data` fields with an HTTP status matching the error family

### Requirement: MCP sidecar mirrors the facade
A separate `sogo6-mcp` service SHALL expose each facade action as exactly one MCP tool (streamable HTTP at `/mcp`), with identical names and parameters, forwarding the caller's bearer token and holding no credentials or business logic. Tool count SHALL NOT exceed 25.

#### Scenario: MCP tool list equals facade catalog
- **WHEN** the MCP tool list is fetched
- **THEN** every tool maps 1:1 to a facade action in name and parameters, and no tool carries business logic

#### Scenario: MCP forwards token
- **WHEN** an MCP tool is invoked with a bearer token
- **THEN** the sidecar forwards the same token to the REST facade and returns the facade response

### Requirement: UI assistant one-click actions
The sogo6-UI AI panel SHALL be able to attach a structured `action` object (send draft, create event, create contact) to assistant output that the user can execute with one click against the facade using the browser session; actions are user-reviewed, never auto-executed.

#### Scenario: User executes suggested draft
- **WHEN** the assistant proposes a send-draft action and the user clicks execute
- **THEN** the UI calls the facade with the session voucher and shows the send result
