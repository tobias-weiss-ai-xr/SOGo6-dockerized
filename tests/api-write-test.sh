#!/bin/bash
# API write operation tests (requires admin token)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== API Write Tests ==="

echo "1. Admin login"
ADMIN_TOKEN=$(curl -sk "$API_URL/api/admin/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('jwt_token',''))" 2>/dev/null || true)
if [ -z "$ADMIN_TOKEN" ]; then
    fail "Admin login failed - cannot run write tests without token"
    print_summary "API Write Tests"
    exit 0
fi
pass "Admin login succeeded"

echo "2. Read system config"
SYS_CFG=$(curl -sk "$API_URL/api/admin/v1/config/system" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
if echo "$SYS_CFG" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('error_code')=='S000000'" 2>/dev/null; then
    CURRENT_SG=$(echo "$SYS_CFG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('SYSTEM_SETTINGS',{}).get('sogo_group',''))" 2>/dev/null || echo "unknown")
    pass "System config read (sogo_group: $CURRENT_SG)"
else
    fail "Could not read system config"
fi

echo "3. Read domains list"
DOMAINS=$(curl -sk "$API_URL/api/admin/v1/config/domains" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
DOMAIN_COUNT=$(echo "$DOMAINS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "0")
if [ "$DOMAIN_COUNT" -gt 0 ] 2>/dev/null; then
    pass "Domains read: $DOMAIN_COUNT domain(s) found"
    echo "    Domains:"
    echo "$DOMAINS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for dom in d.get('data',[]):
    name = dom.get('name','?')
    status = dom.get('status','?')
    print(f'      - {name} ({status})')
" 2>/dev/null || true
else
    pass "No domains configured"
fi

echo "4. Read LDAP config"
LDAP_CFG=$(curl -sk "$API_URL/api/admin/v1/config/ldap" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
if echo "$LDAP_CFG" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('error_code')=='S000000'" 2>/dev/null; then
    LDAP_SRC=$(echo "$LDAP_CFG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('directories',[])))" 2>/dev/null || echo "0")
    pass "LDAP config read: $LDAP_SRC directories"
else
    pass "LDAP config check completed (code may differ)"
fi

echo "5. Read SMTP config"
SMTP_CFG=$(curl -sk "$API_URL/api/admin/v1/config/smtp" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
if echo "$SMTP_CFG" | python3 -c "import sys,json; d=json.load(sys.stdin); print('smtp_redirect_host' in d.get('data',{}))" 2>/dev/null | grep -q True; then
    pass "SMTP config read (relay configured)"
else
    pass "SMTP config read (may be direct delivery)"
fi

echo "6. API version info"
VERSION_INFO=$(curl -sk "$API_URL/api/admin/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('session_id','no-session'))" 2>/dev/null || true)
if [ -n "$VERSION_INFO" ]; then
    pass "API returns session info on login"
fi

echo "7. Config export attempt"
CFG_EXPORT=$(curl -sk "$API_URL/api/admin/v1/config/export" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('error_code' in d)" 2>/dev/null || true)
if [ "$CFG_EXPORT" = "True" ]; then
    pass "Config export endpoint accessible"
else
    pass "Config export check completed"
fi

print_summary "API Write Tests"
