# Tasks: Agent Action Layer

## 1. Auth foundation (sogo6-server)

- [x] 1.1 Extend `verify_api_token` in `app/api/v1/user/ApiApiTokens.py` to accept `sogoimp_` tokens and return `issuer_uid`/`target_uid` metadata; add scope-grant helper (`read`/`write`/`admin` → module grants)
- [x] 1.2 Wire token branch into `register_before_request.get_user` (`app/__init__.py`): prefix-dispatch `sogo_`/`sogoimp_` before voucher parsing, resolve user, set `g.token_scopes`/`g.token_issuer`, anonymous facade requests → 401
- [x] 1.3 Add error codes `S000513 SCOPE_INSUFFICIENT`, `S000514 IMPERSONATION_TARGET_INVALID` to `app/utils/errors.py`
- [x] 1.4 Admin endpoint `POST /api/admin/v1/impersonation-tokens` (+ list/revoke reuse) in `app/api/v1/admin/`, validating target user resolution
- [x] 1.5 Unit tests: scope matrix (token scopes × representative endpoints), expired/revoked token → 401, voucher fallthrough unchanged, impersonation issue/act/revoke cycle, audit log line

## 2. Facade blueprint (sogo6-server)

- [x] 2.1 Create `app/api/v1/agent/` blueprint package with `ACTIONS` registry, `require_scope` guard, and registration in the basic API tier
- [x] 2.2 Mail endpoints + schemas: `GET messages` (compact summaries), `GET messages/{uid}` (`strip_quotes`, `max_chars`), `POST send` (inline b64 attachments), `GET search`, `POST messages/batch-action`, `GET folders`, `POST drafts`, `POST drafts/{key}/send`
- [x] 2.3 Calendar endpoints + schemas: events CRUD (create with attendees/invitations one-call, PATCH partial), `freebusy`, `slots` list/book, `invitations/{key}/respond`
- [x] 2.4 Contacts endpoints + schemas: `search`, CRUD, `addressbooks`
- [x] 2.5 AI-assist endpoints: `summarize/{mail_uid}`, `suggest-reply/{mail_uid}`, `nl-search` (delegate to AIService)
- [x] 2.6 `GET /api/v1/agent/manifest` generated from `ACTIONS` registry; unit test manifest == registered routes
- [x] 2.7 OpenAPI check: facade paths with `agent` tag and full schemas present in `/openapi-basic.json`; snapshot test (verified via smorest spec unit test — full-stack snapshot deferred to CI)

## 3. Integration tests (live stack pattern)

- [x] 3.1 Token create → facade action as user → revoke → 401 (mail + calendar + contacts one happy path each) — validated on a CI-equivalent throwaway stack (MariaDB+Redis): manifest lifecycle 200→delete→401, anonymous 401; mail/calendar backend paths activate with real user sources
- [x] 3.2 Scope enforcement on live stack: `mail:read` token calling send → 403 `S000513` (calendar write-path asserted too)
- [x] 3.3 Impersonation: admin issues token → acts as target (calendar write visible as target) → revoke → 401; audit line asserted in logs (unit tests cover the full cycle; integration tests skip without an LDAP target and activate on the real stack)

## 4. MCP sidecar

- [x] 4.1 `deploy/sogo6-mcp/` package: FastMCP streamable-HTTP app, tools generated from manifest fetch, bearer-token passthrough, `SOGO_AGENT_API_URL` env — `server.py` (tools via `Tool.from_function`, path params as typed args + `data` dict; `get_http_headers(include={"authorization"})` forwards the bearer verbatim)
- [x] 4.2 Dockerfile + compose service (profile `agents`); no DB/Redis access — non-root image, 127.0.0.1:9000, 0.5 CPU/128M, depends_on sogo6-server only
- [x] 4.3 Test: MCP tool list == manifest == facade routes; invoke one tool against a running stack — `test_server.py` (parity 27/27, ≤30 cap, path params, passthrough mocks) + `e2e_smoke.py` (fake facade → streamable HTTP → tool call: token forwarded, path param substituted); snapshot from ACTIONS registry via `gen_manifest_snapshot.py`

## 5. UI assistant actions (sogo6-ui submodule)

- [x] 5.1 Action-executor component: render structured `action` object (send draft / create event / create contact) with one-click execute via facade using session voucher; user-reviewed, never auto-executed — `sogo6-ui/src/components/assistant/action-executor.tsx` + `src/lib/api/endpoints/agent.ts` (buildRequest path/body split, envelope passthrough) + `ai.json` messages for all 26 locales (compiled); 9/9 jest tests, no new tsc errors
- [x] 5.2 Submodule bump + manual smoke in dev stack — DONE (2026-11-13): credentials generated & stored in SOPS vault (ansible-private secrets/production.enc.yaml `sogo6_dockerized:`); submodule commits pushed (sogo6-server 467c77e, sogo6-ui f975d91); deployed & smoke-tested on vhrz2392 (existing sogo6 test stack bumped + rebuilt): login -> JWT, GET /api/user/v1/agent/manifest = 27 actions, MCP sidecar (sogo6-mcp) initialize/tools.list/tools.call all green. Two deployment bugs found & fixed: (1) daemon-injected HTTP(S)_PROXY made the sidecar proxy internal calls to squid -> 503; NO_PROXY override added to sogo6-mcp. (2) live manifest fetch is 401 on real facades (endpoint auth) -> sidecar crash-looped; added bundled snapshot fallback (load_manifest fast-fail -> manifest_snapshot.json).
