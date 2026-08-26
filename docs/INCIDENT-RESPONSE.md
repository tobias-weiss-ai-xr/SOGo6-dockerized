# Incident Response Playbook

**Version**: 1.0 | **Date**: 2026-08-26 | **Scope**: SOGo6-dockerized deployment
**CRA Reference**: Art. 11 (monitoring), Art. 17 (reporting obligations)

---

## Severity Classification

| Level | Name | Criteria | Response Time | Notification |
|-------|------|----------|---------------|--------------|
| **P1** | Critical | Active exploitation, data breach, service-wide outage | Acknowledge: 1h, Contain: 4h | ENISA/CSIRT within 24h, all stakeholders |
| **P2** | High | Vulnerability with known exploit (but not yet exploited), single-service degradation | Acknowledge: 4h, Fix: 7 days | Security team within 24h |
| **P3** | Medium | Vulnerability without known exploit, non-critical service issue | Fix in next release | Security team in weekly review |
| **P4** | Low | Informational finding, minor misconfiguration | Track and fix opportunistically | No immediate notification |

## Incident Response Flow

```
1. DETECT → 2. TRIAGE → 3. CONTAIN → 4. ERADICATE → 5. RECOVER → 6. REVIEW
```

### 1. Detection Sources
- Traefik access logs (rate: 429 spikes)
- SOGo6 structured JSON logs (level: ERROR, CRITICAL)
- Prometheus alerts (high error rate, high latency)
- External report (security.txt, GitHub Security Advisories)
- Automated security tests (Playwright e2e security suite)

### 2. Triage

```bash
# Check error rate
curl -s http://localhost:9090/api/v1/query?query=rate(http_requests_total{status=~"5..",job="sogo6"}[5m])

# Check rate limit triggers
docker logs sogo6-server 2>&1 | grep -c "rate.limited"

# Check auth failures
docker logs sogo6-server 2>&1 | grep -c "auth.login.failure"
```

### 3. Containment
- **Network**: Block IP at Traefik level
- **Account**: Disable user account via admin API
- **Service**: Scale down or isolate affected container
- **Data**: Snapshot MariaDB and Redis for forensic analysis

### 4. Eradication
- Apply security patch
- Rotate compromised credentials
- Update firewall rules

### 5. Recovery
- Restore from backup if needed
- Monitor for recurrence (24h)
- Verify all security tests pass

### 6. Review (Post-Incident)

- **Timeline**: What happened, when, and how was it detected?
- **Root cause**: 5-Whys analysis
- **Impact**: Users affected, data exposed, duration
- **Actions**: What was done to contain and fix?
- **Lessons**: What could be improved?
- **Follow-ups**: Tracked issues with owners and deadlines

## Art. 14(3) — ENISA/CSIRT Notification Template

When a vulnerability is being actively exploited (P1), notify the national CSIRT.
Use `scripts/notify-csirt.sh` to generate the notification document.

**Required fields**:
- Product: SOGo6 (groupware suite)
- Version: affected version(s)
- Vulnerability: CVE ID (if assigned)
- Exploitation status: confirmed/ suspected/ theoretical
- Affected deployments: list of known affected instances
- Mitigation: steps users can take
- Fix availability: patch version and download URL

## Contact

- Security issues: https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized/security/advisories/new
- Maintainer: https://tobias-weiss.org
- security.txt: https://sogo6.contextual-intelligence.org/.well-known/security.txt
