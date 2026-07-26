#!/bin/bash
# SOGo 6 Test Suite Runner
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()    { echo -e "${GREEN}[RUN]${NC} $*"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()   { echo -e "${RED}[FAIL]${NC} $*"; }

TOTAL_PASS=0
TOTAL_FAIL=0
REPORT_FILE="$SCRIPT_DIR/test-report-$(date +%Y%m%d-%H%M%S).json"

echo "=========================================="
echo "  SOGo 6 Test Suite"
echo "  $(date)"
echo "=========================================="
echo ""

run_test() {
    local name="$1"
    local script="$2"
    local timeout="${3:-120}"

    echo "------------------------------------------"
    echo "  Running: $name"
    echo "------------------------------------------"

    if [ ! -f "$script" ]; then
        warn "Script not found: $script"
        return
    fi

    set +e
    output=$(timeout "$timeout" bash "$script" 2>&1)
    local rc=$?
    set -e

    echo "$output"

    local pass_count fail_count
    pass_count=$(echo "$output" | grep -c '\[PASS\]' || true)
    fail_count=$(echo "$output" | grep -c '\[FAIL\]' || true)

    TOTAL_PASS=$((TOTAL_PASS + pass_count))
    TOTAL_FAIL=$((TOTAL_FAIL + fail_count))

    if [ "$rc" -eq 124 ]; then
        fail "$name timed out after ${timeout}s"
    elif [ "$rc" -ne 0 ]; then
        fail "$name exited with code $rc"
    fi
    echo ""
}

run_python_tests() {
    local name="Python Integration Tests"
    echo "------------------------------------------"
    echo "  Running: $name"
    echo "------------------------------------------"

    if ! command -v python3 &>/dev/null; then
        warn "python3 not available, skipping Python tests"
        return
    fi

    local req="$SCRIPT_DIR/integration/requirements.txt"
    if [ -f "$req" ]; then
        pip3 install -q -r "$req" 2>/dev/null || true
    fi

    set +e
    SOGO_INTEGRATION_TESTS=1 python3 -m pytest "$SCRIPT_DIR/integration/" -v --tb=short 2>&1
    local rc=$?
    set -e

    if [ "$rc" -eq 5 ]; then
        warn "No Python tests collected"
    fi
    echo ""
}

run_playwright_test() {
    local name="Playwright E2E Tests"
    echo "------------------------------------------"
    echo "  Running: $name"
    echo "------------------------------------------"

    if ! command -v node &>/dev/null; then
        warn "node not available, skipping Playwright test"
        return
    fi

    if [ ! -f "$SCRIPT_DIR/package.json" ]; then
        warn "package.json not found, skipping Playwright test"
        return
    fi

    set +e
    cd "$SCRIPT_DIR"
    if [ ! -d "node_modules" ]; then
        npm install --no-fund --no-audit 2>/dev/null || true
    fi
    timeout 120 npm test 2>&1
    local rc=$?
    set -e

    if [ "$rc" -eq 124 ]; then
        fail "Playwright test timed out"
    fi
    echo ""
}

run_test "Docker Container Tests" "$SCRIPT_DIR/docker-test.sh"
run_test "Redis Cache Tests" "$SCRIPT_DIR/redis-test.sh"
run_test "API Tests" "$SCRIPT_DIR/api-test.sh" 180
run_test "API Write Tests" "$SCRIPT_DIR/api-write-test.sh" 180
run_test "Mail Protocol Tests" "$SCRIPT_DIR/smtp-test.sh" 300
run_test "LDAP Tests" "$SCRIPT_DIR/ldap-test.sh"
run_test "PostgreSQL Tests" "$SCRIPT_DIR/postgres-test.sh"
run_test "Nginx Proxy Tests" "$SCRIPT_DIR/nginx-test.sh"
run_test "JMAP Email Tests" "$SCRIPT_DIR/jmap-email-test.sh" 120
run_test "Concurrent Connection Tests" "$SCRIPT_DIR/concurrent-test.sh" 120
run_test "Integration Flow Tests" "$SCRIPT_DIR/integration-test.sh" 180
run_test "Admin API CRUD Tests" "$SCRIPT_DIR/admin-api-test.sh" 180
run_test "Security Tests" "$SCRIPT_DIR/security-test.sh" 120
run_test "Configuration & Script Validation Tests" "$SCRIPT_DIR/script-test.sh"
run_python_tests
run_playwright_test

echo "=========================================="
echo "  Test Suite Complete"
echo "=========================================="
echo ""

if [ "$TOTAL_FAIL" -eq 0 ]; then
    echo -e "${GREEN}All $TOTAL_PASS tests passed.${NC}"
else
    echo -e "${RED}$TOTAL_FAIL tests failed out of $((TOTAL_PASS + TOTAL_FAIL)) total.${NC}"
fi

echo ""
echo "Writing report to $REPORT_FILE"
cat > "$REPORT_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "passed": $TOTAL_PASS,
  "failed": $TOTAL_FAIL,
  "total": $((TOTAL_PASS + TOTAL_FAIL))
}
EOF

exit $TOTAL_FAIL
