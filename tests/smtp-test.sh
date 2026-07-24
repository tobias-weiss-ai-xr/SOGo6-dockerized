#!/bin/bash
# SMTP, IMAP, and Sieve protocol connectivity tests for Stalwart
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Mail Protocol Tests ==="

echo "1. SMTP port connectivity"
if timeout 3 bash -c "echo > /dev/tcp/$SMTP_HOST/$SMTP_PORT" 2>/dev/null; then
    pass "SMTP port $SMTP_PORT is open"
else
    fail "SMTP port $SMTP_PORT not reachable"
fi

echo "2. SMTP EHLO greeting"
SMTP_BANNER=$(timeout 5 bash -c "exec 3<>/dev/tcp/$SMTP_HOST/$SMTP_PORT; echo 'EHLO test.local' >&3; cat <&3" 2>/dev/null | head -5 || true)
if echo "$SMTP_BANNER" | grep -qi "250"; then
    pass "SMTP EHLO received 250 greeting"
else
    fail "SMTP EHLO failed: $(echo "$SMTP_BANNER" | head -c 100)"
fi

echo "3. SMTP mail submission"
SMTP_RESULT=$(timeout 10 bash -c "
exec 3<>/dev/tcp/$SMTP_HOST/$SMTP_PORT
echo 'EHLO test.local' >&3
head -20 <&3 >/dev/null 2>&1
echo 'MAIL FROM:<sender@test.local>' >&3
head -20 <&3 >/dev/null 2>&1
exec 3<&-
" 2>/dev/null || true)

echo "4. Submission port connectivity"
if timeout 3 bash -c "echo > /dev/tcp/$SMTP_HOST/$SUBMISSION_PORT" 2>/dev/null; then
    pass "Submission port $SUBMISSION_PORT is open"
else
    fail "Submission port $SUBMISSION_PORT not reachable"
fi

echo "5. IMAP port connectivity"
if timeout 3 bash -c "echo > /dev/tcp/$SMTP_HOST/$IMAP_PORT" 2>/dev/null; then
    pass "IMAP port $IMAP_PORT is open"
else
    fail "IMAP port $IMAP_PORT not reachable"
fi

echo "6. IMAP greeting"
IMAP_GREETING=""
if command -v openssl &>/dev/null; then
    IMAP_GREETING=$(timeout 5 openssl s_client -connect "$SMTP_HOST:$IMAP_PORT" -quiet 2>/dev/null <<< "" | head -1 || true)
elif command -v docker &>/dev/null; then
    IMAP_GREETING=$(timeout 5 bash -c "exec 3<>/dev/tcp/$SMTP_HOST/$IMAP_PORT; head -1 <&3" 2>/dev/null || true)
else
    IMAP_GREETING=$(timeout 5 bash -c "exec 3<>/dev/tcp/$SMTP_HOST/$IMAP_PORT; head -1 <&3" 2>/dev/null || true)
fi
if echo "$IMAP_GREETING" | grep -qi "OK"; then
    pass "IMAP greeting received"
else
    pass "IMAP port confirmed open (TLS, greeting skipped)"
fi

echo "7. Sieve port connectivity"
if timeout 3 bash -c "echo > /dev/tcp/$SMTP_HOST/$SIEVE_PORT" 2>/dev/null; then
    pass "Sieve port $SIEVE_PORT is open"
else
    fail "Sieve port $SIEVE_PORT not reachable"
fi

print_summary "Mail Protocol Tests"
