# Design: Agent Action Layer

## Context

SOGo6-server is a Flask app (flask-smorest) whose ~100 UI endpoints live under `/api/v1/` and delegate to an `Interface*` layer over `Module*` classes. Authentication runs in `register_before_request` (`app/__init__.py` → `get_user`): bearer tokens go to JWT-voucher resolution, basic auth is config-gated. An API-token system exists (`app/api/v1/user/ApiApiTokens.py`: Redis-backed SHA-256 hashes, scopes `mail:read|send`, `calendar:read|write`, `contacts:read|write`, `read|write|admin`) but `verify_api_token()` is never called. The Celery worker is named "Agent" in this codebase (`InterfaceAgent*` classes) — an unrelated concept; the new layer avoids that naming in Python identifiers. OpenAPI discovery is a placeholder (`openapi-generated.json`). See proposal.md for motivation.

## Goals / Non-Goals

Goals: one-call semantic actions with compact payloads; token auth wired and scope-enforced; impersonation for admins with audit; real OpenAPI for the facade; an MCP sidecar with zero business logic; UI assistant actions executed through the same facade.

Non-Goals (design-level): no changes to existing UI endpoints or their contracts; no SSE/streaming; no gateway-style request batching; no new persistence (tokens stay in Redis as today); MCP sidecar holds no credentials, state, or DB/Redis access.

## Decisions

### D1: Facade blueprint instead of enriching existing endpoints
New `app/api/user/v1/agent/` blueprint (registered in the basic API tier), URL prefix `/api/user/v1/agent`. Endpoints are thin controllers that instantiate the same `Interface*` objects the UI endpoints use (`InterfaceApiMailSend`, `InterfaceApiMailMail`, `InterfaceApiMailFolder`, `InterfaceApiCalendarCalendar`, `InterfaceApiContactContact`, AI service).
*Why not `?agent=compact` flags on existing endpoints*: that couples the UI contract to agent needs; every change risks both consumers, and OpenAPI would mix concerns. The facade keeps the agent contract free to evolve (compact shapes, inline attachments) with zero regression risk on UI paths. Cost: some orchestration duplication (notably send-with-attachments), accepted.

### D2: Token resolution inside `get_user`, prefix-dispatched
In `register_before_request.get_user`, before voucher parsing: if `auth.type == bearer` and token starts with `sogo_`/`sogoimp_`, call `verify_api_token` (extended: accept `sogoimp_`, see D4), resolve the stored `user_uid` to a real `User` via the same user-resolution the voucher service uses, attach to `g.user`, and set `g.token_scopes` + `g.token_issuer` (admin uid for impersonation). Other bearer tokens fall through to voucher parsing unchanged.
*Why here*: single auth choke point, before any `check_non_anonymous_endpoint` logic; keeps module code free of auth concerns. Alternative rejected: a separate WSGI middleware — it would bypass Flask's `g` conventions and the existing error-envelope helpers.

### D3: Scope enforcement via a small guard helper
A `require_scope(scope)` function (in `app/api/user/v1/agent/__init__.py`) used inside each view: it checks `g.token_scopes` (empty for voucher-auth = full user session, UI panel path). `read`/`write` map to module-wide grants; `admin` grants all. Failure → `create_api_base_response(error=ERROR_SCOPE_INSUFFICIENT)` (HTTP 403, `S000513`).
*Why per-view and not decorator-at-blueprint level*: scopes differ per endpoint and the manifest generation reuses the same declarations; a helper keeps the mapping single-sourced.

### D4: Impersonation tokens reuse the token store with a distinct prefix
`POST /api/admin/v1/impersonation-tokens` (admin blueprint) stores a `sogoimp_` token in the same Redis structures with extra fields `issuer_uid`, `target_uid`. `verify_api_token` returns the metadata; `get_user` loads the *target* user but records `g.token_issuer`. Actions log `admin=X acted_as=Y`. Revocation = existing token delete (admin can list/revoke via the admin tier).
*Why not a separate store*: identical lifecycle mechanics (hash lookup, expiry, last_used), one code path; the prefix distinguishes semantics without schema drift. Kill-switch list deferred — deletion suffices for v1 (recorded as open question only if needed later).

### D5: Compact shapes live in facade schemas
New `app/api/user/v1/agent/schemas/` marshmallow schemas define the agent contract: `MailSummarySchema` (`uid, from, subject, snippet<=200, date, flags, has_attachments`), `MailDetailSchema` (body + `strip_quotes`, `max_chars` query params applied server-side), `send` with `attachments: [{filename, content_b64}]` (upload→send orchestrated inside the view via the existing attachment interface), calendar/contact minimal-payload schemas. flask-smorest auto-registers them into `/openapi-basic.json` under an `agent` tag — this also fixes the placeholder discovery problem for agent consumers without touching the UI spec.

### D6: Manifest as generated, not hand-maintained
`GET /api/user/v1/agent/manifest` walks a module-level `ACTIONS` registry (id, method, path, description, scope, schema class) that every facade view also uses for its `require_scope` call. One source of truth; a unit test asserts manifest == blueprint routes == MCP tool list.

### D7: MCP sidecar as separate FastMCP process
`deploy/sogo6-mcp/` — small Python package (FastMCP, streamable HTTP at `/mcp`), one `@tool` per manifest action, forwarding `Authorization` to `http://sogo6-server/api/user/v1/agent/...`. Token passthrough only; env var `SOGO_AGENT_API_URL` for the upstream base URL.
*Why not MCP inside Flask*: MCP streamable-HTTP wants an ASGI/SSE stack; embedding it in the WSGI app adds fragility for zero gain since the sidecar is stateless. *Why a sidecar at all*: OpenCode/Pi consume MCP URLs natively; a 1:1 REST mapping keeps tool schemas small (~2–4k tokens total) which is where MCP token economics actually pay off.

### D8: UI panel executes via facade with the browser voucher
The UI assistant already talks to `/api/v1/user/ai/*`. The action executor posts the structured `action` object to the corresponding facade endpoint with the existing session voucher (voucher auth ⇒ no `g.token_scopes` ⇒ scope check passes as full session). No new UI auth mechanism.

## Risks / Trade-offs

- [Duplication drift between facade and UI endpoints] → delegation to the same Interface layer keeps logic single-sourced; only orchestration (e.g. inline attachments) is facade-local.
- [Token leak = full user mailbox] → scopes bound per token, expiry optional but surfaced in UI, revocation is one DELETE; global rate limiter already covers `/api/*`.
- [Impersonation misuse] → admin-tier only, audit line on every action, raw token shown once, target must resolve.
- [MCP sidecar as new deployment unit] → stateless, no data access, failure mode = agents lose MCP but REST keeps working.
- [facade surface creep beyond 30 actions] → manifest test enforces the count; new actions require a spec delta.

## Migration Plan

1. Ship server-side facade + auth wiring behind existing release process; no flag needed (new endpoints only, inert until tokens are created).
2. Add `sogo6-mcp` compose service (optional profile `agents`).
3. UI panel action executor lands as a sogo6-ui submodule bump.
Rollback: remove compose service / revert submodule; tokens can be left orphaned (harmless) or swept via existing Redis TTL (365d).

## Open Questions

- Exact snippet extraction (first 200 chars of text part vs. dedicated summarizer call) — pick during implementation, doesn't affect contracts.
- Whether `admin` scope on a user token also permits impersonation creation — v1: no, impersonation requires admin-tier auth regardless (already specified).
