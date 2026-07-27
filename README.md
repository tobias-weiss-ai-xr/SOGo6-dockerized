# SOGo 6 with Stalwart & OpenLDAP — Dockerized Test Environment

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-145%20shell%20%2B%2034%20Python-success?logo=github)](tests/)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-45ba4b?logo=playwright)](tests/sogo6-e2e-test.js)
[![Docker](https://img.shields.io/badge/Stack-8%20services-2496ED?logo=docker)](docker-compose.dev.yaml)

Docker Compose environment for [SOGo 6](https://www.sogo.nu/) — the next-generation groupware suite (Next.js + Python/Flask) with Stalwart mail server and OpenLDAP authentication.

- **Blog**: [Technical Deep Dive](https://tobias-weiss.org/content/devops/sogo6-evaluation-technical-deep-dive) ([DE](https://tobias-weiss.org/content/devops/sogo6-evaluierung-technische-analyse))
- **Related**: [docker-sogo](https://github.com/tobias-weiss-ai-xr/docker-sogo) — SOGo 5 Docker image & Helm chart

## Architecture

```
┌──────────────┐     ┌──────────────┐
│  SOGo 6 UI   │     │SOGo 6 Server │
│  Next.js     │◄───►│  Flask       │
│  :3000       │     │  :5000       │
└──────────────┘     └──┬───┬───┬───┘
                        │   │   │
              ┌─────────┘   │   └──────────┐
              ▼             ▼              ▼
       ┌──────────┐  ┌──────────┐  ┌──────────────┐
       │PostgreSQL│  │  Redis   │  │  OpenLDAP    │
       │(MariaDB) │  │ (Cache)  │  │  (Auth)      │
       └──────────┘  └──────────┘  └──────┬───────┘
                                          │
                                          ▼
                                  ┌──────────────┐
                                  │  Stalwart    │
                                  │ IMAP/SMTP/   │
                                  │ Sieve        │
                                  └──────────────┘
```

Nginx reverse proxy fronts the UI and API with TLS termination. Optional: Celery agent for async jobs, MinIO for file storage.

## Quick Start

```bash
# 1. Clone with submodules
git clone --recurse-submodules https://github.com/tobias-weiss-ai-xr/sogo6-stalwart-openldap-dockerized.git
cd sogo6-stalwart-openldap-dockerized

# 2. Generate secrets & certs, build images
bash sogo6/scripts/setup.sh

# 3. Start the stack (Stalwart + PostgreSQL + LDAP)
docker compose --profile mail-stalwart --profile db-postgres --profile auth-ldap up -d

# 4. Initialize system
bash sogo6/scripts/init-sogo6.sh
bash sogo6/scripts/init-sogo6.sh  # second run applies domain config

# 5. Open the UI
open http://localhost:3000
```

Or use the Makefile:

```bash
make setup     # Step 2
make start     # Step 3 (same as start-full)
make init      # Step 4
```

### Modular Profiles

Pick your infrastructure by enabling compose profiles:

| Stack | Command | When to use |
|-------|---------|-------------|
| **Full (default)** | `make start` or `docker compose --profile mail-stalwart --profile db-postgres --profile auth-ldap up -d` | All-in-one evaluation |
| **Stalwart + MariaDB** | `docker compose --profile mail-stalwart --profile db-mariadb --profile auth-ldap up -d` | MariaDB instead of PostgreSQL |
| **Minimal** | `docker compose up -d` | Only core SOGo — bring your own DB, mail, auth |
| **Your own mail** | `docker compose --profile db-postgres --profile auth-ldap up -d` | Use Exim/Dovecot/… externally, just need SOGo's DB |

**Available profiles:**

| Profile | Services |
|---------|----------|
| `mail-stalwart` | Stalwart (IMAP + SMTP + Sieve) |
| `db-postgres` | PostgreSQL (default application DB) |
| `db-mariadb` | MariaDB (alternative DB) |
| `auth-ldap` | OpenLDAP (user directory) |
| `nginx` | Nginx reverse proxy (optional, access SOGo directly on :3000 / :5001) |
| `agent` | Celery async job worker |
| `minio` | S3-compatible object storage |
| `monitoring` | Prometheus + Grafana |

**Bring your own (BYO) services** — set these environment variables:

```bash
# Your own database
SOGO_DB_URI=postgresql://user:pass@your-db:5432/sogo

# Your own IMAP/SMTP
SOGO_D_IMAP_SERVER=your-imap-host
SOGO_D_SMTP_SERVER=your-smtp-host

# Your own LDAP / OIDC
SOGO_LDAP_URI=ldap://your-ldap:389
```

Set these in a `.env` file or pass them inline.

### Test Users

| Username | Password | Role |
|----------|----------|------|
| `testuser@example.org` | `password123` | Standard |
| `testadmin@example.org` | `password123` | Admin |
| `testuser2@example.org` | `password123` | Standard |

## Services

### Core (always running)

| Service | Role |
|---------|------|
| `sogo6-ui` | Next.js frontend |
| `sogo6-server` | Flask API backend |
| `sogo6-redis` | Session cache + Celery broker |

### Profile-gated infrastructure

Pick what you need by enabling compose profiles:

| Profile | Service | Role |
|---------|---------|------|
| `mail-stalwart` | `sogo6-stalwart` | IMAP/SMTP/Sieve mail server |
| `db-postgres` | `sogo6-postgres` | PostgreSQL application database |
| `db-mariadb` | `sogo6-mariadb` | MariaDB alternative database |
| `auth-ldap` | `sogo6-ldap` | OpenLDAP user authentication |
| `nginx` | `sogo6-nginx` | Reverse proxy + TLS termination |
| `agent` | `sogo6-agent` | Celery async job worker |
| `minio` | `sogo6-minio` | S3-compatible object storage |
| `monitoring` | `sogo6-prometheus`, `sogo6-grafana` | Prometheus metrics + Grafana dashboards |

### For your specific setup (Exim + Dovecot + MariaDB)

You only need:
```bash
docker compose --profile nginx --profile db-mariadb up -d
```

Then configure SOGo's domain settings via Admin API to point to your:
- **IMAP:** Dovecot server + port
- **SMTP:** Exim server + port
- **Auth:** Dovecot's LDAP or SQL auth (or configure SOGo's SQL user source)

The SOGo server connects to your existing services like any other mail client.

### Access Points

| URL | Service |
|-----|---------|
| http://localhost:3000 | SOGo 6 UI (Next.js) |
| http://localhost:5001/api/user/v1/health | REST API health |
| http://localhost:5001/api/admin/v1/auth/login | Admin API login |
| http://localhost:5001/swagger-basic | Swagger (user API) |
| http://localhost:5001/swagger-admin | Swagger (admin API) |
| http://localhost:1080 | Maildev (SMTP test) |
| https://localhost | Nginx reverse proxy |

## Features

### Tier 0 – Foundation

| # | Feature | Status |
|---|---------|--------|
| 1 | **CalDAV Sync** — SSRF-protected fetcher with PROPFIND discovery, sync engine with Redis locking, diff-by-UID pipeline | ✅ |
| 2 | **Shared Mailboxes** — CRUD + member management API, auto-created DB table | ✅ |
| 3 | **WebAuthn / Passkeys** — browser credential API, registration dialog, security settings | ✅ |
| 4 | **Swagger API Playground** — custom UI with auth token helper, Nginx proxying | ✅ |
| 5 | **Sieve Editor UI** — visual filter builder in user settings, admin rules CRUD | ✅ |
| 6 | **DKIM/DMARC/SPF Wizard** — DNS record generation/validation API (`/admin/dns/*`) | ✅ |

### Authentication

- LDAP password auth, Shibboleth/OIDC SSO, SAML2 SSO
- MFA/TOTP, WebAuthn/Passkeys, App Passwords
- Password recovery / self-service password reset
- Brute-force protection, IP rate limiting

### Groupware

- **Mail**: send, read, folders, search, bulk ops, Sieve filters, vacation/forward/notification rules
- **Calendar**: CRUD events/tasks, iMIP scheduling, free/busy, sharing with ACL, subscriptions (ICS + CalDAV)
- **Contacts**: address books, vCard import/export, CardDAV sync, sharing with ACL

### Admin

- System config, domain management, user provisioning, rules, sessions, theme settings
- DNS Wizard for email authentication (SPF/DKIM/DMARC record generation + validation)
- Prometheus `/metrics`, structured JSON logging

## Database Backends

PostgreSQL is the default. Switch to MariaDB/MySQL:

```bash
# Start MariaDB (profile: db-alternative)
make dev-db-alternative

# Set env vars on sogo6-server:
#   SOGO_P_DB_TYPE=MySQL
#   SOGO_P_DB_PORT=3306
#   SOGO_P_DB_HOST=sogo6-mariadb
#   SOGO_DB_URI=mysql://sogo:sogo@sogo6-mariadb:3306/sogo
```

Both PostgreSQL and MySQL/MariaDB clients are fully implemented (`ClientPostgreSQL.py`, `ClientMySQL.py`).

## Project Structure

```
├── sogo6-ui/          ◀─ git submodule (SOGo6-UI, branch dev)
├── sogo6-server/      ◀─ git submodule (SOGo6-server, branch dev)
├── sogo6/
│   ├── config/        # process.conf, system_settings.json
│   ├── ldap/          # Dockerfile, seed LDIF
│   ├── nginx/         # nginx.conf, TLS certs
│   ├── stalwart/      # Stalwart config (PostgreSQL backend)
│   └── scripts/       # setup, init, gen-certs, backup
├── docker-compose.dev.yaml   # Development stack
├── docker-compose.yaml       # Production stack
├── Makefile                  # Orchestration targets
└── tests/                    # Shell + Python + Playwright tests
```

## Development

```bash
# Start full dev stack with debugging tools
make dev-debug

# Optional infrastructure
make dev-agent       # Celery async job worker
make dev-minio       # S3-compatible object storage
make dev-monitoring  # Prometheus + Grafana

# Shell access
make dev-shell-server    # Server container
make dev-shell-ui        # UI container
make dev-shell-postgres  # psql
make dev-shell-redis     # redis-cli

# Tests
make test-smoke   # Quick smoke (API + SMTP + LDAP)
make test         # Full shell test suite
make test-full    # All tests including Python integration
make test-e2e     # Playwright E2E tests
```

The dev stack uses mounted source code with hot reload (Flask debug + Next.js fast refresh).

## Project Status

- **~1,800 tests passing** (1,723 Python + 69 Jest + 29 bash + 23 Playwright)
- **Submodules**: `sogo6-server` (15+ commits on dev), `sogo6-ui` (9 commits on dev)
- **Stack**: 7 core + 4 optional Docker services
- **License**: MIT

## Related

- [SOGo6-UI](https://github.com/tobias-weiss-ai-xr/SOGo6-UI) — Next.js frontend fork
- [SOGo6-server](https://github.com/tobias-weiss-ai-xr/SOGo6-server) — Flask backend fork
- [docker-sogo](https://github.com/tobias-weiss-ai-xr/docker-sogo) — SOGo 5 Docker/Helm
- [Stalwart Mail Server](https://stalw.art/) — IMAP/SMTP backend
