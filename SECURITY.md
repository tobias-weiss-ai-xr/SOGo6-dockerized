# Security Policy

This policy follows the principles of the **EU Cyber Resilience Act
(Regulation (EU) 2024/2847, Art. 14)** — coordinated vulnerability
disclosure, clear reporting channels, and security update commitments.
See `CRA-READINESS.md` for the full requirement mapping.

## Supported Versions

| Version | Supported | Security updates |
|---------|-----------|------------------|
| 6.x (v1.0.0+) | ✅ Active development | ✅ Free security patches |
| < 6.0 | ❌ Not supported | ❌ |

**Security update commitment:** while this is a community project, we
commit to fixing HIGH/CRITICAL vulnerabilities with a security patch
release as soon as a fix is available (target: within 30 days of a
reported, verified vulnerability). There is no end-of-life for the 6.x
line planned.

## Reporting a Vulnerability

**Do not open public issues for security vulnerabilities.**

Report security issues privately via email to the maintainers. We also
serve `security.txt` (RFC 9116) — see
`https://<deployment>/.well-known/security.txt` (UI) and
`/security.txt` (API).

### What to include
- Description of the vulnerability
- Steps to reproduce (or proof of concept)
- Affected versions / components
- Potential impact
- Suggested fix (if known)

### Coordinated disclosure timeline (CRA Art. 14(2))
1. **≤ 48 h** — acknowledgment of receipt
2. **≤ 30 days** — verification & fix development (HIGH/CRITICAL)
3. **≤ 60 days** — patch release + notification of reporter
4. **Public disclosure** — only after the reporter has been informed and
   a fix is available (default: 90 days after report, coordinated)

### Actively exploited vulnerabilities (CRA Art. 14(3))
If we become aware of an actively exploited vulnerability in the
deployed stack, we will notify the relevant national CSIRT and ENISA as
required by applicable law (EU 2024/2847 Art. 14(3)).

## Security Best Practices

### Environment Variables
- Never commit `.env` files with real secrets
- Use the vault: `bash sogo6/scripts/manage-secrets.sh`
- Use strong random passwords: `openssl rand -base64 24`
- Rotate secrets regularly

### Network Security
- The stack includes NetworkPolicies (Helm chart) for Kubernetes
- Default-deny policy restricts pod-to-pod communication
- TLS is configurable via ingress annotations (self-signed certs in dev)

### Authentication
- SCIM API requires `SCIM_BEARER_TOKEN` environment variable
- Inter-service communication requires `INTERCOM_SHARED_SECRET`
- All passwords default to empty (no weak defaults)
- MFA/TOTP, WebAuthn passkeys, SAML2/OIDC SSO available

### Data Protection
- At-rest encryption: AES-256-GCM for sensitive fields
- In transit: TLS (nginx), internal service auth via shared secrets
- Audit log with tamper-evident hash chain + SIEM export

## Supply Chain (CRA Art. 13)

- **SBOMs**: CycloneDX SBOMs generated in CI and on demand
  (`bash scripts/generate-sbom.sh`) — see `sbom/` artifacts
- **Dependency scanning**: Trivy on every CI run (repo + images)
- **Lockfiles**: `package-lock.json`, `poetry.lock` pin exact versions
- **Image tags**: pinned, not `latest`, in production deployments

## Contact

- **Primary**: GitHub private vulnerability report
  https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized/security/advisories/new
  (recommended — includes automated SBOM/dependency context)
- **Maintainer**: https://tobias-weiss.org (blog & contact)
