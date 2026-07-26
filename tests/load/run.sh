#!/bin/bash
# ==============================================================
# SOGo Load Test Suite — Runner
# ==============================================================
# Runs all load/performance tests and prints a summary.
#
# Usage:
#   bash tests/load/run.sh               # run all load tests
#   bash tests/load/run.sh --quick        # run only fast benchmarks
#   bash tests/load/run.sh --k6-only      # run only HTTP load tests
#   bash tests/load/run.sh --sync-only    # run only sync engine benchmark
#   bash tests/load/run.sh --json         # JSON output for CI
# ==============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
ERRORS=()

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
pass()  { PASS=$((PASS + 1)); echo -e "  ${GREEN}[PASS]${NC} $*"; }
fail()  { FAIL=$((FAIL + 1)); echo -e "  ${RED}[FAIL]${NC} $*"; ERRORS+=("$*"); }

MODE="${1:-all}"
JSON_OUTPUT="${2:-}"

# ── Config ──────────────────────────────────────────────────────
source "$PROJECT_ROOT/tests/config.sh" 2>/dev/null || true
SOGO_API_URL="${SOGO_API_URL:-http://localhost:5001}"
SOGO_ADMIN_USER="${SOGO_ADMIN_USER:-admin}"
SOGO_ADMIN_PASSWORD="${SOGO_ADMIN_PASSWORD:-admin}"

echo ""
echo "=============================================================="
echo "  SOGo Load Test Suite"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "=============================================================="
echo "  API URL:       $SOGO_API_URL"
echo "  Admin User:    $SOGO_ADMIN_USER"
echo "  Mode:          $MODE"
echo "=============================================================="
echo ""

# ── 1. k6 Admin API Load Test ──────────────────────────────────
run_k6_admin() {
    echo ""
    echo "──────────────────────────────────────────────────────────"
    echo "  [1/3] Admin API Load Test (k6)"
    echo "──────────────────────────────────────────────────────────"
    echo ""

    if ! command -v k6 &>/dev/null; then
        fail "k6 not installed — skipping Admin API load test"
        return
    fi

    K6_OUTPUT=$(mktemp)
    set +e
    k6 run --quiet \
        -e SOGO_API_URL="$SOGO_API_URL" \
        -e SOGO_ADMIN_USER="$SOGO_ADMIN_USER" \
        -e SOGO_ADMIN_PASSWORD="$SOGO_ADMIN_PASSWORD" \
        "$SCRIPT_DIR/k6-admin-api.js" 2>&1 | tee "$K6_OUTPUT"
    K6_EXIT=$?
    set -e

    if [ "$K6_EXIT" -eq 0 ]; then
        # Extract pass/fail from k6 summary
        PASS_COUNT=$(grep -c '✓' "$K6_OUTPUT" 2>/dev/null || echo 0)
        FAIL_COUNT=$(grep -c '✗' "$K6_OUTPUT" 2>/dev/null || echo 0)
        pass "k6 admin API load test: $PASS_COUNT checks OK, $FAIL_COUNT failures"
    else
        fail "k6 admin API load test exited with code $K6_EXIT"
    fi
    rm -f "$K6_OUTPUT"
}

# ── 2. k6 User API Load Test ───────────────────────────────────
run_k6_user() {
    echo ""
    echo "──────────────────────────────────────────────────────────"
    echo "  [2/3] User API Load Test (k6)"
    echo "──────────────────────────────────────────────────────────"
    echo ""

    if ! command -v k6 &>/dev/null; then
        fail "k6 not installed — skipping User API load test"
        return
    fi

    K6_OUTPUT=$(mktemp)
    set +e
    k6 run --quiet \
        -e SOGO_API_URL="$SOGO_API_URL" \
        -e SOGO_ADMIN_USER="$SOGO_ADMIN_USER" \
        -e SOGO_ADMIN_PASSWORD="$SOGO_ADMIN_PASSWORD" \
        "$SCRIPT_DIR/k6-user-api.js" 2>&1 | tee "$K6_OUTPUT"
    K6_EXIT=$?
    set -e

    if [ "$K6_EXIT" -eq 0 ]; then
        PASS_COUNT=$(grep -c '✓' "$K6_OUTPUT" 2>/dev/null || echo 0)
        pass "k6 user API load test: checks OK"
    else
        fail "k6 user API load test exited with code $K6_EXIT"
    fi
    rm -f "$K6_OUTPUT"
}

# ── 3. Sync Engine Benchmark ────────────────────────────────────
run_sync_benchmark() {
    echo ""
    echo "──────────────────────────────────────────────────────────"
    echo "  [3/3] Sync Engine Performance Benchmark"
    echo "──────────────────────────────────────────────────────────"
    echo ""

    JSON_FLAG=""
    if [[ "$JSON_OUTPUT" == "--json" ]]; then
        JSON_FLAG="--json"
    fi

    set +e
    python3 "$SCRIPT_DIR/sync-benchmark.py" $JSON_FLAG
    PY_EXIT=$?
    set -e

    if [ "$PY_EXIT" -eq 0 ]; then
        pass "Sync engine benchmark passed (score >= 70)"
    else
        fail "Sync engine benchmark scored below threshold"
    fi
}

# ── Run selected tests ──────────────────────────────────────────
case "$MODE" in
    --quick)
        info "Quick mode — running only sync benchmark (no HTTP load)"
        run_sync_benchmark
        ;;
    --k6-only)
        info "k6-only mode"
        run_k6_admin
        run_k6_user
        ;;
    --sync-only)
        info "Sync-only mode"
        run_sync_benchmark
        ;;
    all|*)
        run_k6_admin
        run_k6_user
        run_sync_benchmark
        ;;
esac

# ── Summary ─────────────────────────────────────────────────────
echo ""
echo "=============================================================="
echo "  Load Test Results Summary"
echo "=============================================================="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
if [ ${#ERRORS[@]} -gt 0 ]; then
    echo "  Errors:"
    for e in "${ERRORS[@]}"; do
        echo "    - $e"
    done
fi
echo "=============================================================="
echo ""

exit $FAIL
