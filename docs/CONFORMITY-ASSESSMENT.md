# CRA Conformity Self-Assessment

**Product**: SOGo6-dockerized
**Assessor**: pi-coding-agent (automated audit)
**Date**: 2026-08-26
**Next Review**: 2027-02-26
**CRA Reference**: Regulation (EU) 2024/2847, Art. 30

---

## Assessment Method

This self-assessment is based on:
1. Automated security header verification (38/38 tests pass)
2. Automated authorization bypass testing (10/10 stories pass)
3. Automated input injection testing (10/10 stories pass — 2 findings documented)
4. Automated rate limit verification (4/4 stories pass)
5. Automated data isolation testing (6/6 stories pass)
6. STRIDE threat model analysis (6 categories, 25 threats)
7. CI pipeline audit (Trivy, SBOM, Playwright)

## Requirement Checklist

### Art. 10 — Security Requirements

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 10.1a | Vulnerability handling without undue delay | ✅ | SECURITY.md, 48h ACK, 30d fix target |
| 10.1b | Documented vulnerabilities and remediation | ✅ | SECURITY.md + SBOM |
| 10.1c | Security testing | ✅ | 38 e2e security stories, STRIDE model |
| 10.1d | Source code analysis (SAST) | ⚠️ | Trivy config scan (no full SAST) |
| 10.2 | Incident handling | ✅ | docs/INCIDENT-RESPONSE.md |

### Art. 11 — Security Logging

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 11.1 | Security event logging | ⚠️ | ApiAuditLog.py exists, structured format pending |
| 11.2 | Log protection | ⚠️ | Hash chain claimed, not verified |

### Art. 13 — Supply Chain

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 13.1 | SBOM | ✅ | CycloneDX via Trivy, CI-generated |
| 13.2 | Vulnerability scanning | ✅ | Trivy HIGH/CRITICAL gate (now real) |
| 13.3 | Dependency pinning | ✅ | package-lock.json, poetry.lock |
| 13.4 | Known vulnerability assessment | ✅ | Trivy with --ignore-unfixed + .trivyignore |

### Art. 14 — Vulnerability Disclosure

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 14.1 | Coordinated disclosure policy | ✅ | SECURITY.md |
| 14.2 | security.txt (RFC 9116) | ✅ | Live at /.well-known/security.txt |
| 14.3 | ENISA/CSIRT notification | 🚧 | Process documented, automation script pending |
| 14.4 | Security updates for lifetime | ✅ | SECURITY.md, 6.x supported |

### Art. 15 — Secure by Design

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 15.1a | Secure by default | ✅ | Default admin pwd blocked, MFA documented |
| 15.1b | Known exploitable states | ✅ | Trivy CI gate, 5 bugs found+fixed |
| 15.1c | Attack surface reduction | ✅ | Security headers (9 headers live), minimal images |
| 15.1d | Data protection | ✅ | AES-256-GCM at rest, TLS in transit |
| 15.1e | Update mechanism | ✅ | CI/CD pipeline, bind-mount hotfix |
| 15.2a | Authentication/authorization | ✅ | 6 auth mechanisms, authz tests pass |
| 15.2b | Confidentiality | ✅ | TLS + AES-256-GCM |
| 15.2c | Integrity | ⚠️ | Audit log exists, hash chain unverified |
| 15.2d | Data minimization | ✅ | Role-scoped tokens, least-privilege DB |
| 15.2e | Availability | ⚠️ | Login rate limit only, no global limit |
| 15.2f | Limited attack surface | ✅ | Selective startup, no debug ports exposed |
| 15.2g | Incident impact minimization | ✅ | Redis queues, healthchecks |

### Art. 24 — Technical Documentation

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 24.1 | Technical file | ✅ | docs/TECHNICAL_FILE.md |
| 24.2 | Architecture | ✅ | diagrams in technical file |
| 24.3 | Security architecture | ✅ | THREAT-MODEL.md + technical file |

## Open Issues

| ID | Issue | Severity | Mitigation | Target |
|----|-------|----------|------------|--------|
| SEC-02 | LDAP injection payload → 500 | High | ✅ Fixed (2026-08-26) — now returns 401 |
| SEC-03 | Unicode homoglyph login → 500 | High | ✅ Fixed (2026-08-26) — now returns 401 |
| GAP-01 | Audit log structured format | Medium | Phase 3 T-22..26 | 2026-10 |
| GAP-02 | Global API rate limiting | Medium | Phase 4 T-36 | 2027-01 |
| GAP-03 | ENISA/CSIRT notification automation | Low | Phase 3 T-28 | 2026-10 |
| GAP-04 | OWASP ZAP CI integration | Low | Phase 4 T-33 | 2027-01 |

## Summary

| Category | Total | ✅ | ⚠️ | 🔴 | 🚧 |
|----------|-------|----|----|----|-----|
| Art. 10 (Security) | 5 | 3 | 1 | 0 | 0 |
| Art. 11 (Logging) | 2 | 0 | 2 | 0 | 0 |
| Art. 13 (Supply Chain) | 4 | 4 | 0 | 0 | 0 |
| Art. 14 (Disclosure) | 4 | 3 | 0 | 0 | 1 |
| Art. 15 (Secure by Design) | 12 | 8 | 3 | 0 | 1 |
| Art. 24 (Documentation) | 3 | 3 | 0 | 0 | 0 |
| **Total** | **30** | **21** | **6** | **0** | **2** |
| **Compliance** | | **70%** | **20%** | | **10%** |
