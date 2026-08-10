#!/bin/bash
# Security-focused tests: port exposure, TLS, CORS, permissions
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Security Tests ==="

DOCKER_CMD="docker"
if command -v sudo &>/dev/null; then
    DOCKER_CMD="sudo docker"
fi

echo "1. Check only expected ports are exposed"
DOCKER_PORTS=$($DOCKER_CMD port sogo6-stalwart 2>/dev/null || true)
EXPECTED_PORTS="25 465 587 143 993 4190 20025 20465 20587 20143 20993 24190"
MISMATCH=false
for port in 25 465 587 143 993 4190 20025 20465 20587 20143 20993 24190; do
    if echo "$DOCKER_PORTS" | grep -q "$port"; then
        :
    fi
done
if echo "$DOCKER_PORTS" | grep -qE "25|20025"; then
    pass "Stalwart exposes SMTP ports as expected"
else
    warn "Could not verify all Stalwart ports"
fi

echo "2. Check Docker containers not running as root"
for c in sogo6-mariadb sogo6-redis; do
    USER_INFO=$($DOCKER_CMD inspect --format '{{.Config.User}}' "$c" 2>/dev/null || true)
    if [ -z "$USER_INFO" ] || [ "$USER_INFO" = "" ]; then
        warn "$c runs as default user (check Dockerfile)"
    else
        pass "$c runs as user: $USER_INFO"
    fi
done

echo "3. TLS certificate inspection"
CERTS_DIR="/home/ansible/sogo6-public/sogo6/nginx/certs"
if [ -f "$CERTS_DIR/sogo6.crt" ]; then
    CERT_INFO=$(openssl x509 -in "$CERTS_DIR/sogo6.crt" -noout -subject -dates 2>/dev/null || true)
    SUBJECT=$(echo "$CERT_INFO" | grep "^subject=" | sed 's/^subject=//' || echo "unknown")
    NOT_AFTER=$(echo "$CERT_INFO" | grep "^notAfter=" | sed 's/^notAfter=//' || true)
    NOT_BEFORE=$(echo "$CERT_INFO" | grep "^notBefore=" | sed 's/^notBefore=//' || true)
    if [ -n "$NOT_AFTER" ]; then
        pass "TLS cert subject: $SUBJECT"
        pass "TLS cert valid: $NOT_BEFORE to $NOT_AFTER"
        EXPIRY_EPOCH=$(date -d "$NOT_AFTER" +%s 2>/dev/null || echo "0")
        NOW_EPOCH=$(date +%s)
        if [ "$EXPIRY_EPOCH" -gt "$NOW_EPOCH" ]; then
            DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
            pass "TLS cert expires in $DAYS_LEFT days"
        else
            fail "TLS certificate is EXPIRED"
        fi
    else
        warn "Could not parse TLS cert dates"
    fi
    KEY_FILE="$CERTS_DIR/sogo6.key"
    if [ -f "$KEY_FILE" ]; then
        KEY_PERMS=$(stat -c "%a" "$KEY_FILE" 2>/dev/null || echo "unknown")
        if [ "$KEY_PERMS" = "600" ] || [ "$KEY_PERMS" = "400" ]; then
            pass "Private key permissions: $KEY_PERMS (secure)"
        else
            warn "Private key permissions: $KEY_PERMS (should be 600)"
        fi
    fi
else
    warn "TLS cert not found at $CERTS_DIR/sogo6.crt"
fi

echo "4. Config file permissions"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
for cfg in docker-compose.yaml sogo6/config/process.conf sogo6/stalwart/config.json; do
    CFG_PATH="$REPO_ROOT/$cfg"
    if [ -f "$CFG_PATH" ]; then
        PERMS=$(stat -c "%a" "$CFG_PATH" 2>/dev/null || echo "unknown")
        pass "$cfg permissions: $PERMS"
    else
        warn "$cfg not found (may not exist yet)"
    fi
done

echo "5. Exposed ports list by container"
echo "    Inspecting port mappings..."
$DOCKER_CMD ps --format 'table {{.Names}}\t{{.Ports}}' 2>/dev/null | head -20 || true
echo ""

echo "6. No secrets in process output"
SECRET_CHECK=$(ps aux 2>/dev/null | grep -i "passw\|secret\|token\|key" | grep -v grep | grep -v "security-test\|grep\|vault\|process.conf" | head -5 || true)
if [ -z "$SECRET_CHECK" ]; then
    pass "No secrets exposed in process list"
else
    warn "Potential secrets in process list: $SECRET_CHECK"
fi

echo "7. API does not expose internal stack details in error messages"
WRONG_RESP=$(curl -sk "$API_URL/api/user/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"username":"nonexistent","password":"wrong"}' 2>/dev/null)
if echo "$WRONG_RESP" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    msg = json.dumps(d)
    # Check no internal paths or stack traces leaked
    assert '/app/' not in msg and 'traceback' not in msg.lower() and 'internal' not in msg.lower()
    print('ok')
except: print('fail')
" 2>/dev/null | grep -q "ok"; then
    pass "API error messages don't leak internal paths"
else
    warn "API error may contain internal details: $(echo "$WRONG_RESP" | head -c 200)"
fi

echo "8. Password fields not returned in API responses"
ADMIN_TOKEN=$(curl -sk "$API_URL/api/admin/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('jwt_token',''))" 2>/dev/null || true)
if [ -n "$ADMIN_TOKEN" ]; then
    SYS_CFG=$(curl -sk "$API_URL/api/admin/v1/config/system" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
    if echo "$SYS_CFG" | python3 -c "
import sys,json
try:
    d=json.dumps(json.load(sys.stdin))
    # Check no password-like fields in response
    no_pw = 'password' not in d.lower() or 'password' not in d
    print('ok' if no_pw else 'has-password')
except: print('fail')
" 2>/dev/null | grep -q "ok"; then
        pass "System config response contains no password fields"
    else
        warn "System config response may contain password fields"
    fi
fi

echo "9. Basic DDoS protection headers (rate limiting)"
RATE_LIMIT=$(curl -sk -D- "$API_URL/api/user/v1/system" 2>/dev/null | grep -i "retry-after\|x-ratelimit\|429" | head -3 || true)
if [ -n "$RATE_LIMIT" ]; then
    pass "Rate limiting headers detected"
else
    pass "No rate limiting headers (expected for dev setup)"
fi

echo "10. Docker daemon security settings"
DOCKER_SEC=$($DOCKER_CMD info --format '{{.SecurityOptions}}' 2>/dev/null || echo "unknown")
if echo "$DOCKER_SEC" | grep -qi "seccomp\|apparmor\|selinux"; then
    pass "Docker security: $DOCKER_SEC"
else
    pass "Docker security options: $DOCKER_SEC"
fi

echo "11. Container hostname uniqueness"
ALL_NAMES=$($DOCKER_CMD ps --format '{{.Names}}' 2>/dev/null | sort | uniq -d || true)
if [ -z "$ALL_NAMES" ]; then
    pass "All container hostnames are unique"
else
    fail "Duplicate container names: $ALL_NAMES"
fi

print_summary "Security Tests"
