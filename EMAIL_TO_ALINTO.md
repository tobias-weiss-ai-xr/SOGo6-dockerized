# Email to Alinto — Draft

**Subject:** SOGo 6 Community Fork — Feature Completion & Enhancements

**To:** Alinto team (hello@alinto.com or appropriate contact)

---

Hello Alinto team,

I've been working with the SOGo 6 codebase (both `sogo6-server` and `SOGo6-UI`) and wanted to share the results of a substantial feature development effort. I've packaged the stack with Docker Compose (Stalwart mail server + OpenLDAP) and implemented all major roadmap features plus significant additions.

## Repository

https://github.com/tobias-weiss-ai-xr/sogo6-stalwart-openldap-dockerized
Branch: `dev` (39 commits)

## What Was Built

### Core SOGo 6 Features (from original roadmap)
- Full mail stack — send, read, folders, search, bulk operations, Sieve filters
- Calendar — CRUD, events, tasks, reminders, free/busy, external iCal sync
- Contacts — address books, contacts, distribution lists, collected addresses
- Admin panel — user CRUD (LDAP), domain settings, system settings, session management
- Multi-language — English, German, French, Spanish (~2,100 strings each)
- Production Dockerfiles — multi-stage, non-root, healthcheck

### New Features Added
- **Shibboleth/SAML2 + OIDC SSO** — full OIDC Relying Party and SAML2 Service Provider (discovery, token exchange, RS/ES signature validation, RP-initiated logout, SP metadata, auto-provisioning on first login)
- **MFA/TOTP** — time-based one-time passwords with QR provisioning, integrated into the login flow
- **App Passwords** — `sogo-ap-<64-hex>` tokens with bcrypt hashing, CRUD + verify endpoint (for Thunderbird/desktop clients)
- **Password Recovery** — token lifecycle, rate-limited, SMTP relay via Stalwart
- **Auth Hardening** — Redis-backed brute-force protection, per-IP rate limiting, security headers (CSP, HSTS, etc.), CORS hardening
- **Calendar + Contact Sharing** — DB-backed share tables, ACL engines (VIEW/MODIFY/DELETE for calendars, VIEW/MODIFY for contacts), frontend share dialogs
- **CardDAV Sync Engine** — SSRF-protected HTTPS fetcher, vCard diff-by-UID, insert/update/delete, Redis locking, sync status management
- **Theme Settings** — DB-stored HSL colors + logo URL + custom CSS with live public CSS endpoint
- **Rules CRUD** — DB-backed Sieve rules with full admin create/read/update/delete
- **Observability** — Prometheus `/metrics`, structured JSON logging, enhanced health endpoint (PostgreSQL/LDAP/Redis/Stalwart dependency checks)
- **CI/CD** — GitHub Actions with build, test, Playwright E2E (23 tests), k6 load tests, sync benchmark

## Test Coverage

| Suite | Pass | Details |
|-------|------|---------|
| Backend Python | 1,723 | Module, interface, API, E2E, SMTP |
| Frontend Jest | 69 | Admin pages, user settings, a11y |
| Admin API (bash) | 29 | All admin endpoints |
| Playwright E2E | 23 | Auth, admin, navigation, settings |
| k6 Load Tests | 100% | 3 suites, 0% errors, ~25ms p95 |
| **Total** | **>1,800** | |

## Architecture

The stack runs 7 Docker services:
- **SOGo6 UI** (Next.js 14 standalone)
- **SOGo6 Server** (Flask/Python 3.14)
- **PostgreSQL** (main database)
- **Redis** (cache + rate limiting + sync locking)
- **OpenLDAP** (user directory)
- **Stalwart** (IMAP/SMTP/Sieve mail server)
- **NGINX** (reverse proxy)

## Next Steps

I believe this fork could serve as a reference implementation or starting point for the broader SOGo 6 ecosystem. Key areas I'd love feedback on:

1. The SSO implementation (OIDC + SAML) — is this aligned with your internal plans?
2. The MFA/TOTP login flow integration — we integrated code verification directly into the existing `POST /login` endpoint rather than a separate challenge flow
3. Any interest in upstreaming the sharing infrastructure (calendar + contact ACL engines)?

Happy to discuss any part of the implementation in more detail.

Best regards,
Tobias Weiss

---

*Note: This is a community fork. Not affiliated with Alinto SAS.*
