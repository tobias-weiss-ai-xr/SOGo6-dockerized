# OpenSpec Documentation Index

## Overview

This document serves as the **central index** for all OpenSpec documentation across the **sogo6-stalwart-openldap-dockerized** project. It provides a comprehensive guide to navigating the specification-driven development artifacts for the entire project, including parent repository and submodules.

**Last Updated**: August 19, 2025
**OpenSpec CLI Version**: 1.6.0
**Total Specification Files**: 16+ (including changes)
**Total Lines of Documentation**: 165,577+

---

## Project Structure

```
sogo6-stalwart-openldap-dockerized/
├── .openspec/                              # Root OpenSpec directory
│   ├── project.spec.md                    # Parent project specification (5,802 lines)
│   ├── .gitignore
│   ├── changes/
│   │   ├── initial-openspec-setup.change.md      # Initial OpenSpec adoption
│   │   └── openspec-server-setup.change.md        # Server module setup
│   └── specs/
│       ├── INDEX.md                       # You are here
│       ├── PROGRESS.md                    # Implementation progress tracker
│       ├── VERIFICATION.md                 # Specification validation guide (11,820 lines)
│       ├── architecture.spec.md           # System architecture (40,061 lines)
│       ├── authentication.spec.md         # Authentication system (50,035 lines)
│       └── roadmap.spec.md                # Project roadmap (18,389 lines)
│
├── sogo6-server/                          # Backend submodule
│   └── .openspec/
│       ├── project.spec.md                # Backend project specification (816 lines)
│       ├── .gitignore
│       ├── changes/
│       │   └── initial-openspec-setup.change.md  # Server initial setup
│       └── specs/
│           ├── admin.spec.md              # Administration module (1,434 lines)
│           ├── calendar.spec.md           # Calendar module (1,355 lines)
│           ├── contacts.spec.md           # Contacts module (1,412 lines)
│           ├── mail.spec.md               # Mail module (1,483 lines)
│           └── authentication.spec.md     # Authentication module (planned)
│
└── sogo6-ui/                              # Frontend submodule
    └── .openspec/
        ├── project.spec.md                # Frontend project specification (1,312 lines)
        ├── .gitignore
        ├── changes/
        │   └── initial-openspec-setup.change.md  # UI initial setup
        └── specs/
            ├── admin.spec.md              # Admin UI module (~6K lines)
            ├── calendar.spec.md           # Calendar UI module (~42K lines)
            ├── contacts.spec.md           # Contacts UI module (~4K lines)
            ├── mail.spec.md               # Mail UI module (~42K lines)
            └── settings.spec.md           # Settings UI module (~4K lines)
```

---

## Navigation Guide

### Quick Start

**New to OpenSpec?** Start with these fundamental documents:

1. **[Parent Project Specification](project.spec.md)** - Overview of the entire SOGo 6 project
2. **[sogo6-server/project.spec.md](../sogo6-server/.openspec/project.spec.md)** - Backend architecture
3. **[sogo6-ui/project.spec.md](../sogo6-ui/.openspec/project.spec.md)** - Frontend architecture
4. **[VERIFICATION.md](VERIFICATION.md)** - How to validate and verify specifications

### For Developers

**Backend Development:**
- [sogo6-server/project.spec.md](../sogo6-server/.openspec/project.spec.md)
- [sogo6-server/specs/mail.spec.md](../sogo6-server/.openspec/specs/mail.spec.md) - Mail API (42 features)
- [sogo6-server/specs/calendar.spec.md](../sogo6-server/.openspec/specs/calendar.spec.md) - Calendar API (55 features)
- [sogo6-server/specs/contacts.spec.md](../sogo6-server/.openspec/specs/contacts.spec.md) - Contacts API (47 features)
- [sogo6-server/specs/admin.spec.md](../sogo6-server/.openspec/specs/admin.spec.md) - Admin API (101 features)

**Frontend Development:**
- [sogo6-ui/project.spec.md](../sogo6-ui/.openspec/project.spec.md)
- [sogo6-ui/specs/mail.spec.md](../sogo6-ui/.openspec/specs/mail.spec.md) - Mail UI (134 features)
- [sogo6-ui/specs/calendar.spec.md](../sogo6-ui/.openspec/specs/calendar.spec.md) - Calendar UI (127 features)
- [sogo6-ui/specs/contacts.spec.md](../sogo6-ui/.openspec/specs/contacts.spec.md) - Contacts UI (201 features)
- [sogo6-ui/specs/admin.spec.md](../sogo6-ui/.openspec/specs/admin.spec.md) - Admin UI
- [sogo6-ui/specs/settings.spec.md](../sogo6-ui/.openspec/specs/settings.spec.md) - Settings UI

### For Architects

**System Design:**
- [architecture.spec.md](architecture.spec.md) - Complete system architecture
- [authentication.spec.md](authentication.spec.md) - Authentication and security design
- [roadmap.spec.md](roadmap.spec.md) - Feature roadmap and timeline

### For Project Managers

**Planning & Tracking:**
- [roadmap.spec.md](roadmap.spec.md) - All 76 implemented features
- [PROGRESS.md](PROGRESS.md) - OpenSpec adoption progress
- Changes in [.openspec/changes/](../../.openspec/changes/) - Change tracking

---

## Specification Inventory

### Parent Repository (`.openspec/`)

| File | Description | Lines | Status |
|------|-------------|-------|--------|
| [project.spec.md](project.spec.md) | Parent project overview, technology stack, module structure | 5,802 | ✅ Complete |
| [roadmap.spec.md](roadmap.spec.md) | Complete feature roadmap with 76 implemented features | 18,389 | ✅ Complete |
| [architecture.spec.md](architecture.spec.md) | System architecture, components, data flow, deployment | 40,061 | ✅ Complete |
| [authentication.spec.md](authentication.spec.md) | Authentication system design and implementation | 50,035 | ✅ Complete |
| [VERIFICATION.md](VERIFICATION.md) | Validation and quality assurance guide | 11,820 | ✅ Complete |
| [PROGRESS.md](PROGRESS.md) | OpenSpec adoption progress tracker | 18,035 | ✅ Complete |
| [INDEX.md](INDEX.md) | This central index document | ~18,600 | ✅ Complete |

### Backend Submodule (`sogo6-server/.openspec/`)

| File | Description | Lines | Status |
|------|-------------|-------|--------|
| [project.spec.md](../sogo6-server/.openspec/project.spec.md) | Backend project specification | 816 | ✅ Complete |
| [specs/mail.spec.md](../sogo6-server/.openspec/specs/mail.spec.md) | Mail module with 42 features | 1,483 | ✅ Complete |
| [specs/calendar.spec.md](../sogo6-server/.openspec/specs/calendar.spec.md) | Calendar module with 55 features | 1,355 | ✅ Complete |
| [specs/contacts.spec.md](../sogo6-server/.openspec/specs/contacts.spec.md) | Contacts module with 47 features | 1,412 | ✅ Complete |
| [specs/admin.spec.md](../sogo6-server/.openspec/specs/admin.spec.md) | Admin module with 101 features | 1,434 | ✅ Complete |

### Frontend Submodule (`sogo6-ui/.openspec/`)

| File | Description | Lines | Status |
|------|-------------|-------|--------|
| [project.spec.md](../sogo6-ui/.openspec/project.spec.md) | Frontend project specification | 1,312 | ✅ Complete |
| [specs/mail.spec.md](../sogo6-ui/.openspec/specs/mail.spec.md) | Mail UI module with 134 features | 42,752 | ✅ Complete |
| [specs/calendar.spec.md](../sogo6-ui/.openspec/specs/calendar.spec.md) | Calendar UI module with 127 features | 42,081 | ✅ Complete |
| [specs/contacts.spec.md](../sogo6-ui/.openspec/specs/contacts.spec.md) | Contacts UI module with 201 features | 4,523 | ✅ Complete |
| [specs/admin.spec.md](../sogo6-ui/.openspec/specs/admin.spec.md) | Admin UI module | 6,186 | ✅ Complete |
| [specs/settings.spec.md](../sogo6-ui/.openspec/specs/settings.spec.md) | Settings UI module | 4,589 | ✅ Complete |

### Change Tracking

| File | Description | Status |
|------|-------------|--------|
| [.openspec/changes/initial-openspec-setup.change.md](../../.openspec/changes/initial-openspec-setup.change.md) | Root repository OpenSpec setup | ✅ Complete |
| [.openspec/changes/openspec-server-setup.change.md](../../.openspec/changes/openspec-server-setup.change.md) | Server submodule OpenSpec setup | ✅ Complete |
| [sogo6-server/.openspec/changes/initial-openspec-setup.change.md](../sogo6-server/.openspec/changes/initial-openspec-setup.change.md) | Server initial change tracking | ✅ Complete |
| [sogo6-ui/.openspec/changes/initial-openspec-setup.change.md](../sogo6-ui/.openspec/changes/initial-openspec-setup.change.md) | UI submodule OpenSpec setup | ✅ Complete |

---

## Cross-Reference Guide

### Feature to Specification Mapping

| Feature | Root Spec | Server Spec | UI Spec |
|---------|-----------|-------------|---------|
| **Authentication** | [authentication.spec.md](authentication.spec.md) |Planned| Settings UI |
| **Mail** | Architecture section | [mail.spec.md](../sogo6-server/.openspec/specs/mail.spec.md) | [mail.spec.md](../sogo6-ui/.openspec/specs/mail.spec.md) |
| **Calendar** | Architecture section | [calendar.spec.md](../sogo6-server/.openspec/specs/calendar.spec.md) | [calendar.spec.md](../sogo6-ui/.openspec/specs/calendar.spec.md) |
| **Contacts** | Architecture section | [contacts.spec.md](../sogo6-server/.openspec/specs/contacts.spec.md) | [contacts.spec.md](../sogo6-ui/.openspec/specs/contacts.spec.md) |
| **Admin** | Architecture section | [admin.spec.md](../sogo6-server/.openspec/specs/admin.spec.md) | [admin.spec.md](../sogo6-ui/.openspec/specs/admin.spec.md) |
| **Settings** | N/A | N/A | [settings.spec.md](../sogo6-ui/.openspec/specs/settings.spec.md) |

### Technology Stack References

| Technology | Primary Spec | Related Specs |
|------------|--------------|----------------|
| **TypeScript** | [sogo6-ui/project.spec.md](../sogo6-ui/.openspec/project.spec.md) | All UI specs |
| **React 18** | [sogo6-ui/project.spec.md](../sogo6-ui/.openspec/project.spec.md) | All UI specs |
| **Material-UI v5** | [sogo6-ui/project.spec.md](../sogo6-ui/.openspec/project.spec.md) | All UI specs |
| **Redux Toolkit** | [sogo6-ui/project.spec.md](../sogo6-ui/.openspec/project.spec.md) | All UI specs |
| **Python/FastAPI** | [sogo6-server/project.spec.md](../sogo6-server/.openspec/project.spec.md) | All server specs |
| **SQLAlchemy** | [sogo6-server/project.spec.md](../sogo6-server/.openspec/project.spec.md) | Architecture spec |
| **PostgreSQL** | [architecture.spec.md](architecture.spec.md) | All backend specs |
| **Docker/Kubernetes** | [architecture.spec.md](architecture.spec.md) | N/A |

---

## How to Use This Documentation

### Finding Information

1. **Feature-based lookup**: Check [roadmap.spec.md](roadmap.spec.md) for feature status
2. **Module-based lookup**: Navigate to the relevant module specification
3. **Cross-reference**: Use the feature mapping table above
4. **Search**: All spec files support full-text search

### Reading Order

#### For New Contributors
1. [project.spec.md](project.spec.md) - Project overview
2. [roadmap.spec.md](roadmap.spec.md) - Feature status
3. [VERIFICATION.md](VERIFICATION.md) - Validation guide
4. Module specs based on interest

#### For Feature Implementation
1. Relevant module spec (e.g., [mail.spec.md](mail.spec.md))
2. Backend API spec for same module
3. [architecture.spec.md](architecture.spec.md) - Design decisions
4. Change files for recent modifications

### Using the OpenSpec CLI

```bash
# Validate all specifications
openspec validate .openspec/
openspec validate sogo6-server/.openspec/
openspec validate sogo6-ui/.openspec/

# Check status
openspec doctor

# List changes
openspec list changes
```

---

## Statistics

### Specification Coverage

| Metric | Total |
|--------|-------|
| **Spec Files** | 16 |
| **Change Files** | 4 |
| **GitIgnore Files** | 3 |
| **Total Lines** | **165,577+** |
| **Features Documented** | **786+** |
| **API Endpoints** | **128+** |
| **Database Models** | **69+** |

### Coverage by Repository

| Repository | Lines | Features |
|------------|-------|----------|
| Root | ~144,172 | 78 |
| Server | ~5,500 | 245 |
| UI | ~115,000 | 463 |
| **Total** | **~165,577+** | **786+** |

---

## Contributing

### Adding New Specifications
1. Create `.spec.md` file in appropriate directory
2. Follow existing spec templates
3. Add cross-references to related specs
4. Update this INDEX.md
5. Create corresponding change file

### Updating Specifications
1. Edit the relevant `.spec.md` file
2. Update cross-references
3. Update change files
4. Run validation (`openspec validate`)

---

## Validation

```bash
# Validate all specs
find . -name "*.spec.md" -o -name "*.change.md" | xargs openspec validate

# Check links
markdown-link-check .openspec/**/*.md sogo6-server/.openspec/**/*.md sogo6-ui/.openspec/**/*.md

# Lint Markdown
markdownlint .openspec/**/*.md sogo6-server/.openspec/**/*.md sogo6-ui/.openspec/**/*.md

# Check spelling
codespell .openspec/ sogo6-server/.openspec/ sogo6-ui/.openspec/
```

---

## Maintenance

| Task | Frequency | Responsible |
|------|-----------|-------------|
| Update specs | Per feature | Developers |
| Review changes | Per PR | Maintainers |
| Run validation | Daily | CI/CD |
| Check links | Weekly | Maintainers |
| Quality review | Monthly | Tech Lead |

---

## References

- [OpenSpec Documentation](https://openspec.dev/)
- [Project README](../../README.md)
- [ROADMAP.md](../../ROADMAP.md)
- [SUMMARY.md](../../SUMMARY.md)
- [DEVELOPMENT.md](../../DEVELOPMENT.md)

---

**Document Status**: ✅ Complete
**Last Validated**: August 19, 2025
**OpenSpec CLI Version**: 1.6.0
