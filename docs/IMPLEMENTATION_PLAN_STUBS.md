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
| 7 | JMAP — implement Email/get, Mailbox/get against real mail store | `ApiJmapProtocol` | Protocol-level; larger effort |
| 8 | ActiveSync — real WBXML encoding (pywbxml) | `ApiActiveSync._eas_wbxml_response` | |
| 9 | SCIM provisioning — real user source integration | `ApiScimProvisioning` | Currently Redis cache only |
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
