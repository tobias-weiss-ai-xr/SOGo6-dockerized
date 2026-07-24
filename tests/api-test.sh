#!/bin/bash
# SOGo 6 API health and authentication tests
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== API Tests ==="

echo "1. Health endpoint"
HEALTH=$(curl -sf "$API_URL/api/user/v1/system" 2>/dev/null || true)
if echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('error_code')=='S000000'" 2>/dev/null; then
    pass "System health check returned S000000"
else
    fail "System health check failed: $(echo "$HEALTH" | head -c 200)"
fi

echo "2. Swagger endpoints"
for path in /swagger-basic /swagger-admin; do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' "$API_URL$path" 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ] || [ "$CODE" = "301" ] || [ "$CODE" = "302" ]; then
        pass "Swagger $path responded $CODE"
    else
        fail "Swagger $path returned $CODE"
    fi
done

echo "3. Admin login"
ADMIN_TOKEN=$(curl -sk "$API_URL/api/admin/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('jwt_token',''))" 2>/dev/null || true)
if [ -n "$ADMIN_TOKEN" ]; then
    pass "Admin login returned JWT token"
else
    fail "Admin login failed"
fi

echo "4. Admin API - list domains"
if [ -n "$ADMIN_TOKEN" ]; then
    DOMAINS=$(curl -sk "$API_URL/api/admin/v1/config/domains" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
    if echo "$DOMAINS" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('error_code')=='S000000'" 2>/dev/null; then
        DOMAIN_COUNT=$(echo "$DOMAINS" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null || echo "0")
        pass "Domains endpoint returned $DOMAIN_COUNT domains"
    else
        fail "Domains endpoint failed"
    fi
fi

echo "5. Admin API - system config"
if [ -n "$ADMIN_TOKEN" ]; then
    SYS_CFG=$(curl -sk "$API_URL/api/admin/v1/config/system" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
    if echo "$SYS_CFG" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'SYSTEM_SETTINGS' in d.get('data',{})" 2>/dev/null; then
        pass "System config has SYSTEM_SETTINGS"
    else
        fail "System config missing SYSTEM_SETTINGS"
    fi
fi

echo "6. User logins"
for USER in "${!TEST_USERS[@]}"; do
    PASSWD="${TEST_USERS[$USER]}"
    TOKEN=$(curl -sk "$API_URL/api/user/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d "{\"username\":\"$USER\",\"password\":\"$PASSWD\"}" 2>/dev/null | \
        python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('jwt_token',''))" 2>/dev/null || true)
    if [ -n "$TOKEN" ]; then
        pass "User $USER login successful"
    else
        fail "User $USER login failed"
    fi
done

print_summary "API Tests"
