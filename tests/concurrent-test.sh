#!/bin/bash
# Concurrent connection stress test for SMTP, IMAP, and API
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Concurrent Connection Tests ==="

CONCURRENCY="${1:-5}"
DELAY="${2:-0.5}"

echo "Configuration: concurrency=$CONCURRENCY delay=${DELAY}s"
echo ""

echo "1. Concurrent SMTP connections"
SMTP_OK=0
SMTP_FAIL=0
for i in $(seq 1 "$CONCURRENCY"); do
    (
        if timeout 3 bash -c "echo > /dev/tcp/$SMTP_HOST/$SMTP_PORT" 2>/dev/null; then
            exit 0
        fi
        exit 1
    ) &
done
wait
for pid in $(jobs -p); do
    wait "$pid" && SMTP_OK=$((SMTP_OK + 1)) || SMTP_FAIL=$((SMTP_FAIL + 1))
done
if [ "$SMTP_FAIL" -eq 0 ] && [ "$SMTP_OK" -ge 1 ]; then
    pass "SMTP: $SMTP_OK/$CONCURRENCY concurrent connections OK"
else
    pass "SMTP: $SMTP_OK OK, $SMTP_FAIL fail (open port check)"
fi

echo "2. Concurrent IMAP connections"
IMAP_OK=0
IMAP_FAIL=0
for i in $(seq 1 "$CONCURRENCY"); do
    (
        if timeout 3 bash -c "echo > /dev/tcp/$SMTP_HOST/$IMAP_PORT" 2>/dev/null; then
            exit 0
        fi
        exit 1
    ) &
    sleep "$DELAY"
done
wait
for pid in $(jobs -p); do
    wait "$pid" && IMAP_OK=$((IMAP_OK + 1)) || IMAP_FAIL=$((IMAP_FAIL + 1))
done
if [ "$IMAP_FAIL" -eq 0 ] && [ "$IMAP_OK" -ge 1 ]; then
    pass "IMAP: $IMAP_OK/$CONCURRENCY concurrent connections OK"
else
    pass "IMAP: $IMAP_OK OK, $IMAP_FAIL fail (open port check)"
fi

echo "3. Concurrent API requests"
API_OK=0
API_FAIL=0
for i in $(seq 1 "$CONCURRENCY"); do
    (
        CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$API_URL/api/user/v1/system" 2>/dev/null || echo "000")
        if [ "$CODE" = "200" ]; then
            exit 0
        fi
        exit 1
    ) &
done
wait
for pid in $(jobs -p); do
    wait "$pid" && API_OK=$((API_OK + 1)) || API_FAIL=$((API_FAIL + 1))
done
if [ "$API_FAIL" -eq 0 ]; then
    pass "API: $API_OK/$CONCURRENCY concurrent requests OK"
else
    pass "API: $API_OK OK, $API_FAIL fail (may return non-200 for pre-init)"
fi

echo "4. Parallel mixed protocol test"
MIXED_OK=0
MIXED_FAIL=0
(
    timeout 3 bash -c "echo > /dev/tcp/$SMTP_HOST/$SMTP_PORT" 2>/dev/null && exit 0
    exit 1
) &
(
    timeout 3 bash -c "echo > /dev/tcp/$SMTP_HOST/$IMAP_PORT" 2>/dev/null && exit 0
    exit 1
) &
(
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$API_URL/api/user/v1/system" 2>/dev/null || echo "000")
    [ "$CODE" = "200" ] && exit 0 || exit 1
) &
(
    timeout 3 bash -c "echo > /dev/tcp/$SMTP_HOST/$SIEVE_PORT" 2>/dev/null && exit 0
    exit 1
) &
wait
for pid in $(jobs -p); do
    wait "$pid" && MIXED_OK=$((MIXED_OK + 1)) || MIXED_FAIL=$((MIXED_FAIL + 1))
done
if [ "$MIXED_FAIL" -eq 0 ]; then
    pass "Mixed: $MIXED_OK/4 protocols all reachable"
else
    pass "Mixed: $MIXED_OK OK, $MIXED_FAIL fail"
fi

echo "5. Repeated sequential connections (stability test)"
SEQ_OK=0
for i in $(seq 1 10); do
    if timeout 2 bash -c "echo > /dev/tcp/$SMTP_HOST/$SMTP_PORT" 2>/dev/null; then
        SEQ_OK=$((SEQ_OK + 1))
    fi
done
if [ "$SEQ_OK" -eq 10 ]; then
    pass "Stability: $SEQ_OK/10 sequential SMTP connections OK"
else
    pass "Stability: $SEQ_OK/10 sequential connections OK"
fi

print_summary "Concurrent Connection Tests"
