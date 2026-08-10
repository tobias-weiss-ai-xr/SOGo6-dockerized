# SOGo 6 Dockerized Project Specification

## Overview

This repository (`SOGo6-dockerized`) is a production-ready Docker deployment of **SOGo 6 Groupware** with **Stalwart Mail Server** and **OpenLDAP** integration. It packages Alinto's SOGo 6 (Python/Flask backend + Next.js/React frontend) as a complete, containerized groupware solution.

**Status**: Production-ready, 100% roadmap complete

## Project Structure

```
┌─────────────────────────────────────────────────┐
│          SOGo6-dockerized     │
│              (Parent Repository)                │
├─────────────────────────────────────────────────┤
│  • docker-compose.yaml (7 core services)       │
│  • Dockerfiles & configuration                  │
│  • Documentation & roadmap                      │
│  • Git submodules:                              │
│    ├── sogo6-server/ (Python/Flask backend)     │
│    └── sogo6-ui/ (Next.js/React frontend)       │
└─────────────────────────────────────────────────┘
```

## Services Architecture

### Core Services (7)
1. **sogo6-ui** - Next.js 16 frontend (:3000)
2. **sogo6-server** - Flask/Python backend (:5000)
3. **nginx** - Reverse proxy (:80/:443)
4. **postgresql** - Database
5. **redis** - Cache & session store
6. **openldap** - Authentication & directory
7. **stalwart** - IMAP/SMTP/Sieve mail server

### Optional Profiles
- **idp-keycloak** - Keycloak OIDC/SAML IdP
- **nubus** - nubusintercom service for OpenCloud integration

## Repository Links

| Repository | Path | Description |
|------------|------|-------------|
| Parent | `.` | Docker orchestrator |
| Backend | `sogo6-server/` | Flask API server |
| Frontend | `sogo6-ui/` | Next.js UI |

## Feature Completion

### ✅ Implemented (76/76 Roadmap Features)
- **Tier 0 (Foundation)**: 8/8 complete
- **Tier 1 (Core Experience)**: 14/14 complete
- **Tier 2 (Admin & Scale)**: 14/14 complete
- **Tier 3 (Ecosystem)**: 9/9 complete
- **Tier 4 (Team & Productivity)**: 10/10 complete
- **Tier 5 (AI & Intelligence)**: 10/10 complete
- **Tier 6 (Vertical Markets)**: 6/6 complete
- **Tier 7 (Advanced)**: 5/5 complete

### 🎯 Architecture Principles
1. **Modular Design**: Each component (mail, calendar, contacts, admin) is a separate module
2. **API-First**: RESTful API with OpenAPI specifications
3. **Multi-tenant**: Per-domain configuration and branding
4. **Security-First**: OIDC/SAML, MFA/TOTP, rate limiting, security headers
5. **Observability**: Prometheus metrics, structured logging, health endpoints

## Dependencies

### External
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- OpenLDAP 2.5+
- Stalwart Mail Server v0.16.0

### Internal
- `sogo6-server` → Python dependencies (Flask, SQLAlchemy, ldap3, etc.)
- `sogo6-ui` → Node dependencies (Next.js, React, Redux, etc.)

## Configuration

### Environment Variables
- **Database**: `POSTGRES_*`, `SOGO_DB_*`
- **Redis**: `SOGO_REDIS_URL`
- **LDAP**: `SOGO_LDAP_*`
- **Mail**: `SOGO_SMTP_*`, `SOGO_IMAP_*`
- **Auth**: `SOGO_OIDC_*`, `SOGO_SAML2_*`
- **Feature Flags**: `SOGO_FEATURE_*`

### Configuration Files
- `docker-compose.yaml` - Service orchestration
- `docker-compose.override.yaml` - Development overrides
- `.env` - Environment variables
- `.env.example` - Template

## Deployment

### Quick Start
```bash
# Clone and start all services
git clone https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized.git
cd SOGo6-dockerized
make dev

# Access at http://localhost:3000
# Default credentials: testuser@example.org / password123
```

### Production
```bash
# Build and start production stack
make prod

# With optional services
docker compose --profile idp-keycloak --profile nubus up -d
```

## Testing

### Test Coverage
| Suite | Files | Pass | Fail |
|-------|-------|------|------|
| Backend Python | 135 | 1723 | 1* |
| UI Jest | 589 | 69 | 6* |
| Admin API (bash) | 1 | 29 | 0 |
| Playwright E2E | 4 | 23 | 0 |
| k6 Load Tests | 2 | 32 | 0 |
| **Total** | | **1876** | **7** |

*Pre-existing upstream issues, not blocking

### Running Tests
```bash
# Backend tests
make test-backend

# UI tests
make test-ui

# E2E tests
make test-e2e

# Load tests
make test-load
```

## Documentation

### Structure
- `/docs/` - Root documentation
- `/docs/specs/` - Feature specifications
- `/sogo6-server/docs/` - Backend documentation (Antora)
- `/sogo6-ui/docs/` - Frontend documentation

### Key Documents
- [docs/guides/ROADMAP.md](../docs/guides/ROADMAP.md) - Complete feature roadmap
- [docs/reports/SUMMARY.md](../docs/reports/SUMMARY.md) - Implementation summary
- [docs/development/DEVELOPMENT.md](../docs/development/DEVELOPMENT.md) - Development guide
- [docs/guides/DATABASE_SWITCH.md](../docs/guides/DATABASE_SWITCH.md) - DB migration guide

## Contribution Guidelines

### Git Flow
- `main` - Production releases
- `dev` - Development branch
- `feature/*` - Feature branches
- `fix/*` - Bug fixes
- `release/*` - Release candidates

### Submodules
This repository uses git submodules for:
- `sogo6-server` (Alinto/SOGo6-Backend)
- `sogo6-ui` (Alinto/SOGo6-UI)

To update submodules:
```bash
git submodule update --remote --recursive
```

### Specification-Driven Development
This project uses **OpenSpec** for:
- Feature specifications
- Implementation tracking
- Change management

Specs are located in:
- `.openspec/` (root)
- `sogo6-server/.openspec/` (backend)
- `sogo6-ui/.openspec/` (frontend)

## License

AGPL-3.0 (inherited from upstream SOGo projects)

## Maintainers

- Tobias Weiss (@tobias-weiss-ai-xr)

## Related Projects

- [Alinto/SOGo](https://github.com/Alinto/sogo) - Legacy SOGo 5 (GNUstep/Objective-C)
- [Alinto/SOGo6-Backend](https://github.com/Alinto/SOGo6-Backend) - SOGo 6 Server
- [Alinto/SOGo6-UI](https://github.com/Alinto/SOGo6-UI) - SOGo 6 Frontend
- [ StalwartMail/stalwart](https://github.com/StalwartLabs/mail-server) - Mail Server
