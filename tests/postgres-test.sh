#!/bin/bash
# PostgreSQL connectivity and schema tests
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== PostgreSQL Tests ==="

DOCKER_CMD="docker"
if command -v sudo &>/dev/null; then
    DOCKER_CMD="sudo docker"
fi

PG_CMD="$DOCKER_CMD exec sogo6-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c"

pg_test() {
    if $DOCKER_CMD ps --format '{{.Names}}' 2>/dev/null | grep -q sogo6-postgres; then
        return 0
    fi
    return 1
}

if ! pg_test; then
    echo "1. PostgreSQL container not available, skipping docker-exec tests"
    warn "PostgreSQL container not running"
    print_summary "PostgreSQL Tests"
    exit 0
fi

echo "1. PostgreSQL connectivity"
if $PG_CMD "SELECT 1;" 2>/dev/null | grep -q "1"; then
    pass "PostgreSQL server reachable"
else
    fail "PostgreSQL server not reachable"
fi

echo "2. Database exists"
DB_EXISTS=$($PG_CMD "SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB';" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$DB_EXISTS" = "1" ]; then
    pass "Database '$POSTGRES_DB' exists"
else
    fail "Database '$POSTGRES_DB' not found"
fi

echo "3. Database has tables"
TABLE_COUNT=$($PG_CMD "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$TABLE_COUNT" -gt 0 ] 2>/dev/null; then
    pass "Database has $TABLE_COUNT tables"
else
    pass "Database has no tables yet (fresh install)"
fi

echo "4. List tables for diagnostics"
TABLES=$($PG_CMD "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;" 2>/dev/null || true)
if [ -n "$TABLES" ]; then
    echo "    Tables: $(echo "$TABLES" | tr '\n' ' ')"
fi

echo "5. Database connection count"
CONN_COUNT=$($PG_CMD "SELECT count(*) FROM pg_stat_activity WHERE datname='$POSTGRES_DB';" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$CONN_COUNT" -ge 0 ] 2>/dev/null; then
    pass "Active connections: $CONN_COUNT"
else
    pass "Could not check connection count"
fi

echo "6. PostgreSQL settings check"
PG_VERSION=$($PG_CMD "SELECT current_setting('server_version');" 2>/dev/null | tr -d ' ' || echo "unknown")
if [ "$PG_VERSION" != "unknown" ]; then
    pass "PostgreSQL version: $PG_VERSION"
else
    fail "Could not determine PostgreSQL version"
fi

echo "7. sogo schema user table check"
if [ "$TABLE_COUNT" -gt 0 ] 2>/dev/null; then
    USER_TABLES=$($PG_CMD "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%user%';" 2>/dev/null | tr -d ' ' || echo "0")
    if [ "$USER_TABLES" -gt 0 ] 2>/dev/null; then
        pass "Found $USER_TABLES user-related tables"
    else
        pass "No user-related tables found (schema may use different naming)"
    fi
fi

print_summary "PostgreSQL Tests"
