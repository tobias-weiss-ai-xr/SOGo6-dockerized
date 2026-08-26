# SOGo6 Threat Model (STRIDE)

**Date**: 2026-08-26
**Scope**: SOGo6-dockerized stack (Flask API, Next.js UI, Stalwart mail, MariaDB, Redis, OpenLDAP)
**Methodology**: STRIDE (Microsoft)
**Version**: 1.0

---

## Attack Surface Summary

```
┌──────────────┐    HTTPS     ┌──────────────┐    TCP      ┌──────────────┐
│   Internet   │◄──────────►│   Traefik    │◄──────────►│  SOGo6 UI   │
└──────────────┘             │  (reverse    │             │  (Next.js)   │
                             │   proxy)     │             └──────────────┘
                             └──────┬───────┘
                                    │
                            ┌───────▼───────┐
                            │  SOGo6 Server │
                            │  (Flask API)  │
                            └──┬──┬──┬──┬───┘
                               │  │  │  │
                    ┌──────────┘  │  │  └──────────┐
                    ▼             ▼  ▼             ▼
              ┌──────────┐ ┌──────┐ ┌──────┐ ┌──────────┐
              │ MariaDB  │ │Redis │ │LDAP  │ │ Stalwart │
              └──────────┘ └──────┘ └──────┘ └──────────┘
```

## STRIDE Analysis

### S — Spoofing (Identity Forgery)

| # | Threat | Impact | Existing Mitigations | Gap | Status |
|---|--------|--------|---------------------|-----|--------|
| S-1 | LDAP credential theft via plaintext capture | Account takeover | TLS in transit | — | ✅ Mitigated |
| S-2 | JWT token theft via XSS | Impersonation | HttpOnly cookies (if used), CSP now active | Token in localStorage (JS-readable) | ⚠️ Partial |
| S-3 | JWT forgery | Full impersonation | HMAC/RSA signing | No token rotation/refresh mechanism | ⚠️ Partial |
| S-4 | Session hijacking via network sniffing | Account takeover | TLS everywhere | — | ✅ Mitigated |
| S-5 | App password reuse across services | Lateral movement | Scoped to SOGo6 | — | ✅ Mitigated |

### T — Tampering (Data Integrity)

| # | Threat | Impact | Existing Mitigations | Gap | Status |
|---|--------|--------|---------------------|-----|--------|
| T-1 | Sieve filter manipulation to redirect mail | Mail interception | Auth required, filter ownership check | — | ✅ Mitigated |
| T-2 | Calendar event tampering (invite injection) | Social engineering | Auth required, attendee validation | — | ✅ Mitigated |
| T-3 | Mail body/subject CRLF injection | Header injection | JSON API (no raw SMTP from user) | — | ✅ Mitigated |
| T-4 | Database write via SQL injection | Data corruption | Parameterized queries (mysql.connector) | **INJ-04: LDAP injection payload → 500** (should be 401) | 🔴 Bug |

### R — Repudiation (Non-repudiation)

| # | Threat | Impact | Existing Mitigations | Gap | Status |
|---|--------|--------|---------------------|-----|--------|
| R-1 | Admin denies destructive action | Accountability gap | `ApiAuditLog.py` module exists | Hash chain integrity not verified; no SIEM format | ⚠️ Partial |
| R-2 | User deletes mail, denies sending it | Evidence loss | IMAP EXPUNGE is final | No mail-level audit trail | ⚠️ Partial |

### I — Information Disclosure

| # | Threat | Impact | Existing Mitigations | Gap | Status |
|---|--------|--------|---------------------|-----|--------|
| I-1 | IDOR on calendar/addressbook/mail | Data leak | JWT-scoped queries | No automated IDOR testing until now (ISO-01..06 added) | ✅ Now tested |
| I-2 | Admin sees user mail content | Privacy violation | Separate admin/user auth | Tested in ISO-06 | ✅ Tested |
| I-3 | Error messages reveal internal state | Reconnaissance | Generic error codes (S999999) | **INJ-04/10: unhandled LDAP errors leak 500** | 🔴 Bug |
| I-4 | LDAP data enumeration | User recon | Auth required for user API | — | ✅ Mitigated |
| I-5 | SBOM/dependency enumeration via package.json | Supply chain recon | Public repo (acceptable for OSS) | — | ✅ Accepted |

### D — Denial of Service

| # | Threat | Impact | Existing Mitigations | Gap | Status |
|---|--------|--------|---------------------|-----|--------|
| D-1 | Login brute force | Account lockout | IP rate limit (20/60s) | No global API rate limit | ⚠️ Partial |
| D-2 | API flood (non-login) | Service degradation | No global rate limit | **RL-04: only login endpoint has rate limiting** | ⚠️ Partial |
| D-3 | Oversized request body | Memory exhaustion | Nginx/Traefik body limits | 5MB JSON accepted (INJ-06) | ⚠️ Partial |
| D-4 | Slowloris / connection exhaustion | Service unavailability | Traefik timeout defaults | — | ✅ Mitigated |

### E — Elevation of Privilege

| # | Threat | Impact | Existing Mitigations | Gap | Status |
|---|--------|--------|---------------------|-----|--------|
| E-1 | User JWT accesses admin API | Privilege escalation | Separate auth system | Tested: AUTHZ-01 returns 404 | ✅ Tested |
| E-2 | User impersonates another user | Data access | JWT contains uid, server validates | No IDOR on user-specific endpoints (tested) | ✅ Tested |
| E-3 | Admin creates backdoor user | Persistence | Admin API is separate, logged | No approval workflow for admin actions | ⚠️ Partial |
| E-4 | WebAuthn bypass | MFA skip | Server-side challenge verification | MFA not enforced by default | ⚠️ Partial |

## Security Bugs Found During Testing

| ID | Bug | Severity | Status |
|----|-----|----------|--------|
| SEC-01 | `GET /admin/v1/approvals` → 500 (g.user None) | Medium | ✅ Fixed |
| SEC-02 | LDAP injection payload `*)(uid=*))(|` → 500 (should be 401) | **High** | 🔴 Open |
| SEC-03 | Cyrillic homoglyph `аdmin` in login → 500 (should be 401) | **High** | 🔴 Open |
| SEC-04 | Default admin password `admin` in shipped config | **Critical** | ✅ Fixed (startup guard) |
| SEC-05 | No security headers on live site | **High** | ✅ Fixed (Traefik middleware) |
| SEC-06 | Trivy CI gate `continue-on-error: true` | Medium | ✅ Fixed |

## Risk Acceptance

| Risk | Reason | Review Date |
|------|--------|-------------|
| JWT in localStorage (S-2) | Common pattern for SPAs; mitigated by CSP and short TTL | 2027-01 |
| No global API rate limit (D-2) | Traefik-level rate limiting can be added; login is the primary attack surface | 2027-01 |
| MFA not enforced (E-4) | Domain setting — operator decision; documented in process.conf | 2027-01 |
