# OpenSpec Contribution Guide

This guide explains how to contribute to the OpenSpec documentation for the SOGo 6 project.

---

## 📚 Overview

The SOGo 6 project uses OpenSpec for specification-driven development. All specifications are organized in `.openspec/` directories across the three repositories:

- **Root** (`.openspec/`) - Project-wide specs
- **Server** (`sogo6-server/.openspec/`) - Backend API specs
- **UI** (`sogo6-ui/.openspec/`) - Frontend UI specs

---

## 🎯 Contributing Workflow

### 1. Before You Start

**For New Features:**
1. Create a feature specification first
2. Get approval from maintainers
3. Implement the feature
4. Update the spec as needed

**For Existing Features:**
1. Review the existing spec
2. Make changes to match implementation
3. Update change tracking

### 2. Creating a New Specification

#### Step 1: Choose the Right Location

| Specification Type | Location |
|-------------------|----------|
| Project overview, architecture, roadmap | `.openspec/specs/` (root) |
| Backend API modules | `sogo6-server/.openspec/specs/` |
| Frontend UI modules | `sogo6-ui/.openspec/specs/` |

#### Step 2: Create the Spec File

```bash
# Navigate to the appropriate repository
cd .openspec/specs  # or sogo6-server/.openspec/specs or sogo6-ui/.openspec/specs

# Create your spec file
touch my-feature.spec.md
```

#### Step 3: Use the Template

```markdown
# Feature Name Module Specification

## Overview

Brief description of the feature.

**Status**: ✅ Complete | ⏳ In Progress | 🚧 Planned
**Version**: 1.0.0
**Repository**: [repo-name/]
**Parent Spec**: [link to parent spec]

---

## Features

### ✅ Implemented Features

- [x] Feature 1
- [x] Feature 2
- [ ] Feature 3 (planned)

### 📋 Feature Completion

| Category | Features | Complete |
|----------|----------|----------|
| **Category 1** | 10 | 10/10 (100%) |
| **Category 2** | 5 | 3/5 (60%) |
| **Total** | **15** | **13/15 (87%)** |

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────┐
│ Feature Module                           │
├─────────────────────────────────────────┤
│ Components                               │
└─────────────────────────────────────────┘
```

### Module Structure

```
sogo6-server/
├── Feature.py
├── models/
│   └── ...
├── hooks/
├── types/
├── slices/
└── api/
```

---

## State Management

### Redux Slices

```typescript
// Code example showing state structure
```

### API Integration

Consumes the following endpoints:
- `GET /api/...` - Description
- `POST /api/...` - Description

---

## UI Components

### Component List

| Component | Purpose | Location |
|-----------|---------|----------|
| `Component1` | Description | `components/Component1/` |
| `Component2` | Description | `components/Component2/` |

---

## References

- [Project Specification](project.spec.md)
- [Roadmap](specs/roadmap.spec.md)
- [Architecture](specs/architecture.spec.md)
- [OpenSpec Documentation](https://openspec.dev)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-01 | Initial spec |

## License

AGPL-3.0

## Maintainers

- Your Name (@your-github-username)
```

#### Step 4: Create a Change File

```bash
# Navigate to changes directory
cd .openspec/changes  # or sogo6-server/.openspec/changes or sogo6-ui/.openspec/changes

# Create change file
touch my-feature-setup.change.md
```

**Change File Template:**

```markdown
---
id: my-feature-setup
name: My Feature Setup
createDate: 2025-01-01T00:00:00Z
status: implemented
authors:
  - Your Name (@your-github-username)
pri: 0
tier: foundation
type: spec
scope:
  - affected-repo
relatedTo:
  - related-change-id
blocks:
  - ""
links:
  - https://github.com/Alinto/sogo6
dependsOn:
  - initial-openspec-setup
---

## Motivation

Why this change was made.

## Current State

Before this change.

## Outcome

What was created/changed.

### New Artifacts

1. **File 1** (`specs/my-feature.spec.md`)
   - Description

### What's Next

Future work.

## Compatibility Concerns

Any breaking changes or considerations.

## Test Plan

- [ ] Validate spec format
- [ ] Check cross-references
- [ ] Run validation
```

---

## 🔄 Updating Existing Specifications

### When to Update

Update specs when:
- Code changes affect documented features
- New features are added
- API endpoints change
- Architecture decisions change
- Bug fixes change behavior

### How to Update

1. **Edit the spec file** - Make changes to match implementation
2. **Update the changelog** - Add entry to the spec's changelog
3. **Create/update change file** - Document the change
4. **Update cross-references** - Link to related specs
5. **Run validation** - Ensure everything is correct

---

## ✅ Validation Requirements

All changes must pass validation before merging:

```bash
# Run validation
./validate-all-specs.sh

# Or individual checks
openspec validate .openspec/
markdownlint .openspec/**/*.md
codespell .openspec/
```

### Validation Checklist

- [ ] File structure is correct
- [ ] All required sections present
- [ ] Cross-references are valid
- [ ] No spelling errors
- [ ] Markdown formatting is consistent
- [ ] Change file created

---

## 📋 Best Practices

### Writing Good Specs

1. **Be specific** - Avoid vague descriptions
2. **Use examples** - Include code examples where helpful
3. **Document decisions** - Explain why certain choices were made
4. **Keep it current** - Update specs as code changes
5. **Link everything** - Cross-reference related specs

### File Organization

```
Recommended structure:
├── Overview
├── Features (with completion status)
├── Architecture (diagrams, structure)
├── State Management (if applicable)
├── API Integration (endpoints consumed/provided)
├── UI Components (if applicable)
├── Routing (if applicable)
├── Real-time Updates (if applicable)
├── Keyboard Shortcuts (if applicable)
├── Accessibility (if applicable)
├── References
├── Changelog
└── License/Maintainers
```

### Naming Conventions

- **Spec files**: `feature-name.spec.md` (lowercase, hyphenated)
- **Change files**: `feature-name-setup.change.md` (lowercase, hyphenated)
- **Sections**: Use clear, descriptive headings
- **Status indicators**: ✅ Complete | ⏳ In Progress | 🚧 Planned | ❌ Deprecated

---

## 🔗 Cross-Referencing

### Linking Between Specs

When your spec references another spec:

```markdown
## References

- [Parent Project Spec](project.spec.md)
- [Related Module Spec](specs/roadmap.spec.md)
- [Backend API Spec](../sogo6-server/.openspec/specs/mail.spec.md)
```

### Feature Mapping

Keep track of feature relationships:

| Feature | Root Spec | Server Spec | UI Spec |
|---------|-----------|-------------|---------|
| Mail | [Architecture](specs/architecture.spec.md) | [Mail API](../sogo6-server/.openspec/specs/mail.spec.md) | [Mail UI](../sogo6-ui/.openspec/specs/mail.spec.md) |
| Calendar | [Architecture](specs/architecture.spec.md) | [Calendar API](../sogo6-server/.openspec/specs/calendar.spec.md) | [Calendar UI](../sogo6-ui/.openspec/specs/calendar.spec.md) |

---

## 🎓 Review Process

### Self-Review

Before submitting:
- [ ] All sections complete
- [ ] Cross-references valid
- [ ] Code examples accurate
- [ ] Changelog updated
- [ ] Validation passed

### Maintainer Review

Maintainers will check:
- [ ] Spec quality and completeness
- [ ] Alignment with project architecture
- [ ] Cross-repository consistency
- [ ] Change tracking accuracy

---

## 🛠️ Tools

### Required Tools

```bash
# Install validation tools
npm install -g markdownlint-cli
pip install codespell

# Optional: OpenSpec CLI (if available)
npm install -g @openspec-dev/openspec
```

### Useful Commands

```bash
# Run all validations
./scripts/validate-specs.sh

# Check specific file
markdownlint .openspec/specs/roadmap.spec.md

# Find all spec files
find .openspec sogo6-server/.openspec sogo6-ui/.openspec -name "*.spec.md"

# Count lines in specs
wc -l $(find .openspec sogo6-server/.openspec sogo6-ui/.openspec -name "*.spec.md")
```

---

## 📚 Resources

- [OpenSpec Documentation](https://openspec.dev/)
- [OpenSpec Format Specification](https://github.com/openspec-format/openspec)
- [SOGo 6 Project Spec](project.spec.md)
- [Documentation Index](specs/INDEX.md)
- [Progress Tracker](specs/PROGRESS.md)

---

## 🤝 Questions?

If you have questions about contributing:
1. Check existing specs for examples
2. Review this guide
3. Open an issue for discussion
4. Contact maintainers

---

**Last Updated**: August 19, 2025
**Version**: 1.0.0
