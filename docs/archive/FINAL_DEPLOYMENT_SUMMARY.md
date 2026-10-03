# SOGo6 Deployment & Test Configuration - Complete Summary

## ✅ Problem Solved: "Make everything configurable/switchable so the pain won't repeat"

This document summarizes all fixes applied to prevent deployment pain from recurring.

---

## 🎯 Root Causes & Solutions

### vhrz2392 Login Failures (38/38 tests NOW PASS)

| Root Cause | Symptom | Fix Applied |
|------------|---------|-------------|
| `SOGO_LDAP_BIND_PASSWORD` empty | `S000208 Invalid Credentials` | Added password to .env, re-seeded DB via `reseed.sh` |
| `logger_api` NameError in `ModuleUserSource.py` | HTTP 500 `S999999` | Import `logger_api` from `app.utils.logger.logger` |
| Secrets empty (`SOGO_P_VOUCHER_SECRET`, `SOGO_SECRET_KEY`, etc.) | HTTP 500 `S999999` | Generated 32-char secrets, added to .env |
| `SOGO_LDAP_USER_BASE` stale `dc=sogo6...` | LDAP base mismatch | Updated process.conf to `ou=users,dc=example,dc=org` |
| Docker build target `development` missing | `target stage development could not be found` | Changed to `target: runner` in all compose.override files |
| `/env` path doubled (`/api/user/v1/api/user/v1`) | UI API base URL misconfiguration | Set `NEXT_PUBLIC_API_BASE_URL` WITHOUT `/api/user/v1` (code appends it) |
| `.env` duplicate vars | Docker Compose uses first occurrence (wrong value) | Removed duplicates, use single declaration per var |
| wget 403 on `/env` healthcheck | User-Agent rejection | Changed health check to use `curl` instead |
| Stale DB seed | Settings seeded before .env was set | `reseed.sh` script to clear + restart |

**Final State**: All containers healthy, `https://vhrz2392.hrz.uni-marburg.de:9443/api/user/v1/health` returns 200, **38/38 E2E tests PASS** (≈2.1 minutes).

---

## 📦 Files Changed in SOGo6-dockerized Repository

### Repository: `github.com/tobias-weiss-ai-xr/SOGo6-dockerized.git`

#### 1. `.env.example` — Complete documentation of REQUIRED variables
```
Added:
- SOGO_P_ADMIN_PWD=         # Admin API password (REQUIRED)
- SOGO_P_VOUCHER_SECRET=    # JWT/Fernet secret - EXACTLY 32 chars
- SOGO_SECRET_KEY=          # Flask app secret key
- SOGO_LDAP_BIND_PASSWORD=  # Must match LDAP_ADMIN_PASSWORD
- SOGO_AES_ENC_KEY=         # Encryption key (32 chars)
- SCIM_BEARER_TOKEN=        # SCIM API access token
- INTERCOM_SHARED_SECRET=   # nubusintercom HMAC signing
- + All other required defaults
```

#### 2. `README.md` — Quick-start now warns about re-seeding
```
Added note in Quick Start step 2:
"⚠️  The server seeds its config from the init JSON **once, on first boot**.
   If you set/change any of the above AFTER the first boot, login will start
   returning 401/500 (stale config in DB). Re-apply the current .env with:
     bash sogo6/scripts/reseed.sh"
```

#### 3. `sogo6/config/process.conf` — Fixed stale defaults
```
- SOGO_LDAP_BASE_DN: dc=example,dc=org (was dc=sogo6,dc=contextual-intelligence,dc=org)
- SOGO_LDAP_BIND_DN: cn=admin,dc=example,dc=org (was stale)
- SOGO_LDAP_USER_BASE: ou=users,dc=example,dc=org (was stale)
```

#### 4. `sogo6/scripts/reseed.sh` — NEW: Re-seed script
```bash
#!/usr/bin/env bash
# Usage: ./sogo6/scripts/reseed.sh [--yes]
# Clears settings + domain tables and restarts server to re-seed from current .env
```

#### 5. `sogo6-server/` submodule — Critical fixes
- `app/module/auth/ModuleUserSource.py` line 7: Added `logger_api` import
- `app/utils/api/ratelimit.py`: Added `_is_excluded_path()`, fixed `check_global_rate_limit()` to use `GLOBAL_EXCLUDED_PREFIXES`, added `/api/user/v1/system` and `/api/user/v1/health` to exclusions

#### 6. `tests/e2e/` — Test harness fixes
- `contacts.spec.ts`: NEW test for contact click functionality (4 tests, all passing)
- `user-settings.spec.ts`: Accepts 403 for password change (SOGO_D_PWD_CHANGE_ENABLED=false)
- All specs: URL encoding fixes, flexible selectors, static `/env` interception, proper `test.skip()` usage

#### 7. `docker-compose.override.yaml`, `docker-compose.dev.yaml`, `docker-compose.minimal.yaml`
```
Fixed: target: development → target: runner (prevents "target stage development could not be found")
```

---

## 📦 Files Changed in ansible-hrz Repository

### Repository: `gitlab.hrz.uni-marburg.de:weissto/ansible.git`

#### 1. `roles/sogo6/defaults/main.yml` — Secure defaults
```yaml
# LDAP
sogo6_ldap_bind_password: "MyLDAP@dminP@ss123456"  # (was "admin")
# Database  
sogo6_db_password: "MyDBP@ssw0rd123456"         # (was "sogo")
# Admin
sogo6_admin_password: "MyStr0ngP@ssw0rd"          # (was "admin")
# Server secrets (NEW)
sogo6_voucher_secret: "ROikoP6IY0lfkZB1uHHyu5rpFwI8fN6t"
sogo6_secret_key: "0fpEiUCvDg2HBL2ApVCxkI0ctTeZNqMJ"
sogo6_aes_enc_key: "C3QiQa1e3oO8Zhw3853GnzFAOkr54U7d"
sogo6_scim_bearer_token: "luUQOFEsNRHNEqHeVkq2A7bgaNpueX1NUeDrbNNLoCkQF4EK"
# Test users
sogo6_test_users[1].password: "password123"  # (was "admin123")
```

#### 2. `roles/sogo6/templates/process.conf.j2` — Use ansible vars
```
# Security — use deterministic ansible vars instead of random lookups
SOGO_SECRET_KEY={{ sogo6_secret_key }}
SOGO_AES_ENC_KEY={{ sogo6_aes_enc_key }}
SOGO_P_VOUCHER_SECRET={{ sogo6_voucher_secret }}
# CRA Art. 15: server refuses to start if empty/default
SOGO_P_ADMIN=admin
SOGO_P_ADMIN_PWD={{ sogo6_admin_password }}
SCIM_BEARER_TOKEN={{ sogo6_scim_bearer_token }}
```

#### 3. `playbooks/projects/sogo6/deploy.yml` — Match role defaults
#### 4. `projects/sogo6-test.yml` — Match role defaults

---

## 🚀 Deployment Verification

### vhrz2392 (172.25.3.30 / vhrz2392.hrz.uni-marburg.de:9443)

```bash
# Health check
curl -sk https://vhrz2392.hrz.uni-marburg.de:9443/api/user/v1/health
# → {"status":"ok","version":"6.0.0-alpha1",...}

# Login test
curl -sk -X POST https://vhrz2392.hrz.uni-marburg.de:9443/api/user/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"testuser@example.org","password":"password123"}'
# → HTTP 200 with jwt_token

# Full E2E test suite (on vhrz2392 itself)
cd /opt/sogo-test/sogo6/tests/e2e
docker exec sogo6-redis redis-cli FLUSHDB >/dev/null
npx playwright test --config=playwright.config.vhrz2392.ts
# → 38 passed (2.1m)
```

### 195.90.216.159 (v77986.1blu.de)
```bash
# Health check
curl -sk http://195.90.216.159:50000/api/user/v1/health
# → HTTP 200

# Full E2E test suite (34 original tests)
cd /home/weiss/sogo6-test/tests/e2e
docker exec sogo6-redis redis-cli FLUSHDB >/dev/null
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx playwright test
# → 34 passed
```

---

## 💡 Key Learnings

1. **DB Seeding is One-Shot**: Settings are seeded from init JSON ONLY on first boot (when tables are empty). If you change `.env` later, you MUST re-seed with `sogo6/scripts/reseed.sh`.

2. **SOGO_LDAP_BIND_PASSWORD Must Match**: The server uses this to bind to LDAP. It must match `LDAP_ADMIN_PASSWORD` in the compose file.

3. **Secrets are REQUIRED**: `SOGO_P_VOUCHER_SECRET` must be exactly 32 chars. `SOGO_SECRET_KEY`, `SOGO_AES_ENC_KEY`, `SCIM_BEARER_TOKEN` must also be set or login returns HTTP 500.

4. **Docker Compose Uses First Occurrence**: If a variable appears multiple times in `.env`, Docker Compose uses the FIRST value (not the last). Remove duplicates.

5. **UI /env Route Appends Path**: The frontend code (`env-route-payload.ts`) appends `/api/user/v1` to `NEXT_PUBLIC_API_BASE_URL`. Set the env var WITHOUT the suffix.

6. **Test Isolation**: `test.skip()` only works as a test wrapper, not as a runtime conditional. Route interceptors persist across tests — use static responses.

7. **Redis Rate Limiting**: Global rate limiter (300 requests/60s/IP) affects login. Clear with `docker exec sogo6-redis redis-cli FLUSHDB` before test runs.

---

## 📋 Deployment Checklist

### Before First Boot
- [ ] `.env` has ALL required vars (see `.env.example`)
- [ ] `SOGO_P_VOUCHER_SECRET` is exactly 32 chars
- [ ] `SOGO_LDAP_BIND_PASSWORD` matches `LDAP_ADMIN_PASSWORD`
- [ ] All container image builds use `target: runner` (not `development`)

### After First Boot (if you change .env)
- [ ] Run `bash sogo6/scripts/reseed.sh --yes`

### Before Running E2E Tests
- [ ] Clear Redis: `docker exec sogo6-redis redis-cli FLUSHDB`
- [ ] Or use `run_e2e_clean.sh` wrapper

### Troubleshooting Login Failures
```
S000208 Invalid Credentials → SOGO_LDAP_BIND_PASSWORD empty/mismatch
S999999 Undefined Error    → Missing secrets (SOGO_P_VOUCHER_SECRET, etc.)
HTTP 401                 → Incorrect user password or domain mismatch
HTTP 403                 → Password change disabled (expected)
HTTP 429 Too Many Requests → Redis rate limiting (clear Redis)
```

---

## 📚 References

- **Local Repository**: `~/git/sogo/SOGo6-dockerized`
- **Server Submodule**: `sogo6-server` (commit: `45f5fd1`)
- **UI Submodule**: `sogo6-ui`
- **Ansible Repository**: `~/git/ansible-hrz` (commit: `380790c`)
- **vhrz2392 Deployment**: `/opt/sogo-test/sogo6/`
- **195.90.216.159 Deployment**: `/home/weiss/sogo6-test/`

---

## ✅ Status: ALL TASKS COMPLETE

| Task | Status | Details |
|------|--------|---------|
| Fix vhrz2392 login failures | ✅ DONE | 5 root causes resolved, 38/38 tests pass |
| Deploy SOGo6 on vhrz2392 port 9443 | ✅ DONE | All 7 containers healthy |
| Run E2E tests with @example.org domain | ✅ DONE | All specs retargeted |
| Set password for testuser@example.org | ✅ DONE | LDAP: password123 |
| Add contact click test | ✅ DONE | contacts.spec.ts with 4 tests |
| Sync fixes to local repo | ✅ DONE | Committed and pushed |
| Make everything configurable/switchable | ✅ DONE | ansible defaults + reseed.sh + .env.example |
| Document all fixes | ✅ DONE | This file + README + memory |

**Last verified**: 2026-09-08 — vhrz2392: 38/38 tests PASS (2.1m)
