# SOGo 6 — Groupware Suite (Stalwart + OpenLDAP)

[![Tests](https://img.shields.io/badge/Tests-passing-success?logo=github)](.github/workflows/test.yml)
[![K6](https://img.shields.io/badge/Load%20Tests-k6-7d64ff?logo=k6)](tests/load/)
[![Helm](https://img.shields.io/badge/Helm-v3-0F1689?logo=helm)](helm/sogo6/)
[![Loki](https://img.shields.io/badge/Logs-Loki-F19734?logo=grafana)](sogo6/loki/)

Docker-based deployment of **SOGo 6** — the next-generation groupware suite (Next.js + Flask/Python) with Stalwart mail server, OpenLDAP authentication, and full observability stack.

- **Blog (EN)**: [Technical Deep Dive](https://tobias-weiss.org/content/devops/sogo6-evaluation-technical-deep-dive)
- **Blog (DE)**: [Evaluierung — Technische Analyse](https://tobias-weiss.org/content/devops/sogo6-evaluierung-technische-analyse)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Ingress (Nginx/K8s)              │
└────────┬────────────────────────────────┬───────────┘
         │ /api                            │ /
         ▼                                 ▼
┌─────────────────┐               ┌─────────────────┐
│  SOGo 6 Server  │◄─────────────►│   SOGo 6 UI     │
│  Flask (Python) │    REST API   │  Next.js 16     │
│  :5000          │               │  :3000           │
└──┬──┬──┬──┬─────┘               └─────────────────┘
   │  │  │  │
   │  │  │  └──────────────────────────┐
   │  │  └──────────────┐              │
   ▼  ▼                 ▼              ▼
┌──────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Redis │ │PostgreSQL│ │OpenLDAP  │ │ Stalwart │
│Cache │ │ MariaDB  │ │  (Auth)  │ │Mail/IMAP │
│      │ │ (Choose) │ │          │ │  /SMTP   │
└──────┘ └──────────┘ └──────────┘ └──────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Monitoring (optional)                   │
│  Prometheus ─ Grafana ─ Loki ─ Promtail              │
│  Metrics      Dashboards   Logs     Collector        │
└─────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Clone with submodules
git clone --recurse-submodules https://github.com/tobias-weiss-ai-xr/sogo6-stalwart-openldap-dockerized.git
cd sogo6-stalwart-openldap-dockerized

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set:
#   LDAP_ADMIN_PASSWORD, PG_PASSWORD/MARIADB_PASSWORD, INTERCOM_SHARED_SECRET

# 3. Generate TLS certs and start (MariaDB - default)
bash sogo6/scripts/gen-certs.sh
docker compose --profile mail-stalwart --profile db-mariadb --profile auth-ldap up -d --build

# 4. Initialize SOGo (creates DB tables + default config)
bash sogo6/scripts/init-sogo6.sh

# 5. Open the UI
open http://localhost:3000
```

**Minimal** (SOGo only — bring your own DB, mail, auth):
```bash
docker compose up -d
```

**PostgreSQL** instead of MariaDB:
```bash
docker compose --profile mail-stalwart --profile db-postgres --profile auth-ldap up -d
```

📖 **Database Switch Guide**: See [`docs/guides/DATABASE_SWITCH.md`](docs/guides/DATABASE_SWITCH.md) for detailed instructions on switching between PostgreSQL and MariaDB.

## Profiles

| Profile | What it adds | Command |
|---------|-------------|---------|
| `mail-stalwart` | Stalwart IMAP/SMTP/Sieve | `docker compose --profile mail-stalwart up -d` |
| `db-mariadb` | MariaDB (default database) | `docker compose --profile db-mariadb up -d` |
| `db-postgres` | PostgreSQL (alternative) | `docker compose --profile db-postgres up -d` |
| `auth-ldap` | OpenLDAP user directory | `docker compose --profile auth-ldap up -d` |
| `nginx` | Nginx reverse proxy + TLS | `docker compose --profile nginx up -d` |
| `agent` | Celery async job worker | `docker compose --profile agent up -d` |
| `minio` | S3-compatible object storage | `docker compose --profile minio up -d` |
| `monitoring` | Prometheus + Grafana + Loki | `docker compose --profile monitoring up -d` |

### Database Selection

The database is controlled by **one file**: `sogo6/config/process.conf`. Edit it to switch:

```bash
# 1. Stop everything
docker compose down -v

# 2. Edit process.conf — uncomment ONE database section:
vi sogo6/config/process.conf

#   For MariaDB (default):
#     SOGO_P_DB_TYPE=MySQL
#     SOGO_P_DB_HOST=sogo6-mariadb
#     SOGO_P_DB_PORT=3306

#   For PostgreSQL:
#     SOGO_P_DB_TYPE=PostgreSQL
#     SOGO_P_DB_HOST=sogo6-postgres
#     SOGO_P_DB_PORT=5432

# 3. Start with the matching profile

# MariaDB:
docker compose --profile mail-stalwart --profile db-mariadb --profile auth-ldap up -d
# or: make start

# PostgreSQL:
docker compose --profile mail-stalwart --profile db-postgres --profile auth-ldap up -d
# or: make start-alt

# 4. Initialize SOGo
bash sogo6/scripts/init-sogo6.sh
```

⚠️ **Important**: Always `docker compose down -v` when switching — the process.conf is mounted read-only into the container. Only enable ONE database profile at a time.

## Features

### All Roadmap Features Complete

**Foundation**: CalDAV sync, WebAuthn passkeys, Swagger API, Sieve editor, DKIM/DMARC/SPF wizard

**Groupware**: Mail (send/read/search/filters/vacation/forward/snooze), Calendar (CRUD/iMIP/free-busy/sharing/subscriptions), Contacts (vCard/CardDAV/sharing)

**Admin**: System config, domain/rule/user management, DNS wizard, theme/branding, backup, DB migration, audit log, usage quotas, webhooks, approval workflows, helpdesk, CRM-light, workflow builder

**AI/Intelligence**: Smart calendar, spam filter, meeting transcripts, scheduling polls, appointment slots

**Collaboration**: Shared drafts, file sharing, resource booking, collaborative document editing (Collabora)

## Deployment Options

### Docker Compose (local/production)
Full production stack with 8+ services. See `docker-compose.yaml`.

### Kubernetes (Helm)
```bash
helm upgrade --install sogo6 helm/sogo6 \
  --set secrets.postgresPassword="..." \
  --set secrets.ldapAdminPassword="..." \
  --set secrets.intercomSharedSecret="..." \
  --set secrets.scimBearerToken="..."
```
See `helm/sogo6/` for all options (6 services, autoscaling, network policies, monitoring).

### Remote Deployment
```bash
cd deploy/mariadb-e2e
./deploy-remote.sh --host vhrz2392
```

### E2E Test Suite
```bash
cd deploy/mariadb-e2e
docker compose up -d
./run-e2e-tests.sh
```
Supports any target host: `./run-e2e-tests.sh --host vhrz2392`

## Observability

### Metrics (Prometheus)
All services expose `/metrics` endpoints. Enable with `--profile monitoring`.

### Logs (Loki)
Structured JSON logs auto-parsed by Promtail (extracts `request_id`, `user`, `domain`, `level`).
Grafana datasource with `request_id` derived fields for log→trace correlation.

### Load Testing (k6)
```bash
bash tests/load/run.sh                # Full suite
bash tests/load/run.sh --k6-only      # HTTP load only
bash tests/load/run.sh --quick        # Sync benchmark only
```

## Project Structure

```
├── sogo6-server/         # Flask/Python backend (submodule)
├── sogo6-ui/             # Next.js frontend (submodule)
├── docker-compose.yaml   # Production stack
├── helm/sogo6/           # Kubernetes Helm chart
├── deploy/mariadb-e2e/   # MariaDB E2E test suite
├── sogo6/                # Service configs
│   ├── loki/             #  Loki/Promtail configuration
│   ├── grafana/          #  Grafana datasource provisioning
│   └── prometheus/       #  Prometheus rules, alerts, dashboards
├── tests/                # Integration & load tests
│   ├── load/             #  k6 performance tests
│   └── e2e/              #  Playwright browser tests
└── docs/                 # Documentation
```

## CI Pipeline

`.github/workflows/test.yml`:

1. **Trivy** — Vulnerability scanning (HIGH/CRITICAL)
2. **ShellCheck** — Shell script linting
3. **UI Build & Test** — Jest (550+ tests) + Next.js build
4. **Full Stack E2E** — Docker compose → API tests → Playwright → k6 load tests
5. **Artifacts** — Test reports, k6 JSON summaries, Docker logs

## Environment Variables

See `.env.example` for all options. **Required**:

| Variable | Purpose |
|----------|---------|
| `LDAP_ADMIN_PASSWORD` | OpenLDAP admin password |
| `PG_PASSWORD` | PostgreSQL password |
| `INTERCOM_SHARED_SECRET` | Inter-service HMAC signing |
| `SCIM_BEARER_TOKEN` | SCIM API bearer token |
| `SOGO_AES_ENC_KEY` | AES encryption key (32 chars) |

## Development

```bash
# Dev stack with hot reload
docker compose up -d --build

# Tests
cd sogo6-ui && npx jest        # Frontend
cd sogo6-server && pytest       # Backend
bash tests/run-all-tests.sh     # Full stack
bash tests/load/run.sh          # Performance

# Shell access
docker compose exec sogo6-server bash
docker compose exec sogo6-ui sh
docker compose exec sogo6-postgres psql -U sogo
```

## License

MIT
