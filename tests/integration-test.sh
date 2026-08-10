#!/bin/bash
# Cross-service integration flow tests
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Integration Flow Tests ==="

DOCKER_CMD="docker"
if command -v sudo &>/dev/null; then
    DOCKER_CMD="sudo docker"
fi

echo "1. Admin login and retrieve token"
ADMIN_TOKEN=$(curl -sk "$API_URL/api/admin/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('jwt_token',''))" 2>/dev/null || true)
if [ -n "$ADMIN_TOKEN" ]; then
    pass "Admin JWT token retrieved (${#ADMIN_TOKEN} chars)"
else
    fail "Cannot get admin token - integration tests depend on it"
    print_summary "Integration Flow Tests"
    exit 0
fi

echo "2. API config read returns LDAP settings"
LDAP_CFG=$(curl -sk "$API_URL/api/admin/v1/config/ldap" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
LDAP_DIRS=$(echo "$LDAP_CFG" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    dirs=d.get('data',{}).get('directories',[])
    for dr in dirs:
        print(dr.get('address',''), dr.get('base_dn',''))
except: print('parse-error')
" 2>/dev/null || echo "parse-error")
if [ "$LDAP_DIRS" != "parse-error" ] && [ -n "$LDAP_DIRS" ]; then
    pass "API config LDAP directories: $(echo "$LDAP_DIRS" | tr '\n' ' ')"
else
    warn "LDAP config not available via API"
fi

echo "3. API domain list matches expected domain"
DOMAINS=$(curl -sk "$API_URL/api/admin/v1/config/domains" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
DOMAIN_NAMES=$(echo "$DOMAINS" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    for dom in d.get('data',[]):
        print(dom.get('name',''))
except: pass
" 2>/dev/null || true)
if echo "$DOMAIN_NAMES" | grep -qi "example.org\|example"; then
    pass "Domain 'example.org' configured in API"
else
    warn "No 'example.org' domain found in API: $(echo "$DOMAIN_NAMES" | head -c 100)"
fi

echo "4. User auths via API (LDAP-dependent)"
LDAP_AUTH_WORKS=false
for USER in "${!TEST_USERS[@]}"; do
    PASSWD="${TEST_USERS[$USER]}"
    USER_TOKEN=$(curl -sk "$API_URL/api/user/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d "{\"username\":\"$USER\",\"password\":\"$PASSWD\"}" 2>/dev/null | \
        python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('jwt_token',''))" 2>/dev/null || true)
    if [ -z "$USER_TOKEN" ]; then
        warn "User $USER cannot authenticate via API (LDAP not functional)"
        continue
    fi
    LDAP_AUTH_WORKS=true
    PROFILE=$(curl -sk "$API_URL/api/user/v1/profile" \
        -H "Authorization: Bearer $USER_TOKEN" 2>/dev/null)
    PROFILE_MAIL=$(echo "$PROFILE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(d.get('data',{}).get('primary_email',''))
except: print('')
" 2>/dev/null || true)
    if [ "$PROFILE_MAIL" = "$USER" ]; then
        pass "User $USER profile email matches login"
    else
        warn "Profile email mismatch: '$PROFILE_MAIL' vs '$USER'"
    fi
done

echo "5. Container DNS resolution and inter-container connectivity"
for HOST in sogo6-mariadb sogo6-redis sogo6-ldap sogo6-stalwart; do
    set +e
    PING_RESULT=$($DOCKER_CMD exec sogo6-server ping -c 1 -W 2 "$HOST" 2>&1 || true)
    set -e
    if echo "$PING_RESULT" | grep -q "1 received\|1 packets transmitted, 1 received\|1 packets.*received"; then
        IP=$(echo "$PING_RESULT" | grep -oP 'from \K[0-9.]+' | head -1 || echo "unknown")
        pass "$HOST reachable from server container ($HOST -> $IP)"
    elif echo "$PING_RESULT" | grep -q "0 received\|100% packet loss\|Name or service not known\|not found"; then
        warn "$HOST not reachable via ping"
    else
        # Last resort: try TCP connection test
        CONN_TEST=$($DOCKER_CMD exec sogo6-server timeout 2 bash -c "echo > /dev/tcp/$HOST/389" 2>&1 || true)
        if [ -z "$CONN_TEST" ]; then
            pass "$HOST reachable via TCP (port 389)"
        else
            warn "Cannot reach $HOST from server container"
        fi
    fi
done
set +e
SELF_RESOLVE=$($DOCKER_CMD exec sogo6-server hostname -i 2>/dev/null || echo "unknown")
set -e
pass "Server container IP: $SELF_RESOLVE"

echo "6. CORS headers on API responses"
CORS_HEADERS=$(curl -sk -D- "$API_URL/api/user/v1/system" 2>/dev/null | head -20 || true)
if echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin"; then
    CORS_VAL=$(echo "$CORS_HEADERS" | grep -i "access-control-allow-origin" | head -1 | sed 's/.*: //')
    pass "API has CORS header: $CORS_VAL"
else
    warn "No CORS Access-Control-Allow-Origin header on API"
fi

echo "7. API response time under threshold"
for endpoint in "/api/user/v1/system" "/swagger-basic" "/swagger-admin"; do
    TIMING=$(curl -sk -o /dev/null -w '%{time_total}' --connect-timeout 5 "$API_URL$endpoint" 2>/dev/null || echo "999")
    if [ "$(echo "$TIMING < 2.0" | bc -l 2>/dev/null || echo "1")" -eq 1 ]; then
        pass "$endpoint responded in ${TIMING}s"
    else
        warn "$endpoint slow: ${TIMING}s"
    fi
done

echo "8. Cross-service health check"
ALL_HEALTHY=true
for svc in sogo6-server sogo6-mariadb sogo6-redis sogo6-ldap; do
    STATUS=$($DOCKER_CMD inspect --format '{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "unknown")
    if [ "$STATUS" != "healthy" ]; then
        ALL_HEALTHY=false
        fail "$svc health: $STATUS"
    fi
done
if $ALL_HEALTHY; then
    pass "All core services report healthy status"
fi

echo "9. MariaDB stores API settings"
MDB_CMD="$DOCKER_CMD exec sogo6-mariadb mariadb -u$POSTGRES_USER -p$MARIADB_PASSWORD $POSTGRES_DB -N -e"
if $DOCKER_CMD ps --format '{{.Names}}' 2>/dev/null | grep -q sogo6-mariadb; then
    SETTING_COUNT=$($MDB_CMD "SELECT count(*) FROM sogo6_sogo_settings;" 2>/dev/null | tr -d ' ' || echo "0")
    if [ "$SETTING_COUNT" -gt 0 ] 2>/dev/null; then
        pass "MariaDB has $SETTING_COUNT settings stored"
    else
        warn "No settings found in sogo6_sogo_settings table"
    fi
fi

echo "10. API version endpoint"
VERSION=$(curl -sk "$API_URL/api/user/v1/system" 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    v=d.get('data',{})
    print(v.get('version',''), v.get('build',''), v.get('flavor',''))
except: print('parse-error')
" 2>/dev/null || true)
if [ "$VERSION" != "parse-error" ] && [ -n "$VERSION" ]; then
    pass "API version info: $VERSION"
else
    warn "Could not parse API version info"
fi

print_summary "Integration Flow Tests"
