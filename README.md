# SOGo 6 with Stalwart & OpenLDAP — Dockerized Test Environment

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker Compose](https://img.shields.io/badge/Docker%20Compose-v2.20+-2496ED?logo=docker&logoColor=fff)](docker-compose.yaml)
[![SOGo 6](https://img.shields.io/badge/SOGo%206-alpha-blueviolet)](https://www.sogo.nu/)
[![Playwright](https://img.shields.io/badge/Tests-Playwright-45ba4b?logo=playwright)](tests/)
[![GitHub](https://img.shields.io/github/stars/tobias-weiss-ai-xr/sogo6-stalwart-openldap-dockerized?style=social)](https://github.com/tobias-weiss-ai-xr/sogo6-stalwart-openldap-dockerized)

Docker Compose environment for evaluating [SOGo 6](https://www.sogo.nu/) — the next-generation groupware suite (Next.js + Python/Flask) with a full mail backend (Stalwart) and LDAP authentication (OpenLDAP).

## Architecture

```
┌──────────────────┐     ┌──────────────────┐
│  SOGo 6 UI       │     │  SOGo 6 Server   │
│  Next.js :3000   │◄───►│  Flask :5000     │
│  (React/TS)      │     │  (Python)        │
└──────────────────┘     └──────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
       ▼                       ▼                       ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  PostgreSQL  │      │    Redis     │      │    LDAP      │
│  (Database)  │      │   (Cache)    │      │  (Auth)      │
└──────────────┘      └──────────────┘      └──────────────┘
                                              ┌──────────────┐
                                              │   Stalwart   │
                                              │  (IMAP/SMTP) │
                                              └──────────────┘
```

### Services

| Service | Image | Role |
|---------|-------|------|
| `sogo6-ui` | `sogo6-ui:latest` (built from SOGo6-UI repo) | Next.js 16 frontend |
| `sogo6-server` | `sogo6-server:latest` (built from SOGo6-server repo) | Flask API backend |
| `sogo6-postgres` | `postgres:15-alpine` | Application database |
| `sogo6-redis` | `redis:7-alpine` | Session cache |
| `sogo6-ldap` | `sogo6-ldap:latest` (custom Debian OpenLDAP) | User authentication |
| `sogo6-stalwart` | `stalwartlabs/stalwart:v0.16.6` | IMAP/SMTP/Sieve mail backend |
| `sogo6-smtp` | `maildev/maildev:latest` | SMTP test interface (Maildev) |
| `sogo6-nginx` | `nginx:alpine` | Reverse proxy with TLS termination |

## Prerequisites

- Docker & Docker Compose v2
- Git
- ~2 GB free RAM

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

| Username | Password |
|----------|----------|
| testuser@example.org | `password123` |
| testadmin@example.org | `password123` |
| testuser2@example.org | `password123` |

### Access Points

| Service | URL |
|---------|-----|
| SOGo 6 UI | http://localhost:3000 |
| SOGo 6 API | http://localhost:5001/api/user/v1/system |
| Admin API | http://localhost:5001/api/admin/v1/ |
| Maildev (test SMTP) | http://localhost:1080 |
| Swagger | http://localhost:5001/swagger-basic |

## Project Structure

```
├── docker-compose.yaml            # Main compose file
├── .gitignore
├── README.md
├── sogo6/
│   ├── config/
│   │   ├── process.conf           # Server process settings
│   │   └── system_settings.json   # System configuration reference
│   ├── ldap/
│   │   ├── Dockerfile             # Debian OpenLDAP with seed data
│   │   ├── entrypoint.sh          # LDAP init with ulimit workaround
│   │   └── init.ldif              # Seed users (testuser, testadmin, testuser2)
│   ├── nginx/
│   │   └── nginx.conf             # Reverse proxy config
│   ├── stalwart/
│   │   └── config.json            # Stalwart PostgreSQL config
│   └── scripts/
│       ├── setup.sh               # Clone repos + build Docker images
│       ├── init-sogo6.sh          # Admin API initialization
│       ├── gen-certs.sh           # Self-signed TLS cert generator
│       ├── manage-secrets.sh      # Secrets vault generator/rotator
│       └── backup.sh              # Data volume backup
├── docs/
│   └── SOGO6-EVALUATION.md        # Evaluation and testing guide
└── tests/                         # E2E test directory
```

## Detailed Setup

### 1. Clone Repositories & Build Images

```bash
bash sogo6/scripts/setup.sh
```

This will:
- Clone https://github.com/tobias-weiss-ai-xr/SOGo6-UI
- Clone https://github.com/tobias-weiss-ai-xr/SOGo6-server
- Build Docker images for both
- Generate a secrets vault and self-signed TLS certificates

### 2. Start the Stack

```bash
docker compose up -d
```

Check health:
```bash
docker compose ps
```

### 3. Initialize the System

```bash
bash sogo6/scripts/init-sogo6.sh
```

This configures system settings, LDAP user source, domain defaults, and creates the `example.org` domain via the Admin API.

## Secrets Management

Sensitive values are stored in `secrets/sogo6.vault.env` (gitignored):

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

Install dependencies and run the Playwright E2E test suite:

```bash
cd tests
npm install
npm test
```

The test:
- Navigates to `http://localhost:3000`
- Logs in as `testuser@example.org` / `password123`
- Checks for calendar navigation
- Attempts event creation
- Saves screenshots to `tests/screenshots/`
- Outputs results to `tests/test-results-sogo6.json`

### Test Results

| Check | What It Validates |
|-------|-------------------|
| Login | Login form is present and credentials are accepted |
| Calendar | Calendar navigation link exists and is clickable |
| Events | New event modal can be opened and event saved |

## Backup

```bash
bash sogo6/scripts/backup.sh
```

## Troubleshooting

### OpenLDAP Crash on Modern Kernels

OpenLDAP's `ch_calloc` assertion fails when Docker sets high `ulimit -n`. The entrypoint script handles this with `ulimit -n 1024`.

### Port Conflicts

Edit port mappings in `docker-compose.yaml` if you have conflicts.

### Database Reset

```bash
docker compose down -v
docker compose up -d
```

## License

[MIT](LICENSE) © 2026 Tobias Weiß

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
Please ensure no internal hostnames, IPs, or secrets leak into commits.

This project adheres to a [Code of Conduct](.github/CODE_OF_CONDUCT.md).

## Related Repositories

- [SOGo6-UI](https://github.com/tobias-weiss-ai-xr/SOGo6-UI) — Next.js frontend
- [SOGo6-server](https://github.com/tobias-weiss-ai-xr/SOGo6-server) — Python/Flask backend
- [docker-sogo](https://github.com/tobias-weiss-ai-xr/docker-sogo) — SOGo 5 Docker image and Helm chart
- [Stalwart Mail Server](https://stalw.art/) — IMAP/SMTP backend
