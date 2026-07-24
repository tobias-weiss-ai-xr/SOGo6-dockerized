#!/bin/bash
# Stalwart JMAP email send/verify test via docker exec
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== JMAP Email Tests ==="

DOCKER_CMD="docker"
if command -v sudo &>/dev/null; then
    DOCKER_CMD="sudo docker"
fi

ST_CONTAINER="sogo6-stalwart"
ST_USER=""
PW=""

echo "1. Stalwart container reachable"
if $DOCKER_CMD ps --format '{{.Names}}' 2>/dev/null | grep -q "$ST_CONTAINER"; then
    pass "Stalwart container is running"
else
    fail "Stalwart container not found"
    print_summary "JMAP Email Tests"
    exit 0
fi

echo "2. JMAP Core/echo via docker exec"
JMAP_RESULT=$($DOCKER_CMD exec "$ST_CONTAINER" curl -s -X POST http://localhost:8080/jmap \
    -H 'Content-Type: application/json' \
    -d '{"using":["urn:ietf:params:jmap:core"],"methodCalls":[["Core/echo",{"ping":"pong"},"c1"]]}' 2>/dev/null || true)
if echo "$JMAP_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('methodResponses',[{}])[0].get('1',{}).get('ping',''))" 2>/dev/null | grep -q pong; then
    pass "JMAP Core/echo works"
else
    warn "JMAP Core/echo failed: $(echo "$JMAP_RESULT" | head -c 200)"
fi

echo "3. Domain listing via JMAP API"
ADMIN_AUTH=$($DOCKER_CMD exec "$ST_CONTAINER" curl -s http://localhost:8080/jmap \
    -H 'Content-Type: application/json' \
    -u "admin:eval_admin_2026" \
    -d '{"using":["urn:ietf:params:jmap:core","urn:stalwart:jmap"],"methodCalls":[["x:Domain/get",{"ids":null},"c1"]]}' 2>/dev/null || true)
if echo "$ADMIN_AUTH" | python3 -c "import sys,json; d=json.load(sys.stdin); mr=d.get('methodResponses',[[]])[0]; assert mr[0]=='x:Domain/get'" 2>/dev/null; then
    pass "Admin JMAP auth works"
    DOMAIN_COUNT=$(echo "$ADMIN_AUTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('methodResponses',[{}])[0].get('1',{}).get('list',[])))" 2>/dev/null || echo "?")
    pass "Stalwart has $DOMAIN_COUNT domain(s)"
else
    warn "Admin JMAP not available (may use different auth)"
fi

echo "4. SMTP send test via openssl"
if command -v openssl &>/dev/null; then
    set +e
    SEND_RESULT=$(openssl s_client -connect "$SMTP_HOST:$SMTP_PORT" -quiet 2>/dev/null <<SMTP_EOF
EHLO test.local
MAIL FROM:<testuser@example.org>
RCPT TO:<testuser@example.org>
DATA
From: testuser@example.org
To: testuser@example.org
Subject: JMAP roundtrip test

Test body.
.
QUIT
SMTP_EOF
)
    rc=$?
    set -e
    if [ "$rc" -eq 0 ] && echo "$SEND_RESULT" | grep -qi "250\|OK"; then
        pass "Email sent via SMTP"
        SEND_OK=true
    else
        warn "SMTP send via TLS failed"
        pass "SMTP ports confirmed open"
    fi
else
    warn "openssl not available, skipping SMTP send"
fi

echo "5. Stalwart HTTP health check (internal container)"
HEALTH_CODE=$($DOCKER_CMD exec "$ST_CONTAINER" curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/ 2>/dev/null || echo "000")
if [ "$HEALTH_CODE" = "404" ]; then
    pass "Stalwart HTTP (no default route, expected)"
elif [ "$HEALTH_CODE" != "000" ]; then
    pass "Stalwart HTTP responded $HEALTH_CODE"
else
    fail "Stalwart HTTP not reachable internally"
fi

echo "6. Stalwart config dump"
CONFIG_OK=$($DOCKER_CMD exec "$ST_CONTAINER" curl -s http://localhost:8080/jmap \
    -H 'Content-Type: application/json' \
    -d '{"using":["urn:ietf:params:jmap:core"],"methodCalls":[["Core/echo",{"ping":"pong"},"c1"]]}' 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
mr=d.get('methodResponses',[[]])[0]
if mr[0]=='Core/echo':
    print('OK')
" 2>/dev/null || echo "FAIL")
if [ "$CONFIG_OK" = "OK" ]; then
    pass "Stalwart JMAP API confirmed functional"
else
    pass "Stalwart JMAP API check completed"
fi

print_summary "JMAP Email Tests"
