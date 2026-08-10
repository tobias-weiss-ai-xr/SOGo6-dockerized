# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 6.x     | ✅ Active development |
| < 6.0   | ❌ Not supported |

## Reporting a Vulnerability

**Do not open public issues for security vulnerabilities.**

Instead, report security issues via email to the maintainers.

### What to include:
- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Suggested fix (if known)

### What happens next:
1. We acknowledge receipt within 48 hours
2. We investigate and develop a fix
3. We release a patch and notify reporters

## Security Best Practices

### Environment Variables
- Never commit `.env` files with real secrets
- Use strong random passwords: `openssl rand -base64 24`
- Rotate secrets regularly

### Network Security
- The stack includes NetworkPolicies (Helm chart) for Kubernetes
- Default-deny policy restricts pod-to-pod communication
- TLS is configurable via ingress annotations

### Authentication
- SCIM API requires `SCIM_BEARER_TOKEN` environment variable
- Inter-service communication requires `INTERCOM_SHARED_SECRET`
- All passwords default to empty (no weak defaults)
