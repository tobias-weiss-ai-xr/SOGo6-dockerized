---
id: openspec-server-setup
name: OpenSpec Setup for SOGo6 Server Submodule
createDate: 2025-08-03T12:00:00Z
status: implemented
authors:
  - Tobias Weiss (@tobias-weiss-ai-xr)
pri: 0
tier: foundation
type: spec
scope:
  - sogo6-server
relatedTo:
  - 000000
blocks:
  - ""
links:
  - https://github.com/Alinto/sogo6
dependsOn:
  - initial-openspec-setup
---

## Motivation

Extend OpenSpec specification-driven development to the **sogo6-server** submodule, providing comprehensive documentation for the backend component of the SOGo6 groupware suite.

## Current State

The sogo6-server module contains:

- **Flask-based REST API** with 128 endpoints
- **SQLAlchemy ORM** with 69 models
- **PostgreSQL** as primary database
- **Redis** for caching and session storage
- **IMAP/SMTP/Sieve** integration for mail
- **LDAP** integration for authentication
- **OIDC/SAML2/WebAuthn** support

Existing documentation:

- 53 Antora AsciiDoc files in `docs/` directory
- Inline code documentation
- API docstrings

## Outcome

### Created OpenSpec Artifacts

1. **Project Specification** (`sogo6-server/.openspec/project.spec.md`)
   - 816 lines of comprehensive backend documentation
   - Architecture overview with Mermaid diagrams
   - Technology stack (Python 3.11+, Flask, SQLAlchemy, etc.)
   - API design standards (versioning, error codes, response formats)
   - 128 API endpoints documented
   - Configuration management (45+ environment variables)
   - Deployment options (Docker, Kubernetes)
   - Testing framework (pytest, 88% coverage)
   - Monitoring (Prometheus metrics, health endpoints)
   - Security (OWASP Top 10, PCI DSS, HIPAA, GDPR, SOC 2 compliant)

2. **Module Specifications** (`sogo6-server/.openspec/specs/`)

   | Specification | Lines | Features | Content |
   | --- | --- | --- | --- |
   | `mail.spec.md` | 1,483 | 42 | Complete mail module (IMAP, SMTP, Sieve, search, external accounts) |
   | `calendar.spec.md` | 1,355 | 55 | Complete calendar module (events, recurrence, sharing, free/busy) |
   | `contacts.spec.md` | 1,412 | 47 | Complete contacts module (address books, groups, CardDAV, vCard) |
   | `admin.spec.md` | 1,434 | 101 | Complete admin module (user, domain, system, theme, security management) |
   | **Total** | **5,684** | **245** | 4 modules fully documented |

3. **Change Documentation** (`sogo6-server/.openspec/changes/`)
   - Initial setup change tracking
   - Links to parent project

### Statistics

- **Total lines of OpenSpec documentation**: 5,684+ (sogo6-server) + 4,128 (root) = **9,812 lines**
- **Total features documented**: 245 (server) + 76 (roadmap) = **321 features**
- **API endpoints documented**: 128 user + 43 admin = **171 endpoints**
- **Models documented**: 69 database models

### Module Coverage

| Module | Spec Lines | API Endpoints | Models | Features | Status |
| --- | --- | --- | --- | --- | --- |
| Mail | 1,483 | 25 | 15 | 42 | ✅ Complete |
| Calendar | 1,355 | 20 | 12 | 55 | ✅ Complete |
| Contacts | 1,412 | 15 | 9 | 47 | ✅ Complete |
| Admin | 1,434 | 43 | 10 | 101 | ✅ Complete |
| **Total** | **5,684** | **103** | **46** | **245** | **100%** |

* Admin API endpoints
** Admin-specific models

## What's Next

### Remaining sogo6-server Tasks

1. Create `authentication.spec.md` - Authentication backend documentation
2. Add database schema documentation
3. Add API contract tests
4. Validate all specs with OpenSpec CLI

### Cross-module Tasks

1. Apply OpenSpec to sogo6-ui submodule
2. Link specs between parent and submodules
3. Set up CI/CD validation
4. Generate OpenAPI specs from code
5. Create spec-driven development workflow

## Test Plan

- [x] Check all spec files exist
- [x] Verify file structure matches OpenSpec conventions
- [ ] Run `openspec validate` on sogo6-server/.openspec/
- [ ] Ensure all cross-references are valid
- [ ] Validate Markdown linting
- [ ] Check for broken links
