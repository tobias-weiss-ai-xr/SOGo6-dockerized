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
| 10 | Student Groups — real LDAP/SIS sync | `ApiStudentGroups` | |
| 11 | Donor Management — real EIN/donor store | `ApiDonorManagement` | Replace placeholder EIN |
| 12 | Matrix Chat — real homeserver federation | `ApiMatrixChat` | `_sign_matrix_event` is fake |
| 13 | Backup automation — real DB dump + retention + S3 | `ApiBackup` | |
| 14 | Audit log — real tamper-proof log + SIEM export | `ApiAuditLog` | |
| 15 | Usage quotas — real quota enforcement | `ApiUsageQuotas` | |
| 16 | Health dashboard — real service checks | `ApiHealthDashboard` | |
| 17 | Webhooks — verify delivery (retry, HMAC, dispatch loop) | `WebhookService` | ✅ DONE (2026-08-08): sync `dispatch` + non-blocking `dispatch_event` (daemon threads), per-hook delivery stats, real emission from ModuleCalendar / ModuleContact / ModuleAdminUser, API detail/PATCH/toggle/test endpoints, URL-scheme gate; 10 new tests |
| 18 | `orm.py` placeholders (`Acl`, `db_session`) | `app/orm.py` | Remove once imports cleaned |

## Priority 3 — Missing spec items

| # | Spec | Gap | Effort |
|---|------|-----|--------|
| 19 | api-playground | Serve `/docs` + `/docs/openapi.json` (spec names) with JWT auto-populate, dark mode, version selector | Medium |
| 20 | caldav-server | 95 unchecked requirements (draft spec) — full RFC 4791 server | Large |
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
