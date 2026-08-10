---
id: complete-infrastructure-implementation
title: Complete OpenSpec Infrastructure Implementation
description: Wire UI to real backend, generate OpenAPI specs, implement missing features, clean up fakeApi/mock code
name: Complete OpenSpec Infrastructure Implementation
createDate: 2026-08-05T15:00:00Z
status: in-progress
authors:
  - Tobias Weiss (@tobias-weiss-ai-xr)
pri: 0
tier: foundation
type: feature
dependsOn:
  - phase5-validation-setup
---

## Change Summary

Complete the OpenSpec implementation by:
1. **Wire UI to real backend** - Create real API client library, replace fakeApi usage with real endpoints
2. **Generate OpenAPI specs** - Run and integrate the existing generator script
3. **Implement missing features** - Identify and implement any gaps between specs and actual code
4. **Clean up stubs/mocks** - Remove fakeApi or make it optional via environment variable

## Tasks

### Task 1: Generate OpenAPI Specifications
- [ ] Run `scripts/generate-openapi.py` to create initial OpenAPI spec
- [ ] Fix any import issues in the generator
- [ ] Enhance spec with proper schemas from Marshmallow
- [ ] Save spec to `sogo6-server/openapi.json` and `sogo6-server/openapi.yaml`
- [ ] Add spec to Git tracking
- [ ] Update INDEX.md with OpenAPI spec reference

**Acceptance Criteria**:
- [ ] OpenAPI spec generated successfully
- [ ] All Flask routes documented
- [ ] Spec files committed to repository
- [ ] Spec referenced in documentation

### Task 2: Create Real API Client Library
- [ ] Create `sogo6-ui/src/lib/api/client/` directory
- [ ] Implement `base-client.ts` with fetch wrapper
- [ ] Implement `auth-api.ts` for authentication endpoints
- [ ] Implement `mail-api.ts` for mail endpoints
- [ ] Implement `calendar-api.ts` for calendar endpoints
- [ ] Implement `contact-api.ts` for contact endpoints
- [ ] Implement `admin-api.ts` for admin endpoints
- [ ] Add TypeScript interfaces for all API responses
- [ ] Add error handling and retry logic
- [ ] Add request/response interceptors

**Acceptance Criteria**:
- [ ] API client library with typed endpoints
- [ ] All major API modules covered
- [ ] Proper error handling
- [ ] Works with JWT authentication

### Task 3: Wire UI to Real Backend
- [ ] Create environment configuration for API switching
- [ ] Add `NEXT_PUBLIC_ENABLE_FAKE_API` environment variable
- [ ] Update proxy.ts to conditionally route fakeApi requests
- [ ] Create api-router.ts to route to real backend or fakeApi
- [ ] Update all UI components using fakeApi to use the router
- [ ] Test real API integration

**Acceptance Criteria**:
- [ ] UI can switch between real and fake API via env var
- [ ] Default in production: real backend
- [ ] Default in development: fakeAPI (for easier dev)
- [ ] All existing functionality works

### Task 4: Implement Missing Features
- [ ] Compare specs with actual backend code
- [ ] Identify missing endpoints or features
- [ ] Implement OIDC SSO endpoints if missing
- [ ] Implement SAML2 endpoints if missing
- [ ] Implement WebAuthn endpoints if missing
- [ ] Implement JMAP protocol endpoints
- [ ] Add any missing calendar features
- [ ] Add any missing mail features

**Acceptance Criteria**:
- [ ] All spec-defined endpoints implemented
- [ ] No discrepancies between specs and code
- [ ] All features marked in specs are functional

### Task 5: Clean Up FakeAPI/Stubs
- [ ] Archive fakeApi to `src/archived/fakeApi/` or keep as dev dependency
- [ ] Remove demo data return in nubusintercom/app.py
- [ ] Add documentation explaining fakeApi is for development only
- [ ] Add warning comments in fakeApi files
- [ ] Ensure fakeApi can be completely disabled in production

**Acceptance Criteria**:
- [ ] fakeApi is clearly marked as development-only
- [ ] Production builds don't include or expose fakeApi
- [ ] No demo data leaks to production

## Technical Details

### API Client Architecture
```
src/lib/api/
├── client/
│   ├── base-client.ts         # Base HTTP client with fetch
│   ├── auth-client.ts         # Authentication-specific client
│   ├── interceptors.ts        # Request/response interceptors
│   └── types.ts               # TypeScript types
├── endpoints/
│   ├── auth.ts                # /api/user/v1/auth/*
│   ├── mail.ts                # /api/user/v1/mail/*
│   ├── calendar.ts            # /api/user/v1/calendar/*
│   ├── contacts.ts            # /api/user/v1/contacts/*
│   ├── admin.ts               # /api/admin/v1/*
│   └── system.ts              # /api/v1/system/*
├── index.ts                   # Export all API functions
└── config.ts                  # API configuration
```

### Environment Configuration
```env
# Development (default)
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
NEXT_PUBLIC_ENABLE_FAKE_API=true

# Production
NEXT_PUBLIC_API_BASE_URL=https://api.sogo.example.com
NEXT_PUBLIC_ENABLE_FAKE_API=false
```

### OpenAPI Integration
- Generate spec from Flask app using existing script
- Enhance with Marshmallow schema documentation
- Add to repository at `sogo6-server/openapi.json`
- Reference in all API documentation

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| OpenAPI spec generated | Yes | File exists at sogo6-server/openapi.json |
| API client created | Yes | Library at src/lib/api/client/ |
| UI wired to backend | Yes | Real API calls functional |
| FakeAPI optional | Yes | Controlled by env var |
| Missing features implemented | 100% | All spec endpoints working |
| Code cleaned up | Yes | No stubs in production paths |

## Files to Create

1. `sogo6-server/openapi.json` - OpenAPI specification
2. `sogo6-server/openapi.yaml` - OpenAPI specification (YAML format)
3. `sogo6-ui/src/lib/api/client/base-client.ts` - Base HTTP client
4. `sogo6-ui/src/lib/api/client/auth-client.ts` - Auth client
5. `sogo6-ui/src/lib/api/client_types.ts` - TypeScript types
6. `sogo6-ui/src/lib/api/endpoints/*.ts` - API endpoint wrappers
7. `sogo6-ui/src/lib/api/index.ts` - API exports
8. `sogo6-ui/src/lib/api/config.ts` - API configuration
9. `sogo6-ui/src/lib/api/router.ts` - API router (real vs fake)

## Files to Modify

1. `sogo6-server/scripts/generate-openapi.py` - Fix/enhance generator
2. `sogo6-ui/src/proxy.ts` - Update routing logic
3. `sogo6-ui/.env.local.example` - Add API configuration
4. `sogo6-ui/next.config.js` - Add environment variables
5. `sogo6/nubusintercom/app.py` - Remove demo data fallback
6. `.openspec/specs/INDEX.md` - Add OpenAPI reference
7. `.openspec/specs/architecture.spec.md` - Update with complete implementation status

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing fakeAPI usage | Medium | High | Make fakeAPI optional, default to enabled in dev |
| Backend API changes needed | Low | Medium | Verify against existing code first |
| TypeScript type errors | Medium | Low | Use type-safe API generation |
| Production environment misconfiguration | Low | High | Documentation + validation |
| Performance issues with real API | Low | Medium | Add caching, optimize requests |

## Rollout Plan

### Phase 1: Foundation (Today)
1. Generate OpenAPI spec
2. Create API client base
3. Create API endpoint wrappers

### Phase 2: Integration (Next)
4. Add environment switching
5. Update proxy configuration
6. Create API router

### Phase 3: Cleanup (Next)
7. Identify/implement missing features
8. Clean up fakeAPI stubs
9. Update documentation

### Phase 4: Testing (Last)
10. Test all endpoints
11. Validate integration
12. Performance testing

---

## References

- [Project Specification](../../project.spec.md)
- [Architecture Specification](../../specs/architecture.spec.md)
- [API Documentation](../../specs/authentication.spec.md)
- [Phase 5 Progress Report](../../specs/PHASE5_PROGRESS.md)
- [Existing OpenAPI Generator](../../sogo6-server/scripts/generate-openapi.py)
- [UI Proxy Configuration](../../sogo6-ui/src/proxy.ts)
- [Current fakeApi Implementation](../../sogo6-ui/src/app/fakeApi/)

---

**Status**: In Progress  
**Started**: August 5, 2026  
**Estimated Completion**: August 6, 2026  
**Priority**: High
