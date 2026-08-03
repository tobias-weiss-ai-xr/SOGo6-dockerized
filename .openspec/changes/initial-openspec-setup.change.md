---
title: "Adopt OpenSpec for Multi-Repo Project"
id: initial-openspec-setup
date: 2025-01-XX
status: draft
priority: t0
---

## Summary

Adopt OpenSpec specification-driven development across the entire sogo6-stalwart-openldap-dockerized project, including its git submodules (sogo6-server and sogo6-ui). This will provide structured feature tracking, implementation status, and change management.

## Motivation

Currently, the project has:

- Extensive documentation scattered across repos
- 2,565+ i18n JSON files serving as de-facto specs
- No standardized spec format
- No machine-readable status tracking
- No change management system

OpenSpec will provide:

- Structured feature specifications
- Implementation task tracking
- Cross-repo dependency management
- Progress visualization
- Historical change tracking

## Goals

1. **Root Repository**: Create `.openspec/` with project-level specs and change tracking
2. **sogo6-server**: Create `.openspec/` with backend feature specs
3. **sogo6-ui**: Create `.openspec/` with frontend feature specs
4. **Migration**: Convert existing docs (ROADMAP.md, etc.) to OpenSpec format
5. **Integration**: Wire up GitHub Actions for spec validation

## Non-Goals

- Rewriting all existing documentation (will be migrated incrementally)
- Replacing i18n JSON files (they remain as functional specs)
- Changing the development workflow significantly

## Specifications

### New Specifications

| ID | Title | Priority | Status |
| --- | --- | --- | --- |
| project.spec | Project Specification | t0 | draft |
| architecture.spec | System Architecture | t0 | draft |
| auth.spec | Authentication System | t0 | draft |
| mail.spec | Mail Module | t1 | draft |
| calendar.spec | Calendar Module | t1 | draft |
| contacts.spec | Contacts Module | t1 | draft |
| admin.spec | Admin Panel | t2 | draft |

### Existing Content to Migrate

| Source | Target | Priority |
| --- | --- | --- |
| ROADMAP.md | .openspec/specs/roadmap.spec.md | t0 |
| SUMMARY.md | .openspec/changes/implementation-summary.change.md | t0 |
| sogo6-server/docs/ | sogo6-server/.openspec/specs/ | t1 |
| sogo6-ui/docs/ | sogo6-ui/.openspec/specs/ | t1 |

## Tasks

### Phase 1: Root Repository Setup (Current)

- [ ] Create `.openspec/project.spec.md` - Project overview
- [ ] Create `.openspec/specs/` directory structure
- [ ] Create initial change file for OpenSpec adoption
- [ ] Convert ROADMAP.md to spec format
- [ ] Add `.openspecignore` for node_modules, etc.
- [ ] Configure OpenSpec CLI in root

### Phase 2: Backend (sogo6-server) Setup

- [ ] Create `sogo6-server/.openspec/project.spec.md`
- [ ] Create `sogo6-server/.openspec/specs/`
- [ ] Migrate backend architecture docs
- [ ] Create specs for each backend module
- [ ] Link to existing Python docstrings

### Phase 3: Frontend (sogo6-ui) Setup

- [ ] Create `sogo6-ui/.openspec/project.spec.md`
- [ ] Create `sogo6-ui/.openspec/specs/`
- [ ] Migrate frontend docs
- [ ] Reference i18n JSON files as functional specs
- [ ] Create UI component specifications

### Phase 4: Integration

- [ ] Add OpenSpec validation to CI/CD
- [ ] Set up spec sync between repos
- [ ] Create cross-repo dependency tracking
- [ ] Add spec health checks

### Phase 5: Cleanup

- [ ] Validate all specs with `openspec validate`
- [ ] Update README.md with OpenSpec usage
- [ ] Create CONTRIBUTING.md updates
- [ ] Train team on OpenSpec workflow

## Success Criteria

- [ ] All repos have `.openspec/` directories
- [ ] ROADMAP.md content migrated to OpenSpec
- [ ] CI/CD validates specs on PR
- [ ] `openspec status` shows project health
- [ ] Specs are linked from documentation

## Risks

1. **Time Investment**: Initial setup requires effort
   - Mitigation: Do incrementally, start with root repo

2. **Spec Drift**: Specs may diverge from implementation
   - Mitigation: Add CI validation, regular sync meetings

3. **Team Adoption**: Developers may resist new workflow
   - Mitigation: Show immediate benefits (better tracking, less context switching)

## Dependencies

- OpenSpec CLI v1.6.0+ (already installed)
- Git submodule access
- Write permissions to all repos

## Timeline

| Phase | Duration | Start Date |
| --- | --- | --- |
| Phase 1 | 1 day | Today |
| Phase 2 | 1 day | After Phase 1 |
| Phase 3 | 1 day | After Phase 2 |
| Phase 4 | 1 day | After Phase 3 |
| Phase 5 | 1 day | After Phase 4 |

## References

- [OpenSpec Documentation](https://openspec.dev)
- [OpenSpec GitHub](https://github.com/openspecrc/openspec)
- [Current ROADMAP.md](../ROADMAP.md)
- [Current SUMMARY.md](../SUMMARY.md)
