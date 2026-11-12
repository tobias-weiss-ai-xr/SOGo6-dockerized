# agent-auth Delta Spec

## Purpose

Defines how non-human clients (AI agents, scripts, pipelines) authenticate to SOGo6 via long-lived scoped API tokens, and how administrators may act on behalf of users through impersonation tokens, both with audit trails.

## ADDED Requirements

### Requirement: API-token bearer authentication
The system SHALL accept `Authorization: Bearer <token>` where the token starts with `sogo_` (user token) or `sogoimp_` (impersonation token), resolve it via the existing API-token store, and attach the corresponding real user to the request before any voucher parsing. Tokens that are unknown, expired, or revoked SHALL be rejected with HTTP 401 and error code `S000512` (or `S000510` where token metadata is addressed directly).

#### Scenario: Valid token authenticates as its owner
- **WHEN** a request carries `Authorization: Bearer sogo_<valid-token>` whose stored scopes include `mail:read`
- **THEN** the request executes as the token's owner with the owner's permissions, and `last_used_at` is refreshed

#### Scenario: Expired token is rejected
- **WHEN** a request carries a `sogo_` token past its `expires_at`
- **THEN** the system responds HTTP 401 with `S000512`, deletes the token from the store, and no user is attached

#### Scenario: Voucher flow unchanged
- **WHEN** a request carries a bearer token that is not `sogo_`/`sogoimp_` prefixed
- **THEN** the existing JWT-voucher resolution runs exactly as before

### Requirement: Scope enforcement on agent endpoints
Every agent-facade endpoint SHALL declare the scope it requires, and the system SHALL reject authenticated requests whose token lacks that scope with HTTP 403 and error code `S000513`. The scopes `read`, `write`, and `admin` SHALL act as module-wide grants (`mail:*`, `calendar:*`, `contacts:*` respectively for `read`/`write`; `admin` grants all).

#### Scenario: Insufficient scope rejected
- **WHEN** a token with scopes `["mail:read"]` calls `POST /api/v1/agent/mail/send` (requires `mail:send`)
- **THEN** the system responds HTTP 403 with `S000513` and no mail is sent

#### Scenario: Module-wide grant accepted
- **WHEN** a token with scopes `["write"]` calls `POST /api/v1/agent/mail/send`
- **THEN** the request is authorized because `write` grants `mail:send`

### Requirement: Agent endpoints never allow anonymous access
Agent-facade endpoints SHALL reject unauthenticated requests with HTTP 401 regardless of any UI anonymous-guest configuration.

#### Scenario: No credentials on facade
- **WHEN** a request to `/api/v1/agent/*` carries no Authorization header
- **THEN** the system responds HTTP 401 and the request is not dispatched

### Requirement: Admin-issued impersonation tokens
An authenticated admin SHALL be able to create an impersonation token via `POST /api/v1/admin/impersonation-tokens` with a target user UID, scopes, optional label, and optional expiry. The token SHALL start with `sogoimp_`, SHALL bind the issuing admin and the target user, and SHALL only be created by an authenticated admin. Requests presenting it SHALL execute as the target user with the target user's ACLs and permissions.

#### Scenario: Admin creates impersonation token
- **WHEN** an authenticated admin posts `{target_uid, scopes: ["mail:read"], label}` to the impersonation-token endpoint
- **THEN** the system returns HTTP 201 with the raw `sogoimp_` token (shown once), the token id, and its metadata

#### Scenario: Impersonated request acts as target
- **WHEN** a request carries a valid `sogoimp_` token for target user U
- **THEN** module calls execute as user U under U's ACLs, and the access log records issuer and acted-as identity

#### Scenario: Non-admin cannot issue impersonation tokens
- **WHEN** a basic-tier (non-admin) credential calls `POST /api/v1/admin/impersonation-tokens`
- **THEN** the system responds with the admin-authentication failure (HTTP 401/403) and no token is issued

#### Scenario: Unknown target rejected
- **WHEN** an admin creates an impersonation token with a `target_uid` that does not resolve to a user
- **THEN** the system responds HTTP 400/404 with `S000514` and no token is issued

### Requirement: Impersonation audit trail
Every action executed under an impersonation token SHALL be logged with both the issuing admin identity and the acted-as user identity.

#### Scenario: Audit entry written
- **WHEN** any facade action succeeds under a `sogoimp_` token
- **THEN** a log line records admin id, target uid, endpoint, and request id

### Requirement: Token lifecycle shared with user tokens
Impersonation tokens SHALL be revocable via token-deletion (admin endpoint), SHALL honor expiry, and revocation SHALL take effect on the next request.

#### Scenario: Revoked impersonation token rejected
- **WHEN** an admin revokes a `sogoimp_` token and the token is presented again
- **THEN** the system responds HTTP 401 with `S000512`
