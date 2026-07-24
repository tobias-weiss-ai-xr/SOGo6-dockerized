#!/bin/bash
# LDAP user verification tests
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== LDAP Tests ==="

DOCKER_CMD="docker"
if command -v sudo &>/dev/null; then
    DOCKER_CMD="sudo docker"
fi

USE_DOCKER=false
if $DOCKER_CMD ps --format '{{.Names}}' 2>/dev/null | grep -q sogo6-ldap; then
    USE_DOCKER=true
fi

ldap_cmd() {
    if $USE_DOCKER; then
        $DOCKER_CMD exec sogo6-ldap ldapsearch -x -H ldap://localhost:389 -b "$LDAP_BASE_DN" -D "$LDAP_BIND_DN" -w "$LDAP_BIND_PW" "$@"
    else
        ldapsearch -x -H "ldap://$LDAP_HOST:$LDAP_PORT" -b "$LDAP_BASE_DN" -D "$LDAP_BIND_DN" -w "$LDAP_BIND_PW" "$@"
    fi
}

echo "1. LDAP server connectivity"
if ldap_cmd -s base 2>/dev/null | grep -q "$LDAP_BASE_DN"; then
    pass "LDAP server reachable and base DN found"
else
    fail "LDAP server not reachable or base DN missing"
fi

echo "2. LDAP user search"
for USER in "${!TEST_USERS[@]}"; do
    if ldap_cmd "(uid=$USER)" dn uid mail cn 2>/dev/null | grep -q "^dn:"; then
        pass "User $USER found in LDAP"
    else
        fail "User $USER not found in LDAP"
    fi
done

echo "3. LDAP user count"
USER_COUNT=$(ldap_cmd "(objectClass=inetOrgPerson)" 2>/dev/null | grep -c "^dn:" || echo "0")
if [ "$USER_COUNT" -ge 1 ] 2>/dev/null; then
    pass "LDAP has $USER_COUNT user(s)"
else
    fail "LDAP has no users"
fi

echo "4. LDAP mail attribute check"
MAIL_OK=0
MAIL_FAIL=0
for USER in "${!TEST_USERS[@]}"; do
    MAIL=$(ldap_cmd "(uid=$USER)" mail 2>/dev/null | grep "^mail:" | sed 's/^mail:[[:space:]]*//' || true)
    if [ "$MAIL" = "$USER" ]; then
        MAIL_OK=$((MAIL_OK + 1))
    else
        MAIL_FAIL=$((MAIL_FAIL + 1))
    fi
done
if [ "$MAIL_FAIL" -eq 0 ]; then
    pass "All users have correct mail attribute"
else
    fail "$MAIL_FAIL users have incorrect mail attribute"
fi

print_summary "LDAP Tests"
