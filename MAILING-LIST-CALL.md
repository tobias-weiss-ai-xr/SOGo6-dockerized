# SOGo6 Dockerized — Call for Feedback (Draft)

> ⚠️ **UNOFFICIAL — NOT FROM ALINTO**
>
> This project is an **independent, community-driven evaluation** of SOGo 6.
> It is **not affiliated with, endorsed by, or a product of Alinto** (the
> company behind SOGo). We are **not** speaking for the SOGo project —
> this is our own integration, deployment and feature work on top of the
> open SOGo 6 codebase.
>
> **Alinto is explicitly invited to incorporate any code, fixes or ideas
> from this work** into the official SOGo project — everything here is
> open source and we would be happy to contribute.

---

## Subject: [UNOFFICIAL] SOGo 6 Dockerized — independent evaluation deployment, feedback welcome

Hello everyone,

over the past months we have been evaluating **SOGo 6** — the next-generation
groupware suite (Next.js frontend + Flask/Python backend) — as an
**independent community effort**, completely separate from Alinto and the
official SOGo project. We would like to invite the community to test our
deployment and share feedback.

### What we built

**GitHub:** https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized

A fully containerized, production-oriented stack:

- SOGo 6 UI (Next.js 16) + SOGo 6 Server (Flask REST API, 355 endpoints)
- Stalwart as mail/IMAP/SMTP backend, OpenLDAP authentication
- PostgreSQL or MariaDB (selectable), Redis, nginx reverse proxy
- Optional observability: Prometheus, Grafana, Loki
- Helm chart for Kubernetes deployments

### Scale of the work

- **~282,000 lines of code** across backend (Python) and frontend (TypeScript)
- **7-tier roadmap 100% complete**: foundation (mail/calendar/contacts/CalDAV),
  admin & ecosystem (webhooks, OAuth/OIDC, PGP, audit, quotas, backup),
  team features (polls, slots, shared drafts, file sharing), workflows
  (approvals, helpdesk, CRM-light), AI features (smart calendar, spam filter,
  transcripts), vertical markets (SCIM, ActiveSync, JMAP, Matrix, HIPAA-grade
  encryption)
- **26 locales** with native translations
- **8,000+ automated tests**: 5,970 UI unit tests, 2,181 backend tests,
  148 shell tests, Playwright E2E
- **All 5 CI pipelines green** (lint, security scan, UI build+test, backend
  tests, k6 load tests)
- Versioned v0.1.0 → v1.0.0

### How it was built

The entire effort was driven by an **AI-assisted development loop**
(spec-driven via OpenSpec → implementation → tests → CI verification),
with the AI acting as auditor, architect, QA engineer and SRE — uncovering
and fixing 40+ runtime bugs, replacing stub implementations with real
protocols (JMAP, ActiveSync, CalDAV, SCIM), and hardening deployment.

### Where we'd especially appreciate feedback

1. **UX / workflow** — how does the new SOGo 6 web UI feel in daily use
   compared to SOGo 5?
2. **Migration** — CalDAV/CardDAV sync, Sieve rules, data import from
   existing setups
3. **Deployment** — Docker Compose vs. Kubernetes; anything rough or
   undocumented
4. **Missing features / regressions** — what should be prioritized next?

### Invitation to Alinto

All of this work is **open source and free to use**. Alinto and the official
SOGo team are warmly invited to **incorporate any code, fixes, or ideas**
into the official project — we'd be glad to open PRs or coordinate directly.
This is a community contribution, not a fork-and-forget.

Quick start is 4 commands (clone → configure `.env` → `docker compose up` →
init script). Issues and feature requests are welcome in the GitHub tracker;
detailed technical analysis is linked in the README (EN/DE blog posts).

We're looking forward to your feedback — praise and criticism equally
welcome! 🙂
