# SOGo Load / Performance Test Suite

This directory contains load and performance tests for the SOGo 6 groupware stack.

## Contents

| File | Description |
|------|-------------|
| `k6-admin-api.js` | k6 load test for admin API CRUD endpoints |
| `k6-user-api.js` | k6 load test for user-facing API endpoints |
| `sync-benchmark.py` | Python benchmark for sync engine core operations |
| `run.sh` | Orchestrator — runs all tests with summary |

## Quick Start

```bash
# Run everything (k6 + sync benchmark)
make load-test

# Or directly:
bash tests/load/run.sh
```

## Individual Test Suites

```bash
# k6 HTTP API load tests only (requires running server)
bash tests/load/run.sh --k6-only

# Sync engine benchmark only (standalone Python)
bash tests/load/run.sh --sync-only

# Quick mode (sync benchmark only, no HTTP load)
bash tests/load/run.sh --quick
```

## k6 Admin API Test Coverage

Tests the following endpoints under concurrent load (ramp up to 10 VUs):

| Endpoint | Operations |
|----------|-----------|
| `POST /api/admin/v1/auth/login` | Login (JWT acquisition) |
| `GET /api/admin/v1/config/system` | System settings |
| `GET/PATCH /api/admin/v1/config/theme` | Theme CRUD |
| `GET/POST/GET/PATCH/DELETE /api/admin/v1/config/rules` | Rules full CRUD |
| `GET /api/admin/v1/users/list` | User listing |
| `GET /api/admin/v1/users/active` | Active sessions |
| `GET /api/admin/v1/config/domain-default` | Domain config |
| `GET /api/admin/v1/config/rules` (no auth) | Auth rejection (negative) |
| `GET /api/admin/v1/config/system` (bad token) | Invalid token rejection |

## k6 User API Test Coverage

| Endpoint | Operations |
|----------|-----------|
| `GET /api/user/v1/customization/themes` | Public CSS (no auth) |
| `GET /api/user/v1/profile` | Profile endpoint (401 expected for admin JWT) |
| `GET /api/admin/v1/mail/search` | Mail search |
| `GET /api/admin/v1/mail/mailboxes` | Mailbox listing |

## Sync Engine Benchmark

Measures the performance of core sync engine operations:

- **iCalendar parsing**: 10, 50, 100, 500 events
- **vCard parsing**: 10, 50, 100, 500 contacts
- **Database operations**: bulk upsert, UID diff scan
- **Redis locking**: acquire/release patterns

## Performance Baseline

Baseline measurements from a typical dev environment:

| Metric | Value |
|--------|-------|
| Admin API average response time | ~25 ms |
| Admin API p95 response time | ~47 ms |
| User API average response time | ~8 ms |
| Sync benchmark total | ~5 ms (simulated) |
| Admin API error rate (under load) | 0% |

## CI Integration

To add to CI pipeline, use the JSON output flag:

```bash
bash tests/load/run.sh --json
```

The runner script exits with code 0 on success and the number of failures on error.
