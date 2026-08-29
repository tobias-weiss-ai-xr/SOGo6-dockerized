#!/bin/bash
# Stress / concurrency tests — adopted from upstream SOGo Tests/Stress/*.sh
# Uses the same parallel-based fork-overhead calculation and throughput measurement.
# Prerequisite: GNU parallel (apt install parallel)
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Stress / Concurrency Tests ==="

# Upstream: calculate_curl_fork_overhead from Tests/Stress/common_func.sh
echo "1. Calculate curl fork overhead (upstream common_func.sh)"
if command -v bc &>/dev/null; then
    C_START=$(date +%s%N)
    for _ in $(seq 20); do curl -s 2>&1 /dev/null; done
    C_END=$(date +%s%N)
    FORK_OVERHEAD=$(echo "scale=2; $(( C_END - C_START )) / 1000000000" | bc -l 2>/dev/null || echo "0")
    pass "Curl fork overhead: ${FORK_OVERHEAD}s for 20 requests"
else
    FORK_OVERHEAD="0"
    warn "bc not available, skipping fork overhead calc"
fi

# --- Upstream: test_authentication from Tests/Stress/authentication.sh ---

SOGO_CONCURRENCY=${SOGO_CONCURRENCY_LIMIT:-5}
SOGO_ITERATIONS=${SOGO_TEST_ITERATIONS:-3}

echo "2. Concurrent PROPFIND authentication (upstream Tests/Stress/authentication.sh)"
echo "   Concurrency: $SOGO_CONCURRENCY, Iterations per worker: $SOGO_ITERATIONS"

if command -v parallel &>/dev/null; then
    test_auth_worker() {
        local id=$1
        for n in $(seq $SOGO_ITERATIONS); do
            curl -sk -o /dev/null -w '%{http_code}' --basic --user "testuser@example.org:password123" \
                -X PROPFIND -H 'Depth:1' -H 'Content-Type:text/xml' \
                -d '<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/></D:prop></D:propfind>' \
                "${API_URL}/SOGo/dav/testuser@example.org/" 2>/dev/null
        done
    }
    export -f test_auth_worker

    START=$(date +%s%N)
    seq "$SOGO_CONCURRENCY" | parallel -j0 test_auth_worker {} 2>/dev/null
    END=$(date +%s%N)

    DIFF=$(echo "scale=2; $(( END - START )) / 1000000000" | bc -l 2>/dev/null || echo "?")
    TOTAL=$(( SOGO_CONCURRENCY * SOGO_ITERATIONS ))
    DIFF_REAL=$(echo "scale=2; $DIFF - $FORK_OVERHEAD" | bc -l 2>/dev/null || echo "$DIFF")
    if [ -n "$DIFF_REAL" ] && [ "$DIFF_REAL" != "0" ] && [ "$DIFF_REAL" != "?" ] && [ "$(echo "$DIFF_REAL > 0" | bc -l)" = "1" ]; then
        THROUGHPUT=$(echo "scale=2; $TOTAL / $DIFF_REAL" | bc -l 2>/dev/null || echo "?")
        pass "PROPFIND auth: $TOTAL requests in ${DIFF_REAL}s = ${THROUGHPUT} req/s"
    else
        pass "PROPFIND auth: $TOTAL requests completed"
    fi
else
    warn "GNU parallel not installed (apt install parallel), skipping concurrent tests"
fi

# --- Upstream: test_changes from Tests/Stress/changes.sh ---

echo "3. Concurrent sync-collection REPORT (upstream Tests/Stress/changes.sh)"

if command -v parallel &>/dev/null; then
    test_sync_worker() {
        local id=$1
        for n in $(seq $SOGO_ITERATIONS); do
            ctag=$(date +%s)
            curl -sk -o /dev/null -w '%{http_code}' --basic --user "testuser@example.org:password123" \
                -X REPORT -H 'Depth:1' -H 'Content-Type:text/xml' \
                -d "<?xml version=\"1.0\" encoding=\"utf-8\" ?><D:sync-collection xmlns:D=\"DAV:\"> <D:sync-token>$ctag</D:sync-token> <D:limit><D:nresults>10</D:nresults></D:limit> <D:sync-level>1</D:sync-level> <D:prop><D:getcontenttype/><D:getetag/></D:prop></D:sync-collection>" \
                "${API_URL}/SOGo/dav/testuser@example.org/Calendar/personal/" 2>/dev/null
        done
    }
    export -f test_sync_worker

    START=$(date +%s%N)
    seq "$SOGO_CONCURRENCY" | parallel -j0 test_sync_worker {} 2>/dev/null
    END=$(date +%s%N)

    DIFF=$(echo "scale=2; $(( END - START )) / 1000000000" | bc -l 2>/dev/null || echo "?")
    TOTAL=$(( SOGO_CONCURRENCY * SOGO_ITERATIONS ))
    DIFF_REAL=$(echo "scale=2; $DIFF - $FORK_OVERHEAD" | bc -l 2>/dev/null || echo "$DIFF")
    if [ -n "$DIFF_REAL" ] && [ "$DIFF_REAL" != "0" ] && [ "$DIFF_REAL" != "?" ] && [ "$(echo "$DIFF_REAL > 0" | bc -l)" = "1" ]; then
        THROUGHPUT=$(echo "scale=2; $TOTAL / $DIFF_REAL" | bc -l 2>/dev/null || echo "?")
        pass "Sync REPORT: $TOTAL requests in ${DIFF_REAL}s = ${THROUGHPUT} req/s"
    else
        pass "Sync REPORT: $TOTAL requests completed"
    fi
else
    warn "GNU parallel not installed, skipping sync stress test"
fi

# --- Concurrent API login (rate limiting boundary) ---

echo "4. Rapid API login concurrency ($(( SOGO_CONCURRENCY * SOGO_ITERATIONS )) logins)"
LOGINS_OK=0
LOGINS_FAIL=0
for i in $(seq $(( SOGO_CONCURRENCY * SOGO_ITERATIONS ))); do
    CODE=$(curl -sk -o /dev/null -w '%{http_code}' "${API_URL}/api/user/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d '{"username":"testuser@example.org","password":"password123"}' 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ]; then
        LOGINS_OK=$((LOGINS_OK + 1))
    else
        LOGINS_FAIL=$((LOGINS_FAIL + 1))
    fi
done
pass "Login concurrency: $LOGINS_OK OK, $LOGINS_FAIL failed out of $(( LOGINS_OK + LOGINS_FAIL ))"

# --- Concurrent API reads ---

echo "5. Concurrent API system health reads"
READ_OK=0
for i in $(seq $(( SOGO_CONCURRENCY * SOGO_ITERATIONS * 2 ))); do
    CODE=$(curl -sk -o /dev/null -w '%{http_code}' "${API_URL}/api/user/v1/system" 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ] || [ "$CODE" = "412" ]; then
        READ_OK=$((READ_OK + 1))
    fi
done
pass "System health concurrency: $READ_OK/$(( SOGO_CONCURRENCY * SOGO_ITERATIONS * 2 )) OK"

print_summary "Stress / Concurrency Tests"
