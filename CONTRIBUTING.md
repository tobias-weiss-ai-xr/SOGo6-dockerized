# Contributing to SOGo 6

## Development Setup

```bash
# Clone with submodules
git clone --recurse-submodules git@github.com:tobias-weiss-ai-xr/SOGo6-dockerized.git
cd SOGo6-dockerized

# Copy environment template
cp .env.example .env
# Edit .env with your secrets

# Start full stack (development mode)
docker compose up -d --build

# Or minimal stack (SOGo + UI only)
docker compose -f docker-compose.minimal.yaml up -d --build
```

## Project Structure

```
├── sogo6-server/          # Flask/Python backend (submodule)
│   ├── app/
│   │   ├── api/           # REST API endpoints (Flask-RESTful)
│   │   ├── manager/       # DB, cache, LDAP, mail clients
│   │   ├── module/        # Business logic modules
│   │   └── utils/         # Shared utilities
│   └── tests/
├── sogo6-ui/              # Next.js frontend (submodule)
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # React components
│   │   ├── features/      # Feature modules
│   │   └── lib/           # Shared libraries
│   └── tests/
├── deploy/                # Deployment configurations
│   └── mariadb-e2e/       # MariaDB E2E test suite
├── helm/sogo6/            # Kubernetes Helm chart
├── sogo6/                 # Service configurations
│   ├── loki/              # Loki/Promtail config
│   ├── grafana/           # Grafana datasource provisioning
│   └── prometheus/        # Prometheus rules & config
├── tests/                 # Integration & load tests
│   ├── load/              # k6 load/performance tests
│   └── e2e/               # Playwright E2E tests
└── docs/                  # Documentation
```

## CI Pipeline

The `.github/workflows/test.yml` runs:

1. **Lint** — ShellCheck on all shell scripts
2. **UI Build & Test** — Jest unit tests + Next.js production build
3. **Full Stack E2E** — Docker compose up, API tests, Playwright, k6 load tests

## Running Tests Locally

```bash
# Backend unit tests
cd sogo6-server && python3 -m pytest tests/ -v

# Frontend unit tests
cd sogo6-ui && npx jest --maxWorkers=2

# Full stack E2E
docker compose up -d --wait
bash tests/run-all-tests.sh

# Load tests
bash tests/load/run.sh

# MariaDB E2E
cd deploy/mariadb-e2e && docker compose up -d --wait && ./run-e2e-tests.sh
```

## Code Style

- **Python**: Black (88 chars), isort, mypy strict
- **TypeScript/React**: ESLint (next/core-web-vitals), Prettier
- **Shell**: ShellCheck-passing bash scripts

## Pull Request Process

1. Ensure tests pass locally
2. Update `.env.example` if adding new environment variables
3. Update Helm chart `values.yaml` if adding new services
4. Update `SUMMARY.md` for new features
5. PRs require CI green check
