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

# 3. Start the stack
docker compose -f docker-compose.dev.yaml up -d

# 4. Initialize system
bash sogo6/scripts/init-sogo6.sh

# 5. Open the UI
open http://localhost:3000
```

Or use the Makefile:

```bash
make setup     # Step 2
make start-dev # Step 3
make init      # Step 4
```

### Test Users

| Username | Password | Role |
|----------|----------|------|
| `testuser@example.org` | `password123` | Standard |
| `testadmin@example.org` | `password123` | Admin |
| `testuser2@example.org` | `password123` | Standard |

## Services

### Core (always running)

| Service | Image | Role |
|---------|-------|------|
| `sogo6-ui` | `sogo6-ui:dev` (built) | Next.js 16 frontend |
| `sogo6-server` | `sogo6-server:dev` (built) | Flask API backend |
| `sogo6-postgres` | `postgres:15-alpine` | Application database |
| `sogo6-redis` | `redis:7-alpine` | Session cache + Celery broker |
| `sogo6-ldap` | `sogo6-ldap:dev` (built) | User authentication (OpenLDAP) |
| `sogo6-stalwart` | `stalwartlabs/stalwart:v0.16.6` | IMAP/SMTP/Sieve mail server |
| `sogo6-smtp` | `maildev/maildev` | SMTP test web UI |
| `sogo6-nginx` | `nginx:alpine` | Reverse proxy + TLS |

### Optional (`make dev-<name>`)

| Service | Profile | Ports | Credentials |
|---------|---------|-------|-------------|
| `sogo6-agent` | `agent` | — | Celery async job worker |
| `sogo6-minio` | `minio` | `9000` (API), `9001` (Console) | `minioadmin` / `minioadmin` |
| `sogo6-mariadb` | `db-alternative` | `3306` | `sogo` / `sogo` |
| `sogo6-prometheus` + `sogo6-grafana` | `monitoring` | `9090`, `3001` | `admin` / `password123` |
| LDAP admin tools | `ldap-tools` | `8081`–`8084` | — |

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
