# Test Coverage Ratchet — Design

- **Date:** 2026-10-17
- **Status:** Approved during brainstorming
- **Scope:** backend pytest (`sogo6-server`), frontend jest (`sogo6-ui`)

## Problem

Coverage is effectively unenforced across the unit-test suites today:

| Suite | Size | Situation |
|---|---|---|
| `sogo6-server` (pytest) | 534 test files | `fail_under=66` exists in `pyproject.toml` but is **unenforceable** — collection aborts before a single test runs |
| `sogo6-ui` (jest) | 568 test files | `collectCoverage: true` is set but **no `coverageThreshold`** — nothing is gated |

Root cause of the backend failure: `app/config/settings/ProcessSetting.py:308` instantiates
`ProcessSetting()` at import time, and pydantic requires `SOGO_P_VOUCHER_SECRET` and
`SOGO_AES_ENC_KEY`. `tests/conftest.py` only pre-seeds `SOGO_P_REDIS_URL`, so
`tests/test_integration/conftest.py` fails to import → **pytest exits 4 with zero tests
collected** → the coverage report shows a bogus ~1% (system python) / ~4% (`.venv`) total,
then fails the gate.

## Goal

Make both coverage gates **real and enforceable**, with floors that fail only on regression.

## Non-goals

- **Parity/e2e suite (`SOGo6-testsuite`)** — deferred. Line coverage is impossible for a
  black-box e2e suite; a feature-surface (`sg_require`) coverage report was considered and
  explicitly dropped from this round.
- **Writing new tests to raise coverage** — gap-filling is a separate follow-up; this design
  only makes measurement and gating trustworthy.
- **Step-up (ratcheting) gates** — user chose floor-only.

## Design

### C1 — Hermetic bootstrap (`sogo6-server/tests/conftest.py`)

Extend the existing `os.environ.setdefault("SOGO_P_REDIS_URL", …)` pattern with two more
entries:

- `SOGO_P_VOUCHER_SECRET` → an obviously-dummy value (e.g. `test-only-voucher-secret`)
- `SOGO_AES_ENC_KEY` → a fixed, obviously-dummy 32-byte base64 value
- `SOGO_P_ADMIN_PWD` → an obviously-dummy value (added during implementation:
  `init_sogo()` → `_check_admin_password_hardening()` at import time rejects an
  empty or literal `admin` password)

Both must be clearly test-only and never usable as real credentials, and both keep the
existing behaviour where a real environment variable overrides the default. Add a comment
mirroring the current `_proc_setting()` / "raw environment takes precedence" rationale.

**Acceptance:** `python -m pytest tests/ -q` collects and runs — no conftest
ImportError/ValidationError.

**Implementation finding — hermeticity is not purely env-vars.** After the three
settings, import proceeds but `init_sogo()` → `init_infra()` pings Redis and raises
`AggravatedException("Redis server is unavailable")` when unreachable. A coverage run
therefore still requires a live Redis, exactly as `python_tests.yaml` provides via a
`redis:7-alpine` service. (CI also does not set `SOGO_AES_ENC_KEY` — a separate latent
CI issue, out of scope here.)

### C2 — Backend ratchet (`sogo6-server/pyproject.toml`)

Once C1 lands, measure once with the runner that has the real deps and a live Redis:

```
docker run -d --name sogo6-cov-redis -p 127.0.0.1:6379:6379 redis:7-alpine
PYTHON=.venv/bin/python SOGO_P_REDIS_URL=redis://localhost:6379/0 ./tests/run-coverage.sh
```

(System `python3` lacks `flask_smorest`; `.venv` has pytest 9.1.1 + coverage 7.16.1.)

Set `[tool.coverage.report].fail_under` to the floor of the measured total, **never below
the existing 66** unless measurement proves 66 unreachable — and if it is unreachable, that
is a finding to report, not a silent lowering. Keep `run-coverage.sh` as the single entry
point; no new scripts.

**Measured 2026-10-17:** total **79%** (40009 statements, 8532 missing; 330 files
skipped-fully-covered; 4984 passed, 1 env-flaky failure). Floor raised `66 → 79`.

### C3 — UI ratchet (`sogo6-ui/jest.config.ts`)

Measure with a clean full run:

```
npx jest --coverage --coverageReporters=json-summary,text-summary
```

The default `maxWorkers` previously caused a Termination on this workstation; in the end
the configured `maxWorkers: '50%'` completed a full clean run (≈44 min) with no tuning
needed. Run it in the background and wait — do not use `--maxWorkers=1`, which stalls.

Add `coverageThreshold.global = { statements, branches, functions, lines }`, each set to
the floor of the measured value, rounded down. **No per-module thresholds** (YAGNI).

**Measured 2026-10-17** (clean full run, `npx jest --coverage`, 584 suites / 6058 tests,
~44 min, `maxWorkers: '50%'`):

| metric | measured | floor set |
|---|---|---|
| statements | 55.15% (64411/116788) | 55 |
| lines | 55.15% (64411/116788) | 55 |
| branches | 72.46% (5624/7761) | 72 |
| functions | 52.91% (1525/2882) | 52 |

Note: the husky hooks run jest with `--coverage=false`, so this threshold is enforced by
`npm test` / `npm run test:coverage`, **not** by pre-commit/pre-push.

## Data flow / error handling

- **pytest:** coverage.py enforces `fail_under` at the end of `run-coverage.sh` and exits
  non-zero on regression.
- **jest:** `coverageThreshold` makes jest exit non-zero on regression.
- Nothing swallows either exit code; both gates fail loudly.

## Verification

1. `cd sogo6-server && PYTHON=.venv/bin/python ./tests/run-coverage.sh` → runs, exits 0,
   prints a real total (not 1–4%).
2. `cd sogo6-ui && npx jest --coverage` → full run completes, exits 0.
3. **Negative check:** temporarily inflate a threshold well past the measured value and
   confirm the command exits non-zero (proves the gate actually fires), then revert.
4. Both submodules end clean in `git status`; no stray artifacts left behind.

## Rollout

Three changes across two submodules, then a parent submodule-pointer bump:

- `sogo6-server`: `tests/conftest.py` + `pyproject.toml`
- `sogo6-ui`: `jest.config.ts` (note: husky pre-push runs the full jest suite **with
  `--coverage=false`**, so it does not validate the new threshold — validate separately
  with `npm test`)
- `SOGo6-dockerized`: submodule pointer bump

## Risks

- **Measured numbers are environment-dependent** (system python vs `.venv`). The
  implementation must record the measured totals and the machine used in this doc.
- **jest full-run flakiness/OOM** on this workstation may require lowering `maxWorkers`;
  that is an implementation detail, not a design change.

## Results (2026-10-17, workstation `pcrz1334`)

| Change | Location | Result |
|---|---|---|
| C1 hermetic bootstrap | `sogo6-server/tests/conftest.py` | 3 settings pre-seeded; suite collects on a bare checkout (still needs live Redis) |
| C2 backend floor | `sogo6-server/pyproject.toml` | `fail_under` 66 → **79** (measured 79%) |
| C3 UI floors | `sogo6-ui/jest.config.ts` | `coverageThreshold.global` 55/72/52/55 (measured 55.15/72.46/52.91) |

**Verification performed:**
1. Backend: `run-coverage.sh` with a throwaway `redis:7-alpine` → TOTAL 79%, gate passes (log
   `/tmp/opencode/cov-backend.log`).
2. UI: clean full `npx jest --coverage` → 584 suites, 6058 passed / 6 skipped, exit 0
   (log `/tmp/opencode/cov-ui2.log`, 2631 s).
3. **Negative check (positive):** inflated thresholds to 99% → jest printed
   `"global" coverage threshold … not met` and exited **1** while all tests passed —
   the gate fires.
4. Both submodules and the parent tracked files committed; the throwaway Redis container
   removed.

**Commits:** `sogo6-server` → `d7b0a4f`; `sogo6-ui` → `2ae4d79`; parent pointer bump (this doc).
