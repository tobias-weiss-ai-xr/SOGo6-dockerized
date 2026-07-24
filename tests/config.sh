#!/bin/bash
# Shared configuration for test scripts
set -euo pipefail

UI_URL="${SOGO_UI_URL:-http://localhost:3000}"
API_URL="${SOGO_API_URL:-http://localhost:5001}"
API_INTERNAL="${SOGO_API_INTERNAL:-http://sogo6-server:5000}"

LDAP_HOST="${SOGO_LDAP_HOST:-localhost}"
LDAP_PORT="${SOGO_LDAP_PORT:-389}"
LDAP_BASE_DN="${SOGO_LDAP_BASE_DN:-dc=example,dc=org}"
LDAP_BIND_DN="${SOGO_LDAP_BIND_DN:-cn=admin,dc=example,dc=org}"
LDAP_BIND_PW="${SOGO_LDAP_BIND_PW:-admin}"

SMTP_HOST="${SOGO_SMTP_HOST:-localhost}"
SMTP_PORT="${SOGO_SMTP_PORT:-20025}"
IMAP_PORT="${SOGO_IMAP_PORT:-20993}"
SIEVE_PORT="${SOGO_SIEVE_PORT:-24190}"
SUBMISSION_PORT="${SOGO_SUBMISSION_PORT:-20587}"

POSTGRES_HOST="${SOGO_PG_HOST:-localhost}"
POSTGRES_PORT="${SOGO_PG_PORT:-5432}"
POSTGRES_USER="${SOGO_PG_USER:-sogo}"
POSTGRES_PASSWORD="${SOGO_PG_PASSWORD:-sogo}"
POSTGRES_DB="${SOGO_PG_DB:-sogo}"

REDIS_HOST="${SOGO_REDIS_HOST:-localhost}"
REDIS_PORT="${SOGO_REDIS_PORT:-6379}"

ADMIN_USER="${SOGO_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${SOGO_ADMIN_PASSWORD:-admin}"

declare -A TEST_USERS
TEST_USERS[testuser@example.org]=password123
TEST_USERS[testadmin@example.org]=password123
TEST_USERS[testuser2@example.org]=password123

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
ERRORS=()

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $*"
}

pass() {
    PASS=$((PASS + 1))
    echo "  [PASS] $*"
}

fail() {
    FAIL=$((FAIL + 1))
    echo "  [FAIL] $*"
    ERRORS+=("$*")
}

print_summary() {
    local label="${1:-Tests}"
    echo ""
    echo "=== $label Summary ==="
    echo "  Passed: $PASS"
    echo "  Failed: $FAIL"
    if [ ${#ERRORS[@]} -gt 0 ]; then
        echo "  Errors:"
        for e in "${ERRORS[@]}"; do
            echo "    - $e"
        done
    fi
    echo ""
}

reset_counts() {
    PASS=0
    FAIL=0
    ERRORS=()
}
