# CRA Readiness — EU Cyber Resilience Act (Regulation (EU) 2024/2847)

This document maps the project's technical and organizational measures to
the requirements of the EU Cyber Resilience Act (CRA). It is a **living
document** — updated as the regulatory framework and our implementation
evolve.

> ⚠️ **Important — what this document is and is not:**
>
> CRA conformity is **not a technical feature**. It is a formal assessment
> that only the **manufacturer or the operating organization** can carry
> out: conformity assessment procedure, technical file (Annex V), CE
> marking, and reporting obligations (Art. 14(3), ENISA/CSIRT).
>
> This document therefore does **not** claim conformity. It describes the
> **technical and organizational groundwork** this project provides, so
> that an operator can complete the formal CRA conformity assessment with
> significantly less additional effort.

---

## Requirement mapping (prerequisite view)

Legend: ✅ = groundwork provided by this project · 🚧 = partially provided /
operator task · ⬜ = operator/manufacturer obligation (outside project scope)

| CRA requirement | Groundwork | Where / How |
|---|---|---|
| **Art. 13(1) — SBOM** | ✅ | CycloneDX SBOMs generated in CI for repo + images (`sbom/` artifact), plus `scripts/generate-sbom.sh` |
| **Art. 13(5) — Supply chain security** | ✅ | Lockfiles (`package-lock.json`, `poetry.lock`), pinned container tags, Trivy scans |
| **Art. 14(1) — Vulnerabilities without fixes** | ✅ | `SECURITY.md` — public policy, contact, 48h acknowledgment |
| **Art. 14(2) — Coordinated disclosure** | ✅ | RFC 9116 `security.txt` (UI static + API endpoint) |
| **Art. 14(3) — Actively exploited vulns → ENISA/CSIRT** | 🚧 | Process documented in `SECURITY.md`; reporting itself is an operator obligation, automation pending |
| **Art. 14(4) — Security updates for expected lifetime** | 🚧 | Supported-versions table in `SECURITY.md`; a formal multi-year commitment can only be made by a manufacturer/operator |
| **Annex I(1)(a) — Secure by default** | ✅* | Secrets via vault, NetworkPolicies (Helm), TLS documented. *Note: the sample `process.conf` ships `SOGO_P_ADMIN_PWD=admin` for local dev — operators MUST override via vault/env (see SECURITY.md) |
| **Annex I(1)(b) — Known exploitable states** | ✅ | Trivy HIGH/CRITICAL gate in CI, dependency updates |
| **Annex I(1)(c) — Attack surface reduction** | ✅ | Minimal container images, non-root where possible, no debug tooling in prod, hardened headers |
| **Annex I(1)(d) — Data protection** | ✅ | AES-256-GCM at-rest encryption, TLS in transit, audit log with hash chain |
| **Annex I(1)(e) — Security updates mechanism** | 🚧 | Automated rebuilds documented; operator runs the update process |
| **Annex I(2)(a) — Authentication/authorization** | ✅ | JWT, WebAuthn passkeys, MFA/TOTP, app passwords, SAML2/OIDC SSO, rate limiting |
| **Annex I(2)(b) — Confidentiality (encryption)** | ✅ | AES-256-GCM, PGP E2E mail, TLS |
| **Annex I(2)(c) — Integrity (tamper-evidence)** | ✅ | Tamper-evident audit log hash chain, SIEM export |
| **Annex I(2)(d) — Data minimization** | ✅ | Role-scoped API tokens, least-privilege DB users |
| **Annex I(2)(e) — Availability (DoS resistance)** | ✅ | k6 load tests, rate limiting, resource quotas |
| **Annex I(2)(f) — Limited attack surface** | ✅ | `--profile` selective service startup, no exposed debug ports |
| **Annex I(2)(g) — Minimized impact of incidents** | ✅ | Redis-backed queues, graceful degraded startup, healthchecks |
| **Annex I(3) — Incident monitoring** | ✅ | Prometheus metrics, structured JSON logs (Loki), audit log, health endpoints |
| **Art. 24 — Technical documentation** | 🚧 | README + architecture docs; the formal CRA technical file is an operator/manufacturer deliverable |
| **Art. 30 — Conformity assessment** | ⬜ | Operator/manufacturer obligation — explicitly not claimed here |

---

## What the project actually provides (evidence)

- **SBOM**: CycloneDX SBOMs in CI (repo, server image, UI image) →
  uploaded as `sbom-*` artifacts; regenerate with
  `bash scripts/generate-sbom.sh`.
- **Vulnerability scanning**: Trivy (HIGH/CRITICAL, `exit-code: 1`) on repo
  + server + UI Dockerfiles in `.github/workflows/test.yml`.
- **Coordinated disclosure**: `SECURITY.md` + `security.txt` (UI:
  `public/.well-known/security.txt`, API: `/.well-known/security.txt` +
  `/security.txt`).
- **Audit trail**: tamper-evident hash chain + SIEM export (backend
  `ModuleAuditLog`).
- **At-rest encryption**: AES-256-GCM for sensitive fields.
- **AuthN/AuthZ breadth**: JWT, WebAuthn, TOTP, SAML2, OIDC, app passwords,
  rate limiting.
- **Secrets management**: vault-based generation (`manage-secrets.sh`),
  exported to the environment for Compose — never committed.

## What remains for the operator (honest list)

- [ ] Conformity assessment per Art. 30 + technical file per Annex V
- [ ] CE marking and declaration of conformity
- [ ] ENISA/CSIRT notification workflow (Art. 14(3))
- [ ] Formal support-window / security-update commitment (Art. 14(4))
- [ ] Overriding the sample admin password (`SOGO_P_ADMIN_PWD=admin`) in any
      non-dev deployment
- [ ] Signing/checksums for release artifacts
- [ ] SBOM verification on deployment (fail on known-vuln components)
- [ ] Vulnerability-disclosure timeline metrics (time-to-fix)

## Related documents

- `SECURITY.md` — vulnerability reporting policy & supported versions
- `.github/workflows/test.yml` — Trivy scans, SBOM generation
- `MAILING-LIST-CALL.md` — community discussion on CRA for open source
