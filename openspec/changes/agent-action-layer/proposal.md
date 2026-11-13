# Proposal: Agent Action Layer

## Why

AI agents (OpenCode, Pi, custom LLM pipelines) and the SOGo6 UI assistant cannot act on mail, calendar, or contacts today: the API-token system exists but is not wired into authentication (`verify_api_token()` is dead code), the REST surface is UI-shaped (multi-step flows, verbose responses), and OpenAPI discovery ships a placeholder. Agents need one-call semantic actions, a long-lived scoped credential, and a real machine-readable contract.

## What Changes

- **New blueprint `/api/user/v1/agent/`** with ~20 semantic action endpoints across mail, calendar, contacts, and AI-assist; thin controllers delegating to existing `Interface*`/`Module*` layers. Compact, token-efficient response shapes (message summaries without bodies, `strip_quotes`/`max_chars` on reads, inline attachments on send).
- **Wire API tokens into authentication**: `Authorization: Bearer sogo_…` resolved via `verify_api_token()` in the auth middleware; scope enforcement (`mail:read`, `mail:send`, `calendar:read`, `calendar:write`, `contacts:read`, `contacts:write`, `read`, `write`, `admin`) per endpoint via a `require_scope` guard. Facade always requires authentication (no anonymous path).
- **Admin impersonation tokens**: `POST /api/admin/v1/impersonation-tokens` issues scoped `sogoimp_…` tokens bound to `(admin, target_uid)`; actions execute as the target user with the target's ACLs, logged as `admin → acted_as target`.
- **Agent manifest + real OpenAPI**: `GET /api/user/v1/agent/manifest` returns the action catalog; facade endpoints carry full marshmallow schemas so `/openapi-basic.json` becomes agent-importable (tag `agent`).
- **MCP sidecar** (`deploy/sogo6-mcp/` + compose service): FastMCP streamable-HTTP server exposing each facade action as one tool (≤30 tools; the v1 catalog has 26), forwarding the user's bearer token, holding no credentials or state.
- **UI AI panel action executor**: the UI assistant's outputs can carry a structured `action` object (send draft, create event, create contact) that the user executes with one click against the facade — reviewed, not auto-executed.
- New error codes: `S000513 SCOPE_INSUFFICIENT`, `S000514 IMPERSONATION_TARGET_INVALID`.

Non-goals (v1): no SSE/streaming on the facade, no batch JSON-RPC, no cross-user search beyond impersonation, no changes to the 100+ existing UI endpoints.

## Capabilities

### New Capabilities

- `agent-actions`: Semantic agent-facing action endpoints (mail, calendar, contacts, AI-assist), action manifest, compact response contract, and the MCP sidecar surface derived 1:1 from the facade.
- `agent-auth`: API-token bearer authentication, scope model and enforcement, per-user token lifecycle, and admin impersonation tokens with audit trail.

### Modified Capabilities

(none — the existing `authentication` spec covers SAML2 only and is unaffected; voucher auth flow is extended, not changed.)

## Impact

- **sogo6-server** `app/__init__.py` (`register_before_request`/`get_user` token branch), new `app/api/user/v1/agent/` blueprint + schemas, `app/api/v1/user/ApiApiTokens.py` (scope constants shared), new admin endpoint in `app/api/v1/admin/`, `app/utils/errors.py` (2 new codes).
- **Deployment**: new compose service `sogo6-mcp` (`deploy/sogo6-mcp/`, Dockerfile + ~300-line FastMCP app).
- **sogo6-ui**: AI panel action-executor component (submodule bump).
- **Tests**: scope-matrix unit tests, facade integration tests on the live stack (token create → act → revoke → 401), OpenAPI snapshot, manifest==facade==MCP single-source test.
- Existing UI endpoints, CalDAV/CardDAV, and voucher auth behavior unchanged.
