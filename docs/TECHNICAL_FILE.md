# Technical Documentation — Art. 24 / Annex V

**Product**: SOGo6-dockerized groupware suite
**Version**: 6.x (v1.0.0+)
**Date**: 2026-08-26
**CRA Reference**: Regulation (EU) 2024/2847, Art. 24

---

## 1. Product Description and Intended Use

SOGo6 is an open-source groupware suite providing email, calendar, contacts, and task management. The dockerized deployment packages:

- **SOGo6 Server** (Python/Flask REST API + JMAP)
- **SOGo6 UI** (Next.js React single-page application)
- **Stalwart** (SMTP/IMAP/ManageSieve mail server)
- **OpenLDAP** (user directory)
- **MariaDB** (data persistence)
- **Redis** (cache, sessions, job queue)
- **Traefik** (reverse proxy, TLS termination)

**Intended use**: University department email and collaboration. Multi-tenant via domain isolation.
**Not intended for**: Classified/military data, PCI-DSS cardholder data, medical records (HIPAA).

## 2. Architecture

```
┌──────────────┐     HTTPS/TLS     ┌──────────────┐
│   Client    │◄──────────────────►│   Traefik    │
│  (Browser)  │                    │  (Ingress)   │
└──────────────┘                    └──────┬───────┘
                                          │
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                   ┌──────────┐   ┌──────────┐   ┌──────────┐
                   │   UI     │   │  Server  │   │  Stalwart│
                   │ (Next.js)│   │ (Flask)  │   │ (SMTP)   │
                   │  :3000   │   │  :5000   │   │  :25,587 │
                   └──────────┘   └──┬──┬──┬──┘   └──────────┘
                                      │  │  │
                               ┌──────────┘  │  └──────────┐
                               ▼             ▼             ▼
                         ┌──────────┐ ┌──────┐ ┌──────────┐
                         │ MariaDB  │ │Redis │ │  LDAP    │
                         │  :3306   │ │:6379 │ │  :389    │
                         └──────────┘ └──────┘ └──────────┘
```

## 3. Security Architecture

### Authentication
- **User auth**: LDAP bind → JWT (signed, configurable TTL)
- **Admin auth**: Separate credential store (process settings)
- **MFA**: WebAuthn passkeys, TOTP, SAML2/OIDC SSO
- **App passwords**: Scoped, revocable tokens for external clients

### Encryption
- **In transit**: TLS 1.2+ (Let's Encrypt via Traefik, HSTS preload)
- **At rest**: AES-256-GCM for sensitive fields (via SOGO_AES_ENC_KEY)

### Authorization
- Role-based: admin vs user, domain-scoped
- JWT-scoped: user identity in token, server validates on every request
- IDOR tested: 6 data isolation tests verify cross-user boundary

### Audit
- Structured JSON logging (configurable)
- `ApiAuditLog` module with admin API access

## 4. Standards Applied

| Standard | Application |
|----------|-------------|
| OWASP Top 10 (2021) | Security test suite covers injection, authz, rate limiting |
| RFC 9116 | security.txt for vulnerability disclosure |
| RFC 6749 / 7636 | OAuth 2.0 / PKCE for SSO integration |
| RFC 8176 | WebAuthn / FIDO2 |
| ISO 27001 | Partial alignment (access control, encryption, audit) |
| CycloneDX 1.6 | SBOM format |

## 5. Test Coverage

- **Unit tests**: 184 pytest files in `sogo6-server/tests/`
- **E2E tests**: 265+ Playwright specs (38 security, 22 epic, 898 endpoint-matrix, 70 other)
- **Security tests**: 38 stories across 5 spec files
- **CI**: GitHub Actions — Trivy scan, SBOM generation, pytest, Playwright
- **Badge**: `[![Security](https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized/actions/workflows/test.yml/badge.svg)](...)`

## 6. SBOM

- **Generator**: `scripts/generate-sbom.sh` (Trivy)
- **Format**: CycloneDX JSON
- **CI**: Generated on every push to main/dev
- **Artifacts**: `sbom/` directory, GitHub Actions artifact upload

## 7. Known Limitations and Accepted Risks

See `docs/THREAT-MODEL.md` → Risk Acceptance table.

Key items:
- JWT stored in localStorage (mitigated by CSP, short TTL)
- No global API rate limiting (login-only, 20/60s per IP)
- MFA not enforced by default (operator choice via domain settings)
- Two open security bugs: SEC-02 (LDAP injection → 500), SEC-03 (homoglyph → 500)

## 8. Installation and Configuration

See `README.md` and `.env.example`.

Critical security steps:
1. Set `SOGO_P_ADMIN_PWD` to a strong password (server refuses to start otherwise)
2. Set `SOGO_AES_ENC_KEY` (32 chars) for at-rest encryption
3. Set `SOGO_P_VOUCHER_SECRET` for voucher signing
4. Enable MFA via admin API: `POST /api/admin/v1/config/domain` with `SOGO_D_LOGIN_MFA_FORCE: true`

## 9. Support and Update Commitment

See `SECURITY.md` → Supported Versions.

- **Active**: 6.x (v1.0.0+)
- **Security patches**: Best-effort, target 30 days for HIGH/CRITICAL
- **End of life**: None planned for 6.x
