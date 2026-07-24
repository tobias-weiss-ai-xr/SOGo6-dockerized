# SOGo 6 with Stalwart & OpenLDAP — Dockerized Test Environment

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/tobias-weiss-ai-xr/sogo6-stalwart-openldap-dockerized/actions/workflows/test.yml/badge.svg)](https://github.com/tobias-weiss-ai-xr/sogo6-stalwart-openldap-dockerized/actions/workflows/test.yml)
[![Tests](https://img.shields.io/badge/Tests-129%20shell%20%2B%2034%20Python-success?logo=github)](tests/)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-45ba4b?logo=playwright)](tests/sogo6-e2e-test.js)
[![Docker](https://img.shields.io/badge/Stack-8%20services-2496ED?logo=docker)](docker-compose.yaml)
[![Dependabot](https://img.shields.io/badge/Dependabot-enabled-025E8C?logo=dependabot)](.github/dependabot.yml)
[![GitHub](https://img.shields.io/github/stars/tobias-weiss-ai-xr/sogo6-stalwart-openldap-dockerized?style=social)](https://github.com/tobias-weiss-ai-xr/sogo6-stalwart-openldap-dockerized)

Docker Compose environment for evaluating [SOGo 6](https://www.sogo.nu/) — the next-generation groupware suite (Next.js + Python/Flask) with a full mail backend (Stalwart) and LDAP authentication (OpenLDAP).

- **Blog post**: [SOGo 6 Evaluation: A Technical Deep Dive](https://graphwiz.ai/blog/sogo6-evaluation)
- **Related**: [docker-sogo](https://github.com/tobias-weiss-ai-xr/docker-sogo) — production-ready SOGo 5 Docker image & Helm chart

## Architecture

```
┌──────────────────┐     ┌──────────────────┐
│  SOGo 6 UI       │     │  SOGo 6 Server   │
│  Next.js :3000   │◄───►│  Flask :5000     │
│  (React/TS)      │     │  (Python)        │
└──────────────────┘     └──────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  PostgreSQL  │      │    Redis     │      │   OpenLDAP   │
│  (Database)  │      │   (Cache)    │      │  (Auth)      │
└──────────────┘      └──────────────┘      └──────┬───────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │   Stalwart   │
                                            │  (IMAP/SMTP  │
                                            │   /Sieve)    │
                                            └──────────────┘
```

All services are orchestrated via Docker Compose. A reverse proxy (Nginx) fronts the UI and API with TLS termination.

### Services

| Service | Image | Role | Health Check |
|---------|-------|------|--------------|
| `sogo6-ui` | `sogo6-ui:latest` (built) | Next.js 16 frontend | Wget /env |
| `sogo6-server` | `sogo6-server:latest` (built) | Flask API backend | Curl /api/user/v1/system |
| `sogo6-postgres` | `postgres:15-alpine` | Application database | pg_isready |
| `sogo6-redis` | `redis:7-alpine` | Session cache | Redis PING |
| `sogo6-ldap` | `sogo6-ldap:latest` (built) | User authentication | LDAP search base DN |
| `sogo6-stalwart` | `stalwartlabs/stalwart:v0.16.6` | IMAP/SMTP/Sieve mail server | HTTP /healthz/live |
| `sogo6-smtp` | `maildev/maildev:latest` | SMTP test interface | HTTP port 1080 |
| `sogo6-nginx` | `nginx:alpine` | Reverse proxy + TLS termination | Curl localhost |

## Prerequisites

- Docker & Docker Compose v2.20+
- Git
- ~2 GB free RAM (tested on 1 GB DigitalOcean droplet)

## Quick Start

```bash
# 1. Clone and build SOGo 6 components
bash sogo6/scripts/setup.sh

# 2. Start the stack
docker compose up -d

# 3. Initialize system configuration
bash sogo6/scripts/init-sogo6.sh

# 4. Access the UI
open http://localhost:3000
```

### Test Users

| Username | Password | Role |
|----------|----------|------|
| testuser@example.org | `password123` | Standard user |
| testadmin@example.org | `password123` | Admin (LDAP sogoAdminRole) |
| testuser2@example.org | `password123` | Standard user |

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| SOGo 6 UI | http://localhost:3000 | Next.js frontend |
| SOGo 6 API | http://localhost:5001/api/user/v1/system | Public REST API |
| Admin API | http://localhost:5001/api/admin/v1/auth/login | Admin management API |
| Swagger Basic | http://localhost:5001/swagger-basic | User API docs |
| Swagger Admin | http://localhost:5001/swagger-admin | Admin API docs |
| Maildev | http://localhost:1080 | SMTP test web UI |
| Nginx | https://localhost | Reverse proxy (self-signed TLS) |

## Project Structure

```
├── docker-compose.yaml              # Main compose file
├── .github/
│   ├── dependabot.yml               # Automated dependency updates
│   ├── CODE_OF_CONDUCT.md
│   └── workflows/
│       └── test.yml                 # CI pipeline (lint → build → test)
├── sogo6/
│   ├── config/
│   │   ├── process.conf             # Server process settings
│   │   └── system_settings.json     # System configuration reference
│   ├── ldap/
│   │   ├── Dockerfile               # Debian OpenLDAP with seed data
│   │   ├── entrypoint.sh            # LDAP init with ulimit workaround
│   │   └── init.ldif                # Seed users (testuser, testadmin, testuser2)
│   ├── nginx/
│   │   └── nginx.conf               # Reverse proxy config
│   ├── stalwart/
│   │   └── config.json              # Stalwart PostgreSQL config
│   └── scripts/
│       ├── setup.sh                 # Clone repos + build Docker images
│       ├── init-sogo6.sh            # Admin API initialization
│       ├── gen-certs.sh             # Self-signed TLS cert generator
│       ├── manage-secrets.sh        # Secrets vault generator/rotator
│       └── backup.sh                # Data volume backup
├── docs/
│   └── SOGO6-EVALUATION.md          # Evaluation and testing guide
└── tests/
    ├── run-all-tests.sh             # Test suite orchestrator
    ├── config.sh                    # Shared test configuration
    ├── api-test.sh                  # API health + auth + negative tests (15 checks)
    ├── api-write-test.sh            # Admin API read operations (7 checks)
    ├── smtp-test.sh                 # SMTP/IMAP/Sieve protocol tests (14 checks)
    ├── ldap-test.sh                 # LDAP user verification tests (6 checks)
    ├── docker-test.sh               # Container health + network tests (6 checks)
    ├── postgres-test.sh             # PostgreSQL schema + connectivity tests (6 checks)
    ├── nginx-test.sh                # Reverse proxy + TLS tests (8 checks)
    ├── redis-test.sh                # Redis PING/SET/GET + info tests (7 checks)
    ├── integration-test.sh          # Cross-service integration tests (9 checks)
    ├── security-test.sh             # Security hardening checks (12 checks)
    ├── script-test.sh               # Config/script integrity checks (15 checks)
    ├── sogo6-e2e-test.js            # Playwright E2E (6 suites, optional)
    ├── package.json
    └── integration/
        ├── test_stack.py            # Python integration tests (36 tests, optional)
        └── requirements.txt
```

## Detailed Setup

### 1. Clone Repositories & Build Images

```bash
bash sogo6/scripts/setup.sh
```

This will:
- Clone [SOGo6-UI](https://github.com/tobias-weiss-ai-xr/SOGo6-UI) and [SOGo6-server](https://github.com/tobias-weiss-ai-xr/SOGo6-server)
- Build Docker images for both
- Generate a secrets vault and self-signed TLS certificates
- Build the custom OpenLDAP image with seed users

### 2. Start the Stack

```bash
docker compose up -d
```

Wait for all services to become healthy:

```bash
docker compose ps
```

### 3. Initialize the System

```bash
bash sogo6/scripts/init-sogo6.sh
```

This configures system settings, LDAP user source, domain defaults, and creates the `example.org` domain via the Admin API.

### 4. Verify the Stack

```bash
# Check all 7-8 services are healthy
bash tests/docker-test.sh

# Verify API responds
bash tests/api-test.sh

# Run the full test suite
bash tests/run-all-tests.sh
```

## Secrets Management

Sensitive values are stored in `secrets/sogo6.vault.env` (gitignored, auto-generated):

```bash
# Generate vault (first time)
bash sogo6/scripts/manage-secrets.sh

# List masked secrets
bash sogo6/scripts/manage-secrets.sh --list

# Print as docker-compose env_file format
bash sogo6/scripts/manage-secrets.sh --env-file
```

## TLS Certificates

Self-signed certificates are auto-generated to `sogo6/nginx/certs/` (gitignored):

```bash
bash sogo6/scripts/gen-certs.sh
```

Replace these with real certificates for production-like testing.

## Admin API

```bash
# Login
curl -sk http://localhost:5001/api/admin/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'

# Use JWT token for subsequent calls
TOKEN="eyJ..."
curl -sk http://localhost:5001/api/admin/v1/config/system \
  -H "Authorization: Bearer $TOKEN"
```

## Running Tests

The test suite covers the full stack: API, mail protocols, LDAP, database, infrastructure, and security. All shell tests are dependency-free (bash + curl + openssl only).

### Quick Start

```bash
cd tests
bash run-all-tests.sh
```

### Shell Test Suites (129 checks, zero dependencies)

| Test Suite | Checks | What It Validates |
|------------|--------|-------------------|
| `docker-test.sh` | 6 | Container health, restarts, uptime, network connectivity |
| `api-test.sh` | 15 | SOGo API health, swagger, admin login, all 3 user logins, negative tests (wrong pw, invalid user, empty creds, invalid JWT, missing content-type, unauth access) |
| `api-write-test.sh` | 7 | Admin config read (system, domains, LDAP, SMTP, export), version info |
| `smtp-test.sh` | 14 | SMTP port & EHLO, submission port, email send, IMAP port & login, Sieve port, SMTPS/IMAPS, MailDev web UI, TLS protocol version |
| `ldap-test.sh` | 6 | LDAP reachability, test users present, user count, mail attributes |
| `postgres-test.sh` | 6 | PostgreSQL connectivity, database exists, table count, server version, connection count, user table check |
| `nginx-test.sh` | 8 | HTTP/HTTPS reachable, proxy to API, TLS certificate, security headers, static files |
| `redis-test.sh` | 7 | Redis PING, SET/GET, server version, memory usage, connected clients, key count |
| `integration-test.sh` | 9 | Admin token flow, LDAP config, domain-api match, profile email, container DNS, CORS headers, API timing, cross-service health, API version |
| `security-test.sh` | 12 | Port exposure, container user, TLS cert validity, key permissions, config file permissions, port listing, secrets in processes, error leakage, passwords in responses, Docker security options, hostname uniqueness |
| `script-test.sh` | 15 | Config file existence, script executability, shebangs, docker-compose validation, JSON validity, process.conf required keys, cert-key modulus match, bash syntax, file encoding, README sections |

### Python Integration Tests (34 tests, requires pytest + psycopg2)

Covers API health, auth, negative scenarios, admin operations, mail port connectivity, service accessibility, PostgreSQL schema, Redis PING, NGINX proxy, and rate limiting.

```bash
pip install -r tests/integration/requirements.txt
SOGO_INTEGRATION_TESTS=1 python3 -m pytest tests/integration/ -v --tb=short
```

### Playwright E2E Tests (optional, requires Node.js)

Six test suites: API health, multi-user login, UI navigation (when available), mail features (via MailDev API), calendar features, and logout behavior.

```bash
cd tests
npm install
npm test              # Headless
npm run test:headed   # With browser window
```

Each step saves a screenshot to `tests/screenshots/`. Results are written to `tests/test-results-sogo6.json`.

## Continuous Integration

The [GitHub Actions workflow](.github/workflows/test.yml) runs on every push and pull request:

1. **Lint** — ShellCheck on all scripts
2. **Build** — Clone SOGo6-UI/Server, generate secrets & certs, build Docker images
3. **Deploy** — Start stack with `docker compose up --wait`
4. **Initialize** — Run `init-sogo6.sh`
5. **Test** — All shell test suites + Python integration tests
6. **Report** — Upload test reports as artifacts
7. **Diagnose** — On failure, dump service logs

## Dependency Updates

[Dependabot](.github/dependabot.yml) automatically checks for updates weekly:

- **Docker**: Base images in docker-compose.yaml
- **npm**: Playwright and dependencies
- **pip**: Python test dependencies
- **GitHub Actions**: CI workflow actions

## Backup

```bash
bash sogo6/scripts/backup.sh
```

Creates a timestamped archive of all Docker volumes to `./backups/`.

## Troubleshooting

### OpenLDAP Crash on Modern Kernels

OpenLDAP's `ch_calloc` assertion fails when Docker sets high `ulimit -n`. The entrypoint script handles this with `ulimit -n 1024`.

### Port Conflicts

Edit port mappings in `docker-compose.yaml` if you have conflicts. The server port `5001` maps to internal `5000`.

### Database Reset

```bash
docker compose down -v
docker compose up -d
```

### Services Not Becoming Healthy

Run the init script after all containers start:

```bash
docker compose up -d --wait --wait-timeout 180
bash sogo6/scripts/init-sogo6.sh
```

## License

[MIT](LICENSE) © 2026 Tobias Weiß

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Please ensure no internal hostnames, IPs, or secrets leak into commits.

This project adheres to a [Code of Conduct](.github/CODE_OF_CONDUCT.md).

## Related Repositories

- [SOGo6-UI](https://github.com/tobias-weiss-ai-xr/SOGo6-UI) — Next.js frontend
- [SOGo6-server](https://github.com/tobias-weiss-ai-xr/SOGo6-server) — Python/Flask backend
- [docker-sogo](https://github.com/tobias-weiss-ai-xr/docker-sogo) — SOGo 5 Docker image and Helm chart
- [Stalwart Mail Server](https://stalw.art/) — IMAP/SMTP backend
