#!/bin/bash
# SOGo 6 Test Suite Runner

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load shared library
source "${SCRIPT_DIR}/../lib/common.sh"

TOTAL_PASS=0
TOTAL_FAIL=0
REPORT_FILE="$SCRIPT_DIR/test-report-$(date +%Y%m%d-%H%M%S).json"

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

    local out rc npass nfail nerror
    set +e
    out=$(SOGO_INTEGRATION_TESTS=1 python3 -m pytest "$SCRIPT_DIR/integration/" -v --tb=short 2>&1)
    rc=$?
    set -e

    echo "$out"

    # Surface the pytest outcome and feed real pass/fail/error counts into the
    # suite tally. Previously this function swallowed pytest's exit code, so
    # "All N tests passed" could be reported while pytest had failures/errors.
    npass=$(echo "$out" | grep -oE '[0-9]+ passed' | tail -1 | grep -oE '[0-9]+' || echo 0)
    nfail=$(echo "$out" | grep -oE '[0-9]+ failed' | tail -1 | grep -oE '[0-9]+' || echo 0)
    nerror=$(echo "$out" | grep -oE '[0-9]+ error' | tail -1 | grep -oE '[0-9]+' || echo 0)

    # Iterate each pytest line to enumerate individual [PASS]/[FAIL].
    while IFS= read -r line; do
        case "$line" in
            *" PASSED"*)  TOTAL_PASS=$((TOTAL_PASS + 1)) ;;
            *" FAILED"*)  TOTAL_FAIL=$((TOTAL_FAIL + 1)) ;;
            *" ERROR"*)   TOTAL_FAIL=$((TOTAL_FAIL + 1)) ;;
        esac
    done <<< "$(echo "$out" | grep -E ' (PASSED|FAILED|ERROR) ')"

    if [ "$rc" -eq 5 ]; then
        warn "No Python tests collected"
    elif [ "$rc" -ne 0 ]; then
        fail "$name: pytest exited $rc ($nfail failed, $nerror error)"
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

    # Avoid recursion: npm test runs run-all-tests.sh, so only run
    # the dedicated E2E script if it exists (not via npm test)
    if [ -f "$SCRIPT_DIR/sogo6-e2e-test.js" ]; then
        set +e
        cd "$SCRIPT_DIR"
        if [ ! -d "node_modules" ]; then
            npm install --no-fund --no-audit 2>/dev/null || true
        fi
        timeout 120 node sogo6-e2e-test.js 2>&1
        local rc=$?
        set -e

        if [ "$rc" -eq 124 ]; then
            fail "Playwright E2E test timed out"
        fi
    else
        warn "No Playwright E2E test script found"
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
run_test "CalDAV Protocol Tests" "$SCRIPT_DIR/caldav-test.sh" 120
run_test "CardDAV Protocol Tests" "$SCRIPT_DIR/carddav-test.sh" 120
run_test "Sieve Filter Tests" "$SCRIPT_DIR/sieve-test.sh" 120
run_test "Deep IMAP Protocol Tests" "$SCRIPT_DIR/imap-deep-test.sh" 180
run_test "API CRUD Lifecycle Tests" "$SCRIPT_DIR/api-crud-lifecycle-test.sh" 180
run_test "Docker Compose Validation Tests" "$SCRIPT_DIR/docker-compose-validation-test.sh" 60
run_test "Data Persistence Tests" "$SCRIPT_DIR/data-persistence-test.sh" 120
run_test "WebDAV Sync Tests" "$SCRIPT_DIR/webdav-sync-test.sh" 60
run_test "ACL & Cross-User Isolation Tests" "$SCRIPT_DIR/acl-crossuser-test.sh" 120
run_test "Public Access Boundary Tests" "$SCRIPT_DIR/public-access-test.sh" 60
run_test "Calendar Tasks & Attendance Tests" "$SCRIPT_DIR/calendar-task-attendance-test.sh" 120
run_test "Agent/Job Lifecycle Tests" "$SCRIPT_DIR/job-lifecycle-test.sh" 120
run_test "vCard Import/Export Roundtrip Tests" "$SCRIPT_DIR/vcard-import-export-test.sh" 120
run_test "Stress / Concurrency Tests" "$SCRIPT_DIR/stress-test.sh" 300
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
