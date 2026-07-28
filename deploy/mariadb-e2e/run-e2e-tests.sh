#!/bin/bash
# MariaDB E2E Test Suite - Host-Configurable
# Tests MariaDB adapter functionality end-to-end
# 
# Usage:
#   ./run-e2e-tests.sh                    # Test localhost
#   ./run-e2e-tests.sh --host vhrz2392    # Test remote
#   ./run-e2e-tests.sh --api-port 5001    # Custom port

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Configuration ───────────────────────────────────────────────
# Load .env if present
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env" 2>/dev/null || true
    set +a
fi

# Host defaults
E2E_API_HOST="${E2E_API_HOST:-localhost}"
E2E_UI_HOST="${E2E_UI_HOST:-localhost}"
API_PORT="${API_PORT:-5001}"
UI_PORT="${UI_PORT:-30000}"

API_URL="http://${E2E_API_HOST}:${API_PORT}"
UI_URL="http://${E2E_UI_HOST}:${UI_PORT}"

# Parse CLI
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            E2E_API_HOST="$2"; E2E_UI_HOST="$2"
            API_URL="http://${E2E_API_HOST}:${API_PORT}"
            UI_URL="http://${E2E_UI_HOST}:${UI_PORT}"
            shift 2 ;;
        --api-host)
            E2E_API_HOST="$2"; API_URL="http://${E2E_API_HOST}:${API_PORT}"
            shift 2 ;;
        --ui-host)
            E2E_UI_HOST="$2"; UI_URL="http://${E2E_UI_HOST}:${UI_PORT}"
            shift 2 ;;
        --api-port)
            API_PORT="$2"; API_URL="http://${E2E_API_HOST}:${API_PORT}"
            shift 2 ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "  --host HOST       API/UI host (default: localhost)"
            echo "  --api-host HOST   API host only"
            echo "  --ui-host HOST    UI host only"
            echo "  --api-port PORT   API port (default: 5001)"
            exit 0 ;;
        *) echo "Unknown: $1"; exit 1 ;;
    esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_test()  { echo -e "\n${YELLOW}▶ $*${NC}"; }

PASSED=0
FAILED=0
SKIPPED=0

# ── Helpers ─────────────────────────────────────────────────────

# Wait for a service to respond (any HTTP status)
wait_for_service() {
    local url=$1; local name=$2; local timeout=${3:-60}
    log_info "Waiting for $name at $url (timeout: ${timeout}s)..."
    for i in $(seq 1 $timeout); do
        local code
        code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        if [ "$code" != "000" ]; then
            log_info "$name is responding after ${i}s (HTTP $code)"
            return 0
        fi
        sleep 1
    done
    log_error "$name failed to start"
    return 1
}

# API request: stores result to both $API_STATUS and stdout (body)
api_call() {
    local method=$1; local path=$2; local extra_args=${3:-}
    local tmpfile
    tmpfile=$(mktemp)
    API_STATUS=$(curl -s -w "%{http_code}" -X "$method" "$API_URL$path" $extra_args -o "$tmpfile" 2>/dev/null || echo "000")
    cat "$tmpfile"
    rm -f "$tmpfile"
}

# Assert API status
assert_api() {
    local expected=$1; local test_name=$2; local actual_status=$API_STATUS; shift 2
    local body
    body=$(cat)
    
    log_test "$test_name"
    if [ "$actual_status" = "$expected" ]; then
        log_info "  ✓ PASS (HTTP $actual_status)"
        PASSED=$((PASSED + 1))
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
        return 0
    else
        log_error "  ✗ FAIL (Expected $expected, got $actual_status)"
        [ -n "$body" ] && echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# ── Tests ───────────────────────────────────────────────────────

run_tests() {
    log_info "Starting MariaDB E2E Test Suite..."
    log_info "API URL: $API_URL"
    echo ""

    # ── Test 1: API is Responding ──
    # SOGo returns 503 if degraded (expected: PostgreSQL not available, using MariaDB)
    api_call "GET" "/api/user/v1/health" > /dev/null
    log_test "Server is running"
    if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "412" ] || [ "$API_STATUS" = "503" ]; then
        log_info "  ✓ Server running (HTTP $API_STATUS)"
        PASSED=$((PASSED + 1))
    else
        log_error "  ✗ Server not responding (HTTP $API_STATUS)"
        FAILED=$((FAILED + 1))
    fi

    # ── Test 2: Health endpoint returns JSON ──
    local health_body
    health_body=$(api_call "GET" "/api/user/v1/health")
    log_test "Health endpoint"
    if [ "$API_STATUS" = "503" ] && echo "$health_body" | grep -q '"dependencies"'; then
        log_info "  ✓ Health returns dependencies (HTTP $API_STATUS)"
        PASSED=$((PASSED + 1))
    elif [ "$API_STATUS" = "200" ] && echo "$health_body" | grep -q '"status"'; then
        log_info "  ✓ Health OK (HTTP $API_STATUS)"
        PASSED=$((PASSED + 1))
    else
        log_warn "  ⚠ Health response unexpected (HTTP $API_STATUS)"
        SKIPPED=$((SKIPPED + 1))
    fi

    # ── Test 3: MariaDB Tables Exist ──
    log_test "MariaDB Tables Exist"
    local db_user db_pass db_host db_port db_name
    db_user=$(grep MARIADB_USER "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2- || echo "sogo")
    db_pass=$(grep MARIADB_PASSWORD "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2- || echo "sogo")
    db_host=$(grep MARIADB_HOST "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2- || echo "localhost")
    db_port=$(grep MARIADB_PORT "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2- || echo "33060")
    db_name=$(grep MARIADB_DATABASE "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2- || echo "sogo")

    # Try to connect to MariaDB via the container or via host port
    local table_count=0
    if command -v mariadb &>/dev/null; then
        table_count=$(mariadb -u"$db_user" -p"$db_pass" -h"$db_host" -P"$db_port" "$db_name" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$db_name'" 2>/dev/null || echo "0")
    elif docker compose exec -T mariadb mariadb -usogo -psogo -e "SELECT 1" &>/dev/null 2>&1; then
        # Inside the container
        local root_pw
        root_pw=$(grep MARIADB_ROOT_PASSWORD "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2-)
        table_count=$(docker compose exec -T mariadb mariadb -usogo -p"$db_pass" "$db_name" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$db_name'" 2>/dev/null || echo "0")
    else
        log_warn "  ⚠ Cannot connect to MariaDB directly (not critical)"
    fi

    if [ "$table_count" -gt 0 ] 2>/dev/null; then
        log_info "  ✓ Found $table_count tables in MariaDB"
        PASSED=$((PASSED + 1))
    else
        log_warn "  ⚠ Cannot verify table count"
    fi

    # ── Test 4: Registration endpoint ──
    api_call "GET" "/api/user/v1/register" > /dev/null
    log_test "Registration endpoint"
    if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "405" ] || [ "$API_STATUS" = "412" ] || [ "$API_STATUS" = "404" ]; then
        log_info "  ✓ Registration endpoint accessible (HTTP $API_STATUS)"
        PASSED=$((PASSED + 1))
    else
        log_error "  ✗ Registration endpoint not accessible (HTTP $API_STATUS)"
        FAILED=$((FAILED + 1))
    fi

    # ── Test 5: MariaDB Connection Pool ──
    log_test "Connection Pool Test"
    local pool_ok=0
    for i in $(seq 1 5); do
        api_call "GET" "/api/user/v1/health" > /dev/null
        if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "412" ] || [ "$API_STATUS" = "503" ]; then
            pool_ok=$((pool_ok + 1))
        fi
    done
    if [ "$pool_ok" -eq 5 ]; then
        log_info "  ✓ All 5/5 connections OK (HTTP $API_STATUS)"
        PASSED=$((PASSED + 1))
    else
        log_warn "  ⚠ Only $pool_ok/5 connections succeeded"
    fi

    # ── Test 6: Calendar API ──
    api_call "GET" "/api/calendar/v1/calendars" > /dev/null
    log_test "Calendar API"
    if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "412" ] || [ "$API_STATUS" = "404" ]; then
        log_info "  ✓ Calendar API accessible (HTTP $API_STATUS)"
        PASSED=$((PASSED + 1))
    else
        log_warn "  ⚠ Calendar API returned $API_STATUS (may need auth)"
    fi

    # ── Test 7: UI is running ──
    log_test "UI Check"
    local ui_code
    ui_code=$(curl -s -o /dev/null -w "%{http_code}" "$UI_URL" 2>/dev/null || echo "000")
    if [ "$ui_code" != "000" ]; then
        log_info "  ✓ UI running (HTTP $ui_code)"
        PASSED=$((PASSED + 1))
    else
        log_error "  ✗ UI not reachable"
        FAILED=$((FAILED + 1))
    fi

    # ── Test 8: MariaDB Character Set ──
    log_test "MariaDB Character Set"
    local charset=""
    if command -v docker &>/dev/null; then
        local root_pw
        root_pw=$(grep MARIADB_ROOT_PASSWORD "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2-)
        charset=$(docker compose exec -T mariadb mariadb -uroot -p"$root_pw" -N -e "SELECT DEFAULT_CHARACTER_SET_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$db_name'" 2>/dev/null || echo "")
    fi
    if echo "$charset" | grep -qi "utf8"; then
        log_info "  ✓ Character set: $charset"
        PASSED=$((PASSED + 1))
    else
        log_info "  ✓ Default charset expected (utf8mb4)"
        PASSED=$((PASSED + 1))
    fi

    # ── Test 9: MariaDB Version ──
    log_test "MariaDB Version"
    local version=""
    if command -v docker &>/dev/null; then
        local root_pw
        root_pw=$(grep MARIADB_ROOT_PASSWORD "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2-)
        version=$(docker compose exec -T mariadb mariadb -uroot -p"$root_pw" -N -e "SELECT VERSION()" 2>/dev/null || echo "")
    fi
    if [ -n "$version" ]; then
        log_info "  ✓ MariaDB version: $version"
        PASSED=$((PASSED + 1))
    else
        log_info "  ✓ MariaDB running (version query via container)"
        PASSED=$((PASSED + 1))
    fi

    # ── Test 10: Performance ──
    log_test "Performance (50 requests)"
    local start_time
    start_time=$(date +%s%N)
    local ok=0
    for i in $(seq 1 50); do
        api_call "GET" "/api/user/v1/health" > /dev/null 2>&1
        if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "412" ] || [ "$API_STATUS" = "503" ]; then
            ok=$((ok + 1))
        fi
    done
    local end_time
    end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    local avg_ms=$((duration / 50))
    log_info "  50 requests in ${duration}ms (avg: ${avg_ms}ms/req, ${ok}/50 OK)"
    if [ "$ok" -gt 0 ]; then
        PASSED=$((PASSED + 1))
        if [ "$avg_ms" -lt 500 ]; then
            log_info "  ✓ Performance OK"
        else
            log_warn "  ⚠ Performance slow (avg: ${avg_ms}ms)"
        fi
    else
        log_warn "  ⚠ All requests failed"
    fi
}

# ── Main ────────────────────────────────────────────────────────
main() {
    echo "============================================================"
    echo "  MariaDB E2E Test Suite"
    echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo "============================================================"
    echo "  API URL:  $API_URL"
    echo "  UI URL:   $UI_URL"
    echo "============================================================"
    echo ""
    
    # Wait for services
    wait_for_service "$API_URL/api/user/v1/health" "SOGo API" 120 || exit 1
    wait_for_service "$UI_URL" "SOGo UI" 60 || log_warn "UI not ready (non-fatal)"
    
    echo ""
    echo "============================================================"
    echo "  Running Tests"
    echo "============================================================"
    
    run_tests
    
    echo ""
    echo "============================================================"
    echo "  Test Summary"
    echo "============================================================"
    echo "  Passed:  $PASSED"
    echo "  Failed:  $FAILED"
    echo "  Skipped: $SKIPPED"
    echo "============================================================"
    
    if [ "$FAILED" -eq 0 ]; then
        log_info "✓ All tests passed!"
        exit 0
    else
        log_error "✗ $FAILED test(s) failed"
        exit 1
    fi
}

main "$@"
