# Tasks: Agent Action Layer

## 1. Auth foundation (sogo6-server)

- [ ] 1.1 Extend `verify_api_token` in `app/api/v1/user/ApiApiTokens.py` to accept `sogoimp_` tokens and return `issuer_uid`/`target_uid` metadata; add scope-grant helper (`read`/`write`/`admin` → module grants)
- [ ] 1.2 Wire token branch into `register_before_request.get_user` (`app/__init__.py`): prefix-dispatch `sogo_`/`sogoimp_` before voucher parsing, resolve user, set `g.token_scopes`/`g.token_issuer`, anonymous facade requests → 401
- [ ] 1.3 Add error codes `S000513 SCOPE_INSUFFICIENT`, `S000514 IMPERSONATION_TARGET_INVALID` to `app/utils/errors.py`
- [ ] 1.4 Admin endpoint `POST /api/v1/admin/impersonation-tokens` (+ list/revoke reuse) in `app/api/v1/admin/`, validating target user resolution
- [ ] 1.5 Unit tests: scope matrix (token scopes × representative endpoints), expired/revoked token → 401, voucher fallthrough unchanged, impersonation issue/act/revoke cycle, audit log line

## 2. Facade blueprint (sogo6-server)

- [ ] 2.1 Create `app/api/v1/agent/` blueprint package with `ACTIONS` registry, `require_scope` guard, and registration in the basic API tier
- [ ] 2.2 Mail endpoints + schemas: `GET messages` (compact summaries), `GET messages/{uid}` (`strip_quotes`, `max_chars`), `POST send` (inline b64 attachments), `GET search`, `POST messages/batch-action`, `GET folders`, `POST drafts`, `POST drafts/{key}/send`
- [ ] 2.3 Calendar endpoints + schemas: events CRUD (create with attendees/invitations one-call, PATCH partial), `freebusy`, `slots` list/book, `invitations/{key}/respond`
- [ ] 2.4 Contacts endpoints + schemas: `search`, CRUD, `addressbooks`
- [ ] 2.5 AI-assist endpoints: `summarize/{mail_uid}`, `suggest-reply/{mail_uid}`, `nl-search` (delegate to AIService)
- [ ] 2.6 `GET /api/v1/agent/manifest` generated from `ACTIONS` registry; unit test manifest == registered routes
- [ ] 2.7 OpenAPI check: facade paths with `agent` tag and full schemas present in `/openapi-basic.json`; snapshot test

## 3. Integration tests (live stack pattern)

- [ ] 3.1 Token create → facade action as user → revoke → 401 (mail + calendar + contacts one happy path each)
- [ ] 3.2 Scope enforcement on live stack: `mail:read` token calling send → 403 `S000513`
- [ ] 3.3 Impersonation: admin issues token → acts as target (calendar write visible as target) → revoke → 401; audit line asserted in logs

## 4. MCP sidecar

- [ ] 4.1 `deploy/sogo6-mcp/` package: FastMCP streamable-HTTP app, tools generated from manifest fetch, bearer-token passthrough, `SOGO_AGENT_API_URL` env
- [ ] 4.2 Dockerfile + compose service (profile `agents`); no DB/Redis access
- [ ] 4.3 Test: MCP tool list == manifest == facade routes; invoke one tool against a running stack

## 5. UI assistant actions (sogo6-ui submodule)

- [ ] 5.1 Action-executor component: render structured `action` object (send draft / create event / create contact) with one-click execute via facade using session voucher; user-reviewed, never auto-executed
- [ ] 5.2 Submodule bump + manual smoke in dev stack
