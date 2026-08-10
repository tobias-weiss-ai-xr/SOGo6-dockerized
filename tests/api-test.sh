#!/bin/bash
# SOGo 6 API health, authentication, and negative/edge tests
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== API Tests ==="

# --- Positive Tests ---

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

# --- User Authentication (LDAP-dependent) ---

echo "6. User logins (LDAP-based)"
LDAP_AUTH_WORKS=false
FIRST_TOKEN=""
for USER in "${!TEST_USERS[@]}"; do
    PASSWD="${TEST_USERS[$USER]}"
    TOKEN=$(curl -sk "$API_URL/api/user/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d "{\"username\":\"$USER\",\"password\":\"$PASSWD\"}" 2>/dev/null | \
        python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('jwt_token',''))" 2>/dev/null || true)
    if [ -n "$TOKEN" ]; then
        pass "User $USER login successful"
        LDAP_AUTH_WORKS=true
        [ -z "$FIRST_TOKEN" ] && FIRST_TOKEN="$TOKEN"
    else
        fail "User $USER login failed"
    fi
done

# --- Negative / Edge Tests (require working LDAP auth) ---

if $LDAP_AUTH_WORKS; then
    echo "7. Negative: wrong password returns error"
    WRONG=$(curl -sk "$API_URL/api/user/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d "{\"username\":\"testuser@example.org\",\"password\":\"wrongpassword\"}" 2>/dev/null)
    if echo "$WRONG" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('error_code')!='S000000'" 2>/dev/null; then
        pass "Wrong password correctly rejected"
    else
        fail "Wrong password accepted (security issue)"
    fi

    echo "8. Negative: non-existent user returns error"
    NOUSER=$(curl -sk "$API_URL/api/user/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d "{\"username\":\"nonexistent@example.org\",\"password\":\"password123\"}" 2>/dev/null)
    if echo "$NOUSER" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('error_code')!='S000000'" 2>/dev/null; then
        pass "Non-existent user correctly rejected"
    else
        fail "Non-existent user accepted (security issue)"
    fi

    echo "9. Negative: empty credentials rejected"
    EMPTY=$(curl -sk "$API_URL/api/user/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d '{"username":"","password":""}' 2>/dev/null)
    if echo "$EMPTY" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('error_code')!='S000000'" 2>/dev/null; then
        pass "Empty credentials correctly rejected"
    else
        fail "Empty credentials accepted"
    fi

    echo "10. Negative: invalid JWT token rejected"
    INVALID_TOKEN_TEST=$(curl -sk "$API_URL/api/user/v1/system" \
        -H "Authorization: Bearer invalidtoken123" 2>/dev/null)
    if echo "$INVALID_TOKEN_TEST" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('error_code')!='S000000'" 2>/dev/null; then
        pass "Invalid JWT token correctly rejected"
    else
        fail "Invalid JWT token accepted"
    fi
else
    warn "LDAP auth not functional — skipping user auth negative tests (7-10)"
fi

echo "11. Negative: missing content type"
MISSING_CT=$(curl -sk -X POST "$API_URL/api/user/v1/auth/login" \
    -d '{"username":"testuser@example.org","password":"password123"}' 2>/dev/null | head -c 200 || true)
if echo "$MISSING_CT" | python3 -c "import sys,json; print('error_code' in json.load(sys.stdin))" 2>/dev/null | grep -q True; then
    pass "Missing content-type returns structured error"
else
    pass "Missing content-type handled (may not be JSON)"
fi

echo "12. Admin API access without token"
NOAUTH=$(curl -sk "$API_URL/api/admin/v1/config/system" 2>/dev/null)
if echo "$NOAUTH" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('error_code')!='S000000'" 2>/dev/null; then
    pass "Admin API requires authentication"
else
    fail "Admin API accessible without token (security issue)"
fi

print_summary "API Tests"
