# Contributing to SOGo 6

## Development Setup

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized.git
cd SOGo6-dockerized

# Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set LDAP_ADMIN_PASSWORD, MARIADB_PASSWORD,
# SOGO_P_VOUCHER_SECRET (32 chars), SOGO_SECRET_KEY, SOGO_LDAP_BIND_PASSWORD

# Generate secrets + TLS certs
make secrets
make certs

# Start full stack (Stalwart + MariaDB + LDAP)
make start

# Initialize SOGo (creates DB tables + default config)
make init

# Open the UI
open http://localhost:3000
```

## Project Structure

```
├── sogo6-server/          # Flask/Python backend (submodule)
│   ├── app/
│   │   ├── api/           # REST API endpoints (Flask-RESTful)
│   │   ├── manager/       # DB, cache, LDAP, mail clients
│   │   ├── module/        # Business logic modules
│   │   └── utils/         # Shared utilities
│   └── tests/             # 296 pytest files
├── sogo6-ui/              # Next.js frontend (submodule)
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # React components
│   │   ├── features/      # Feature modules
│   │   └── lib/           # Shared libraries
│   └── src/**/__tests__/  # 568 jest test files
├── deploy/                # Deployment configurations + gitops
├── helm/sogo6/            # Kubernetes Helm chart
├── sogo6/                 # Service configurations
│   ├── loki/              # Loki/Promtail config
│   ├── grafana/           # Grafana datasource provisioning
│   └── prometheus/        # Prometheus rules & config
├── scripts/               # typecheck-gate, validate-specs, validate-links
├── sogo6/scripts/         # setup, init, secrets, certs, backup
├── openspec/              # Spec-driven development artifacts
└── docs/                  # Documentation
```

## CI Pipeline

The `.github/workflows/test.yml` runs:

1. **Lint** — ShellCheck on all shell scripts
2. **Security scan** — Trivy vulnerability scanner (repo + Dockerfiles)
3. **UI Build & Test** — Jest unit tests + Next.js production build
4. **Stack build + backend tests** — Docker compose up, pytest integration tests, SOGo6-testsuite API suite
5. **OWASP ZAP Baseline Scan** — Security scan of the live UI

## Running Tests Locally

```bash
# Backend unit tests
make test            # or: cd sogo6-server && python3 -m pytest tests/

# Frontend unit tests
cd sogo6-ui && npx jest --maxWorkers=2

# Quick health check (API + UI)
make test-smoke

# Contract / property-based tests (needs hypothesis)
make test-contract

# Tests inside the running dev container
make test-dev

# E2E tests (requires SOGo6-testsuite repo)
#   git clone https://github.com/tobias-weiss-ai-xr/SOGo6-testsuite
#   cd SOGo6-testsuite && ./bin/sg run --target sogo6 --suite suites/feature/api-test.suite.sh
```

## Code Style

- **Python**: Black (88 chars), isort, mypy strict
- **TypeScript/React**: ESLint (next/core-web-vitals), Prettier
- **Shell**: ShellCheck-passing bash scripts

## Pull Request Process

1. Ensure tests pass locally (`make test`)
2. Update `.env.example` if adding new environment variables
3. Update Helm chart `values.yaml` if adding new services
4. PRs require CI green check
