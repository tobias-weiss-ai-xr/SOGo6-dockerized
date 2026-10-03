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

## Subject: [UNOFFICIAL] SOGo 6 Dockerized — a friendly community evaluation, come play with us 🙂

Hello everyone!

Some of you may know SOGo 6 is on its way — a fresh Next.js frontend with a
Flask/Python backend. As a small group of enthusiasts, we couldn't wait and
started tinkering: integrating, extending, hardening, and deploying it in a
fully containerized stack. It's been a lot of fun, and we'd love for you to
join us!

👉 **Repo:** https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized

*(Please note: this is a completely independent community effort — not
affiliated with Alinto. All code is open source, and Alinto is warmly invited
to take anything they like from it. Consider it a gift from the community. 💚)*

### What's inside

- **SOGo 6 UI** (Next.js 16) + **SOGo 6 Server** (Flask REST API, 355 endpoints)
- **Stalwart** mail/IMAP/SMTP, **OpenLDAP** authentication
- **PostgreSQL or MariaDB** (your choice), Redis, nginx
- Optional **Prometheus / Grafana / Loki** observability
- **Helm chart** for Kubernetes folks

### Some numbers (we're a bit proud 😊)

- ~282,000 lines of code, 7-tier roadmap **100% complete** — from mail,
  calendar & contacts to webhooks, PGP, SCIM, ActiveSync, JMAP, AI features
  and HIPAA-grade encryption
- **26 languages** with native translations
- **8,000+ automated tests** (5,970 UI, 2,181 backend, 148 shell, E2E)
- **5 green CI pipelines** — lint, security scan, UI build+test, backend
  tests, k6 load tests
- Versioned v0.1.0 → v1.0.0

### Why we're writing — and where you come in

**1. Try it!** Four commands and you're running: clone → `.env` → `docker
compose up` → init. Then tell us: how does it *feel*? What's missing? What
breaks? What's brilliant?

**2. The CRA elephant in the room 🐘** — We're actively thinking about the
**EU Cyber Resilience Act**: by the time the CRA obligations fully apply
(2027), software used in **big organizations and public institutions** will
need to be demonstrably secure — think **CE marking for software, SBOMs,
coordinated vulnerability disclosure, and guaranteed security updates**.

To be clear about what we do and don't claim: **CRA conformity is not a
technical feature.** It is a formal assessment that only the manufacturer
or operating organization can carry out (conformity assessment, technical
file, CE marking, ENISA/CSIRT reporting obligations). An open-source
community project cannot declare itself "CRA-compliant".

What we *can* offer — and what we're building — is the **technical and
organizational groundwork** that makes CRA conformity significantly less
costly for whoever operates the stack: SBOM generation in CI (CycloneDX),
Trivy vulnerability scanning, hardened containers, structured audit
logging with tamper-evident hash chains, a coordinated-disclosure policy
(SECURITY.md + security.txt), and a documented update process. The
operator still has to do the formal conformity work — but ideally without
starting from zero. We'd love to discuss:

- What does **CRA readiness** realistically mean for an open-source
  groupware stack like this, and where exactly does the operator's
  responsibility begin?
- Which **procurement requirements** are your organizations already seeing
  (SBOM requests? security questionnaires? conformity assessments)?
- How should a community project support **security update commitments**
  and **vulnerability disclosure** without a commercial backing?

**3. Migration stories** — CalDAV/CardDAV sync, Sieve rules, importing data
from existing setups. What worked, what hurt?

**4. Deployment war stories** — Docker Compose vs. Kubernetes. What's rough?
What's undocumented? We'll fix it.

### For Alinto specifically 💌

If you're reading this: thank you for SOGo 6 — it's a great foundation! We've
fixed bugs, implemented missing pieces, and documented everything. All of it
is yours to take: open PRs, cherry-pick, or just steal ideas. We'd love to
coordinate and contribute upstream properly.

---

*No pressure, no sales pitch — just a friendly invitation to test, break,
and improve something we enjoy building. Praise and criticism are equally
welcome. Come say hi in the GitHub issues!* 🙌
