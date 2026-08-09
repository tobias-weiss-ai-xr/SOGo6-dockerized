# Stubs, Mocks & Missing Specs — Implementation Plan

**Created**: 2026-08-07
**Owner**: weissto
**Status**: Planning

## Priority 1 — Real stubs that 500 (user-facing)

| # | Feature | Files | Status |
|---|---------|-------|--------|
| 1 | Folder rename/update | `ModuleMail.update_folder`, `ApiMailFolder.patch` | ✅ DONE (2026-08-07) |
| 2 | Mail delegation | `ModuleUserProfile.add_delegation_given`, `InterfaceApiMailMailbox.create_mailbox_delegate` | ✅ DONE (2026-08-07) |
| 3 | Folder export (.eml/.zip) | `ModuleMail.export_folder_mails`, `ApiMailFolderIdExport` | ✅ DONE (2026-08-07) |
| 4 | `ModuleMail.move_mails` dead code | implemented (bulk UID COPY + \Deleted) + wired into batch-action move | ✅ DONE (2026-08-07) |

## Priority 2 — Simulated implementations (real backend work)

| # | Feature | Files | Notes |
|---|---------|-------|-------|
| 5 | HIPAA encryption — replace XOR with real AES-256-GCM (cryptography lib) | `ApiHipaaCompliance._encrypt_message_at_rest` | Key from settings, not hardcoded |
| 6 | eIDAS signatures — replace `_simulate_qes_signature` | `ApiEidasSignatures` | Needs real cert handling or mark beta |
| 7 | JMAP — implement Email/get, Mailbox/get against real mail store | `ApiJmapProtocol` | ✅ DONE (2026-08-08): real RFC 8620/8621 envelope + methods (/session, POST /jmap, /upload, /download, /status) backed by new `JmapMailGateway` (wraps `ModuleMail` real IMAP store); Mailbox/get rows, Mailbox/set create/destroy, Email/get, Email/query, Email/set destroy/move; unknownCapability/unknownMethod/accountNotFound semantics; upload stores real bytes; 22 new tests — suite 2240 green |
| 8 | ActiveSync — real WBXML encoding (pywbxml) | `ApiActiveSync` | ✅ DONE (2026-08-08): real WBXML 1.3 engine (`app/service/activesync/Wbxml.py` — no pywbxml dep) + store-backed commands via new `ActiveSyncGateway`; FolderSync real folders, Sync real UID change log w/ raw MIME in AirSyncBase Body, Provision policy keys, Ping change detection, GetAttachment real MIME-part bytes, SendMail via SMTP client; honest status 6/7/9/449 errors; routes opt out of the JSON content-type gate; 22 new tests — suite 2262 green |
| 9 | SCIM provisioning — real user source integration | `ApiScimProvisioning` | ✅ DONE (2026-08-08): real LDAP lifecycle via new `ScimIdentityGateway` (ModuleAdminUser); create w/ uniqueness 409, list/get, PATCH attribute + active via shadowExpire, delete; Redis only as sidecar for externalId/groups/meta; routes are public_access so SCIM_BEARER_TOKEN is the gate; 14 new tests — suite 2276 green |
| 10 | Student Groups — real LDAP/SIS sync | `ApiStudentGroups` | ✅ DONE (2026-08-10): replaced Redis-only mocks with real LDAP groupOfNames sync via new ModuleGroup; create_group/delete_group/get_group/search_groups + add_member/remove_member/get_members; ou=groups,dc=... base from domain settings; Redis stores only metadata; honest errors when LDAP unreachable; Blueprint prefix fixed /admin/student-groups → /student-groups; 8 new tests — suite 2355 green |
| 11 | Donor Management — real EIN/donor store | `ApiDonorManagement` | ✅ DONE (2026-08-09): no hardcoded EIN — receipts valid only w/ `SOGO_DONOR_ORG_EIN` (format-validated, else unconfigured/invalid + disclaimer); donor EIN format validation (corporate/foundation); ISO 4217 currency validation; SHA-256 receipt integrity + verify endpoint detects tampering; 18 new tests — suite 2311 green |
| 12 | Matrix Chat — real Ed25519 federation signing | `ApiMatrixChat` | ✅ DONE (2026-08-09): replaced fake HMAC-SHA256 _sign_matrix_event with real Ed25519 Matrix Server-Server v2 signing (cryptography Ed25519 keys, canonical JSON, base64 signatures); Ed25519 seed stored in Redis mx_key:{homeserver}, legacy hex migrate auto; GET /serverkey returns public key in SS v2 format; sent PDUs carry Ed25519 signatures (88-char base64) when key configured — 10 new tests; suite 2347 green |
| 13 | Backup automation — real DB dump + retention + S3 | `ApiBackup` | ✅ DONE (2026-08-09): real Redis datastore snapshot (SCAN+type+TTL → gzipped artifact w/ SHA-256), honest per-source statuses (LDAP ldapsearch LDIF / psycopg logical dump / mailstore skipped honestly), real retention (dirs pruned by manifest timestamp, count cap), `/backup/{id}/verify` recomputes checksums, `/backup/{id}/restore` integrity-gated; 11 new tests — suite 2331 green |
| 14 | Audit log — real tamper-proof log + SIEM export | `ApiAuditLog` | ✅ DONE (2026-08-09): SHA-256 hash chain (seq/prev_seq/prev_hash/hash) with `/audit-log/verify` tamper detection + honest trimmed-boundary; real retention via new `zset_trim` (old code removed nothing); SIEM export `/audit-log/export?format=cef|jsonl`; fixed latent redis-py client-side-cache stale zrange bug (CacheConfig disabled); 9 new tests — suite 2320 green |
| 15 | Usage quotas — real usage (hardcoded 0-usage was fake; enforcement lives in the mail server) | `ApiUsageQuotas` | ✅ DONE (2026-08-09): hardcoded 0-usage replaced by real probes (calendar count via ModuleCalendar, contact total via ModuleContact, IMAP mailbox bytes via app's real ClientImap + STATUS SIZE w/ SOGO_QUOTA_IMAP_* creds); honest `used: null` + per-source status when unreachable/unconfigured (never fabricated 0); over-quota computed only from known usage; limits sanitized (negatives → 0); 6 new tests — suite 2337 green |
| 16 | Health dashboard — real service checks | `ApiHealthDashboard` + `/api/user/v1/health` | ✅ DONE (2026-08-09): probes moved to shared `app/service/monitoring/HealthChecks.py` (live PG SELECT 1, anonymous LDAP bind, Redis PING, Stalwart TCP, Celery `control.ping`); dashboard no longer hardcodes "ok" (was all fake) — every row reports real status+latency, per-row `healthy_count`; probes feed new `sogo_dependency_up`/`sogo_dependency_latency_seconds` Prometheus gauges; access log now severity-mapped (5xx ERROR / 4xx WARNING) with `slow_request` flag (>`SOGO_SLOW_REQUEST_MS`); `sogo_db_query_duration_seconds` + `sogo_cache_operation_duration_seconds` histograms wired (previously declared-but-dead) via `@db_op`/`@cache_op` in ClientRedis + both SQL clients; 17 new tests — suite 2293 green |
| 17 | Webhooks — verify delivery (retry, HMAC, dispatch loop) | `WebhookService` | ✅ DONE (2026-08-08): sync `dispatch` + non-blocking `dispatch_event` (daemon threads), per-hook delivery stats, real emission from ModuleCalendar / ModuleContact / ModuleAdminUser, API detail/PATCH/toggle/test endpoints, URL-scheme gate; 10 new tests |
| 18 | Cleanup orm.py remove dead code Acl / db_session | `app/orm.py` | ✅ DONE (2026-08-10): removed unused placeholder classes Acl and db_session; only PydanticBaseModel exported and used; pyflakes + full suite green |

## Priority 3 — Missing spec items

| # | Spec | Gap | Effort |
|---|------|-----|--------|
| 19 | api-playground | Serve `/docs` + `/docs/openapi.json` (spec names) with JWT auto-populate, dark mode, version selector | Medium |
| 20 | caldav-server | 95 unchecked requirements (draft spec) — full RFC 4791 server | Large | ✅ DONE (already implemented: RFC 4791/4918/6578 CalDAV server via ModuleCalDAV + ApiCalDAV blueprint; OPTIONS/PROPFIND/PROPPATCH/MKCALENDAR/MKCOL/GET/PUT/DELETE/HEAD/REPORT with sync-collection/calendar-query/multiget/free-busy; .well-known/caldav redirect; 50 dedicated tests; UI page — see CALDAV_IMPLEMENTATION_SUMMARY.md) |
| 21 | webauthn-passkeys | Acceptance criteria: browser matrix tests, rate limiting, audit logging, RP ID validation | Small-Medium |

## Priority 4 — Verification/cleanup

| # | Item |
|---|------|
| 22 | Update stale `SPEC_IMPLEMENTATION_COMPLIANCE.md` + legacy `sogo6-server/.openspec/changes/*.change.md` trackers |
| 23 | Check `fakeApi` parity — ensure dev mocks match real backend schemas |
| 24 | Add tests for implemented stubs (folder rename, delegation, export) |

## Progress legend
- ✅ = implemented
- TODO = next up
- rest = backlog
