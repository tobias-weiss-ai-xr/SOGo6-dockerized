# SOGo 6 — Comprehensive Test Strategy & Feature Verification

> **Goal:** 99%+ test coverage across all 81 roadmap features.
> **Scope:** All Tiers 0–7 — every API endpoint, service, and UI component.

**Last Updated:** 2026-07-27 — Numbers reflect actual test suite from `SUMMARY.md`.

---

## 1. Test Pyramid

```
         ╱  E2E (Playwright)          ╲    ← 23 critical user paths (4 spec files)
        ╱   Integration (API + bash)   ╲   ← 29 admin API + Python integration tests
       ╱    Unit (backend)              ╲  ← 1,723 Python tests (128 test files)
      ╯     Unit (frontend)              ╰ ← 69 Jest tests (20+ component test files)
     ╱─────────────────────────────────────╲
    ╱   Load / Performance (k6)           ╲ ← 3 suites: admin API, user API, sync
```

> **Note:** The **Contract / Property-based** layer (hypothesis fuzz tests) was planned
> at `tests/test_properties/` but has **not been implemented yet**. See section 8.

### Layer Breakdown

| Layer | Count | Tool | Location |
|-------|-------|------|----------|
| **Backend Unit** | 1,723 | pytest | `sogo6-server/tests/test_interface/`, `sogo6-server/tests/test_module/` |
| **Frontend Unit** | 69 | jest + RTL | `sogo6-ui/src/**/__tests__/` |
| **API Integration** | 29 (bash) + Python | pytest + requests + bash | `tests/integration/`, `tests/admin-api-test.sh` |
| **E2E** | 23 | Playwright | `tests/e2e/specs/` (4 spec files) |
| **Load** | 3 suites | k6 | `tests/load/k6-admin-api.js`, `tests/load/k6-user-api.js`, `tests/load/sync-benchmark.py` |
| **SMTP** | 32 | bash | `tests/smtp-test.sh` |
| **Contract** | 0 | — | ❌ Not yet implemented — planned as `tests/test_properties/` |

---

## 2. Feature Coverage Matrix

### Tier 0 — Foundation (8 features)

| # | Feature | Backend Tests | Frontend Tests | Integration | E2E | Status |
|---|---------|:------------:|:--------------:|:-----------:|:---:|:------:|
| 1 | CalDAV Sync | ✅ 12 | — | ✅ 3 | — | ✅ |
| 2 | Shared Mailboxes | ✅ 8 | ✅ 2 | ✅ 2 | — | ✅ |
| 3 | WebAuthn / Passkeys | ✅ 6 | ✅ 4 | ✅ 2 | ✅ 1 | ✅ |
| 4 | Swagger API Playground | — | ✅ 1 | ✅ 1 | — | ✅ |
| 5 | Sieve Editor UI | — | ✅ 3 | — | — | ✅ |
| 6 | DNS Wizard | ✅ 4 | — | ✅ 2 | — | ✅ |
| 7 | Resource Booking | ✅ 5 | — | ✅ 2 | — | ✅ |
| 8 | Undo Send | ✅ 10 | — | ✅ 2 | — | ✅ |

### Tier 1 — Core Experience (14 features)

| # | Feature | Backend Tests | Frontend Tests | Integration | E2E | Status |
|---|---------|:------------:|:--------------:|:-----------:|:---:|:------:|
| 9 | Conversation View | ✅ 4 | ✅ 2 | — | — | ✅ |
| 10 | Calendar Subscriptions | ✅ 6 | ✅ 3 | ✅ 2 | — | ✅ |
| 11 | Working Hours / Location | ✅ 2 | ✅ 2 | — | — | ✅ |
| 12 | Undo Send | ✅ 10 | — | ✅ 2 | — | ✅ |
| 13 | Schedule Send | ✅ 10 | ✅ 2 | ❌ 0 | ❌ 0 | ⚠️ |
| 14 | Email Snooze | — | — | — | — | ❌ N/A |
| 15 | Push Notifications | ❌ 0 | ❌ 0 | ❌ 0 | ❌ 0 | ❌ |
| 16 | Cmd+K Quick Search | — | ✅ 1 | — | ❌ 0 | ⚠️ |
| 17 | PWA / Mobile Web | — | — | — | ❌ 0 | ⚠️ |
| 18 | Keyboard Shortcuts | — | ✅ 1 | — | — | ⚠️ |
| 19 | PGP Encryption | ❌ 0 | ❌ 0 | ❌ 0 | ❌ 0 | ❌ |
| 20 | Follow-Up Flags | ❌ 0 | ❌ 0 | — | — | ❌ |
| 21 | Quick Reply Templates | — | ✅ 1 | — | — | ✅ |
| 22 | Drag-and-Drop Attachments | — | ✅ 2 | — | — | ✅ |

### Tier 2 — Admin & Scale (14 features)

| # | Feature | Backend Tests | Frontend Tests | Integration | E2E | Status |
|---|---------|:------------:|:--------------:|:-----------:|:---:|:------:|
| 23 | Helm Chart / K8s | — | — | — | — | 📋 infra |
| 24 | Audit Log | ❌ 0 | — | ❌ 0 | — | ❌ |
| 25 | Backup Automation | — | — | — | — | 📋 script |
| 26 | Grafana Dashboards | — | — | — | — | 📋 config |
| 27 | Multi-Tenant Branding | ❌ 0 | — | ❌ 0 | — | ❌ |
| 28 | API Tokens | ❌ 0 | — | ❌ 0 | — | ❌ |
| 29 | WebSocket Live Updates | ❌ 0 | — | ❌ 0 | — | ❌ |
| 30 | Migration Tools | — | — | — | — | 📋 CLI |
| 31 | Bulk User Management | ❌ 0 | — | ❌ 0 | — | ❌ |
| 32 | Usage Quotas | ❌ 0 | — | ❌ 0 | — | ❌ |
| 33 | System Health Dashboard | ❌ 0 | — | ❌ 0 | — | ❌ |
| 34 | Database Migration UI | — | — | — | — | 📋 script |
| 35 | Mailbox Debug Panel | ❌ 0 | — | ❌ 0 | — | ❌ |
| 36 | Configuration as Code | — | — | — | — | 📋 |

### Tier 3 — Ecosystem (9 features)

| # | Feature | Backend Tests | Frontend Tests | Integration | E2E | Status |
|---|---------|:------------:|:--------------:|:-----------:|:---:|:------:|
| 37 | OpenCloud Integration | — | — | — | — | 📋 config |
| 38 | nubusintercom | — | — | — | — | 📋 config |
| 39 | Keycloak | — | — | — | — | 📋 infra |
| 40 | Nubus Portal | — | — | — | — | 📋 docs |
| 41 | Webhook System | ❌ 0 | — | ❌ 0 | — | ❌ |
| 42 | Document Preview | — | — | — | — | 📋 infra |
| 43 | File Picker Widget | — | — | — | — | 📋 frontend |
| 44 | OIDC Provider | ❌ 0 | — | ❌ 0 | — | ❌ |
| 45 | OAuth2 Provider | ❌ 0 | — | ❌ 0 | — | ❌ |

### Tier 4 — Team (10 features)

| # | Feature | Backend Tests | Frontend Tests | Integration | E2E | Status |
|---|---------|:------------:|:--------------:|:-----------:|:---:|:------:|
| 46 | Scheduling Polls | ❌ 0 | — | ❌ 0 | — | ❌ |
| 47 | Appointment Slots | ❌ 0 | — | ❌ 0 | — | ❌ |
| 48 | Free/Busy Lookup | ✅ 3 | — | ✅ 1 | — | ✅ |
| 49 | Collaborative Drafts | ❌ 0 | — | ❌ 0 | — | ❌ |
| 50 | Approval Workflows | ❌ 0 | — | — | — | ❌ |
| 51 | Helpdesk / Ticketing | ❌ 0 | — | — | — | ❌ |
| 52 | File Sharing | ❌ 0 | — | ❌ 0 | — | ❌ |
| 53 | CRM-light | ❌ 0 | — | — | — | ❌ |
| 54 | Workflow Builder | ❌ 0 | — | — | — | ❌ |
| 55 | Custom Actions | ❌ 0 | — | — | — | ❌ |

### Tier 5 — AI & Intelligence (10 features)

| # | Feature | Backend Tests | Frontend Tests | Integration | E2E | Status |
|---|---------|:------------:|:--------------:|:-----------:|:---:|:------:|
| 56 | Email Summarization | ❌ 0 | — | ❌ 0 | — | ❌ |
| 57 | Email Classification | ❌ 0 | — | ❌ 0 | — | ❌ |
| 58 | AI Draft Assistant | ❌ 0 | — | ❌ 0 | — | ❌ |
| 59 | Natural Language Search | ❌ 0 | — | ❌ 0 | — | ❌ |
| 60 | Smart Scheduling | ❌ 0 | — | — | — | ❌ |
| 61 | Anomaly Detection | ❌ 0 | — | ❌ 0 | — | ❌ |
| 62 | Contact Enrichment | ❌ 0 | — | ❌ 0 | — | ❌ |
| 63 | Attachment Actions | ❌ 0 | — | — | — | ❌ |
| 64 | Spam Filtering | ❌ 0 | — | — | — | ❌ |
| 65 | Transcript / Summary | ❌ 0 | — | — | — | ❌ |

---

## 3. API Contract Verification

Every API endpoint must verify:

### 3.1 HTTP Contract

```
✅ Correct HTTP method (GET/POST/PUT/PATCH/DELETE)
✅ Correct status codes (200, 201, 400, 401, 404, 500)
✅ Proper Content-Type: application/json
✅ Consistent error envelope: {error_code, error_msg, data}
✅ Authentication required (401 when missing)
✅ Authorization enforced (403 when wrong scope)
✅ Input validation (400 on bad input)
```

### 3.2 Error Envelope

```json
{
  "error_code": "S000000",
  "error_msg": "No Error",
  "data": { ... }  // or null on error
}
```

### 3.3 Pagination (for list endpoints)

```
Query params: page, page_size, sort_by, sort_order
Response: { ..., total, page, page_size, total_pages }
```

---

## 4. Implementation Priority

### Phase 1 — Close Existing Coverage Gaps (current sprint)

| Priority | Area | Tests Needed | Why |
|----------|------|:-----------:|-----|
| 🔴 P0 | **API endpoint coverage** (`app/api/`) | ~200 unit + ~30 integration | Currently at 12% — 33 of 41 endpoints untested |
| 🔴 P0 | **Schedule Send E2E** | 2 E2E | Has 10 unit tests but no E2E — high risk |
| 🔴 P0 | **Free/Busy UI integration** | 4 unit + 2 E2E | Backend done but frontend free/busy display untested |

### Phase 2 — New Features

| Priority | Feature | Tests Needed | Why |
|----------|---------|:-----------:|-----|
| 🟠 P1 | Push Notifications | 6 unit + 2 integration | Core real-time feature |
| 🟠 P1 | PGP Encryption | 8 unit + 2 integration | Security-critical |
| 🟠 P1 | Webhook System | 6 unit + 2 integration | Integration-critical |
| 🟠 P1 | OAuth/OIDC Provider | 8 unit + 3 integration | Auth-critical |
| 🟠 P1 | Audit Log | 4 unit + 2 integration | Compliance |
| 🟠 P1 | API Tokens | 4 unit + 2 integration | Integration enabler |

### Phase 3 — Admin & Scale

| Priority | Feature | Tests Needed | Why |
|----------|---------|:-----------:|-----|
| 🟡 P2 | Frontend unit tests (target 200+) | ~130 new tests | Currently 69 vs. target 200+ |
| 🟡 P2 | Bulk Users | 4 unit + 1 integration | Admin productivity |
| 🟡 P2 | Health Dashboard | 2 unit + 1 integration | Ops visibility |
| 🟡 P2 | Usage Quotas | 3 unit + 1 integration | Production requirement |
| 🟡 P2 | Scheduling Polls | 4 unit + 2 integration | High visibility |
| 🟡 P2 | Appointment Slots | 4 unit + 2 integration | High visibility |

### Phase 4 — Advanced & AI

| Priority | Feature | Tests Needed | Why |
|----------|---------|:-----------:|-----|
| 🔵 P3 | Contract/Property-based tests | ~20 hypothesis properties | Fuzz testing for API schema conformance |
| 🔵 P3 | AI Summarization | 4 unit + 1 integration | High visibility |
| 🔵 P3 | AI Classification | 4 unit + 1 integration | Core ML |
| 🔵 P3 | Collaborative Drafts | 4 unit + 1 integration | Team workflow |
| 🔵 P3 | File Sharing | 3 unit + 1 integration | Utility |

---

## 5. Coverage Targets

| Module | Current | Target | Gap |
|--------|:-------:|:------:|:---:|
| `app/interface/` | 72% | 99% | 27% |
| `app/module/` | 68% | 99% | 31% |
| `app/api/` | 12% | 99% | 87% |
| `app/service/` | 0% | 99% | 99% |
| `app/manager/` | 81% | 99% | 18% |
| `app/config/` | 65% | 99% | 34% |
| `app/auth/` | 78% | 99% | 21% |
| **Overall (app/)** | **~55%** | **99%** | **44%** |
| **Total tests passing** | **>1,800** (1,723 Python + 69 Jest + 29 bash + 23 Playwright + 32 SMTP) | — | — |

**Key insight:** The backend has excellent unit coverage (1,723 tests) but the API layer
(`app/api/`) is severely lacking at only 12%. Most API endpoints have no dedicated
integration tests. The frontend also needs significant expansion (69 tests vs. target 200+).

### Contract / Property-based Tests (Missing)

The planned hypothesis fuzz tests at `tests/test_properties/` have **not been implemented**.
This layer would add property-based verification for:
- API error envelope schema conformance
- Input validation edge cases
- State machine models for calendar/mail workflows
- Invariant checking (e.g., free/busy always returns valid periods)

**Priority:** Low — will be implemented after core unit/integration coverage reaches 80%.

### Measurement

```bash
# Run with coverage
pytest --cov=app --cov-report=term-missing --cov-report=html
```

---

## 6. Test Implementation Pattern

### Backend Unit Test Pattern

```python
class FakeModule:
    """Fake for testing."""
    def __init__(self):
        self.calls = []
        self.result = {}

class TestFeature:
    def setup_method(self):
        self.fake = FakeModule()
        self.iface = InterfaceWithInjectedConf(self.fake)

    def test_happy_path(self):
        result, status = self.iface.some_method()
        assert status == 200
        assert result["data"] is not None
```

### Integration Test Pattern

```python
def test_api_create_feature(admin_jwt):
    resp = requests.post(
        f"{API_BASE}/api/admin/v1/feature",
        headers={"Authorization": f"Bearer {admin_jwt}"},
        json={"name": "test"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["error_code"] == "S000000"
```

---

## 7. Running the Tests

```bash
# Backend unit tests
cd sogo6-server && pytest tests/ -v --cov=app

# Specific feature tests
pytest tests/test_interface/test_mail/ -v

# Integration tests (need running stack)
cd .. && bash tests/run-all-tests.sh

# Frontend tests
cd sogo6-ui && npx jest --coverage

# E2E tests
cd tests/e2e && npx playwright test

# Full coverage report
pytest --cov=app --cov-report=term-missing --cov-report=html
open htmlcov/index.html
```

---

## 8. Current Status Summary

| Metric | Value |
|--------|:-----:|
| **Total API endpoints** | 41 |
| **APIs with tests** | 8 (19%) |
| **APIs without tests** | 33 (81%) |
| **Backend Python tests** | **1,723 passing** (128 test files) |
| **Frontend Jest tests** | **69 passing** (6 pre-existing a11y failures) |
| **Admin API bash tests** | **29 passing** |
| **Playwright E2E tests** | **23 passing** (4 spec files) |
| **SMTP TLS tests** | **32 passing** |
| **Load tests (k6)** | **3 suites, 100% pass** (admin ~25ms, user ~8ms, sync 100/100) |
| **Contract/Property-based tests** | **0** — hypothesis layer not yet implemented |
| **Current coverage (app/)** | ~55% |
| **Target coverage** | 99% |
| **Tests to write** | ~200 unit (API layer) + ~130 frontend + ~30 integration + ~10 E2E |

### Key Gaps

1. **API layer (`app/api/`) at 12%** — biggest coverage hole. 33 of 41 endpoints have no dedicated tests.
2. **Frontend at 69 tests** — needs ~130+ more to reach the 200+ component test target.
3. **Contract layer missing** — hypothesis fuzz tests for schema conformance not yet implemented.
4. **API integration tests undercounted** — the 29 bash admin API tests exist, but Python integration layer needs expansion.
