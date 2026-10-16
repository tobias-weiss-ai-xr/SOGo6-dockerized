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

Both must be clearly test-only and never usable as real credentials, and both keep the
existing behaviour where a real environment variable overrides the default. Add a comment
mirroring the current `_proc_setting()` / "raw environment takes precedence" rationale.

**Acceptance:** `python -m pytest tests/ -q` collects and runs — no conftest
ImportError/ValidationError.

### C2 — Backend ratchet (`sogo6-server/pyproject.toml`)

Once C1 lands, measure once with the runner that has the real deps:

```
PYTHON=.venv/bin/python ./tests/run-coverage.sh
```

(System `python3` lacks `flask_smorest`; `.venv` has pytest 9.1.1 + coverage 7.16.1.)

Set `[tool.coverage.report].fail_under` to the floor of the measured total, **never below
the existing 66** unless measurement proves 66 unreachable — and if it is unreachable, that
is a finding to report, not a silent lowering. Keep `run-coverage.sh` as the single entry
point; no new scripts.

### C3 — UI ratchet (`sogo6-ui/jest.config.ts`)

Measure with a clean full run:

```
npx jest --coverage --coverageReporters=json-summary,text-summary
```

The default `maxWorkers` previously caused an OOM/Termination on this workstation, so the
implementation must tune `maxWorkers`/memory until a full clean run completes.

Add `coverageThreshold.global = { statements, branches, functions, lines }`, each set to
the floor of the measured value, rounded down. **No per-module thresholds** (YAGNI).

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
- `sogo6-ui`: `jest.config.ts` (note: husky pre-push runs the full jest suite, so the
  threshold change must be validated before pushing)
- `SOGo6-dockerized`: submodule pointer bump

## Risks

- **Measured numbers are environment-dependent** (system python vs `.venv`). The
  implementation must record the measured totals and the machine used in this doc.
- **jest full-run flakiness/OOM** on this workstation may require lowering `maxWorkers`;
  that is an implementation detail, not a design change.
