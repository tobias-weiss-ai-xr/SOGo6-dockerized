# CRA Readiness — EU Cyber Resilience Act (Regulation (EU) 2024/2847)

This document maps the project's security measures to the requirements of
the EU Cyber Resilience Act (CRA). It is a **living document** — updated as
the regulatory framework and our implementation evolve.

> ⚠️ This is an independent community project. CRA conformity assessment
> is a journey, not a destination: this document describes our *readiness
> posture* and is **not** a formal declaration of conformity (CE marking
> requires the manufacturer's conformity assessment procedure, which for
> open-source community software is a topic of active discussion).

---

## Requirement mapping

| CRA requirement (Annex I / Articles) | Status | Where / How |
|---|---|---|
| **Art. 13(1) — SBOM**: identify & document components, incl. dependencies | ✅ Generated in CI | Trivy CycloneDX SBOM for repo + all images (`sbom/` artifact) |
| **Art. 13(5) — Supply chain security**: secure dependency resolution, pins | ✅ | Lockfiles (`package-lock.json`, `poetry.lock`), pinned container tags, Trivy scans on every run |
| **Art. 14(1) — Vulnerabilities without fixes**: report & inform | ✅ | `SECURITY.md` — public policy, contact, 48h acknowledgment |
| **Art. 14(2) — Coordinated disclosure**: security.txt | ✅ (UI+API) | `/.well-known/security.txt` served by UI (static) and Server API |
| **Art. 14(3) — Actively exploited vulns → ENISA/CSIRT** | 🚧 Manual | Documented in `SECURITY.md`; automation pending |
| **Art. 14(4) — Security updates for expected lifetime (min. 5 years)** | 🚧 Policy | Supported-versions table in `SECURITY.md`; roadmap item |
| **Annex I(1)(a) — Secure by default** | ✅ | Empty passwords by default (no weak defaults), secrets via vault, NetworkPolicies (Helm), TLS optional but documented |
| **Annex I(1)(b) — Vulnerabilities from known exploitable states** | ✅ | Trivy HIGH/CRITICAL gate in CI, dependency updates in CI runs |
| **Annex I(1)(c) — Attack surface reduction** | ✅ | Minimal container images, non-root runtime where possible, no debug tooling in prod, hardened headers |
| **Annex I(1)(d) — Data protection** | ✅ | AES-256-GCM at-rest encryption (backend), TLS in transit, audit log with hash chain |
| **Annex I(1)(e) — Security updates mechanism** | 🚧 | Automated rebuilds; documented manual procedure |
| **Annex I(2)(a) — Authentication/authorization** | ✅ | JWT (user+admin), WebAuthn passkeys, MFA/TOTP, app passwords, SAML2/OIDC SSO, brute-force rate limiting |
| **Annex I(2)(b) — Confidentiality (encryption)** | ✅ | AES-256-GCM, PGP E2E mail, TLS everywhere |
| **Annex I(2)(c) — Integrity (tamper-evidence)** | ✅ | Tamper-evident audit log hash chain, SIEM export |
| **Annex I(2)(d) — Data minimization** | ✅ | Role-scoped API tokens, least-privilege DB users |
| **Annex I(2)(e) — Availability (DoS resistance)** | ✅ | k6 load tests, rate limiting, resource quotas |
| **Annex I(2)(f) — Limited attack surface** | ✅ | `--profile` selective service startup, no exposed debug ports |
| **Annex I(2)(g) — Minimized impact of incidents** | ✅ | Redis-backed queues, graceful degraded startup, healthchecks |
| **Annex I(3) — Incident monitoring** | ✅ | Prometheus metrics, structured JSON logs (Loki), audit log, health endpoints |
| **Art. 24 — Technical documentation** | 🚧 | README + architecture docs; formal CRA technical file pending |
| **Art. 30 — Conformity assessment (self-assessment for most software)** | 🚧 | Not claimed — see disclaimer above |

---

## What is implemented today (evidence)

- **SBOM**: CI job generates CycloneDX SBOMs (repo, server image, UI image)
  → uploaded as `sbom-*` artifacts. Regenerate locally with
  `bash scripts/generate-sbom.sh`.
- **Vulnerability scanning**: Trivy (HIGH/CRITICAL, `exit-code: 1`) on repo +
  server + UI Dockerfiles in `.github/workflows/test.yml`.
- **Coordinated disclosure**: `SECURITY.md` + `security.txt` (UI:
  `public/.well-known/security.txt`, API: `/security.txt` endpoint).
- **Audit trail**: tamper-evident hash chain + SIEM export (backend
  `ModuleAuditLog`).
- **At-rest encryption**: AES-256-GCM (HIPAA-grade) for sensitive fields.
- **AuthN/AuthZ breadth**: JWT, WebAuthn, TOTP, SAML2, OIDC, app passwords,
  rate limiting.
- **Secure defaults**: no default passwords, vault-managed secrets,
  NetworkPolicies in Helm chart.

## Open items (roadmap)

- [ ] Publish vulnerability-disclosure timeline metrics (time-to-fix)
- [ ] Automated ENISA/CSIRT notification workflow (Art. 14(3))
- [ ] Formal support-window / security-update commitment statement (Art. 14(4))
- [ ] Full technical file per Annex V (self-assessment workbook)
- [ ] Signing/checksums for release artifacts (integrity of updates)
- [ ] SBOM verification on deployment (fail on known-vuln components)

## Related documents

- `SECURITY.md` — vulnerability reporting policy & supported versions
- `.github/workflows/test.yml` — Trivy scans, SBOM generation
- `MAILING-LIST-CALL.md` — community discussion on CRA for open source
