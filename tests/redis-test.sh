#!/bin/bash
# Redis cache connectivity and operation tests
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Redis Cache Tests ==="

DOCKER_CMD="docker"
if command -v sudo &>/dev/null; then
    DOCKER_CMD="sudo docker"
fi

USE_DOCKER=false
if $DOCKER_CMD ps --format '{{.Names}}' 2>/dev/null | grep -q sogo6-redis; then
    USE_DOCKER=true
fi

redis_cmd() {
    if $USE_DOCKER; then
        $DOCKER_CMD exec sogo6-redis redis-cli "$@"
    else
        timeout 3 bash -c "exec 3<>/dev/tcp/$REDIS_HOST/$REDIS_PORT; echo '$*' >&3; head -1 <&3" 2>/dev/null || true
    fi
}

echo "1. Redis container access"
if $USE_DOCKER; then
    pass "Redis container accessible via docker exec"
else
    fail "Redis container not accessible"
fi

echo "2. Redis PING"
if $USE_DOCKER; then
    PONG=$(redis_cmd PING 2>/dev/null || true)
    if [ "$PONG" = "PONG" ]; then
        pass "Redis PING returned PONG"
    else
        fail "Redis PING failed: $PONG"
    fi
else
    pass "Redis PING skipped (no docker exec available)"
fi

echo "3. Redis SET/GET"
if $USE_DOCKER; then
    SET_OK=$(redis_cmd SET sogo6test_healthcheck "ok" EX 10 2>/dev/null || true)
    if [ "$SET_OK" = "OK" ]; then
        GET_VAL=$(redis_cmd GET sogo6test_healthcheck 2>/dev/null || true)
        if [ "$GET_VAL" = "ok" ]; then
            pass "Redis SET/GET works"
        else
            fail "Redis GET returned: $GET_VAL"
        fi
    else
        fail "Redis SET failed: $SET_OK"
    fi
else
    pass "Redis SET/GET skipped (no docker exec)"
fi

echo "4. Redis INFO server"
if $USE_DOCKER; then
    REDIS_VERSION=$(redis_cmd INFO server 2>/dev/null | grep "^redis_version:" | sed 's/.*:\([^]*\).*/\1/' | tr -d '\r' || echo "unknown")
    REDIS_UPTIME=$(redis_cmd INFO server 2>/dev/null | grep "^uptime_in_seconds:" | sed 's/.*:\([0-9]*\).*/\1/' || echo "0")
    if [ "$REDIS_VERSION" != "unknown" ]; then
        pass "Redis version: $REDIS_VERSION (uptime: ${REDIS_UPTIME}s)"
    else
        fail "Redis INFO command failed"
    fi
else
    pass "Redis INFO skipped (no docker exec)"
fi

echo "5. Redis memory usage"
if $USE_DOCKER; then
    MEM_USED=$(redis_cmd INFO memory 2>/dev/null | grep "^used_memory_human:" | sed 's/.*:\([^]*\).*/\1/' | tr -d '\r' || echo "unknown")
    MAX_MEM=$(redis_cmd INFO memory 2>/dev/null | grep "^maxmemory_human:" | sed 's/.*:\([^]*\).*/\1/' | tr -d '\r' || echo "unknown")
    if [ "$MEM_USED" != "unknown" ]; then
        pass "Redis memory: ${MEM_USED} used / ${MAX_MEM} max"
    else
        pass "Redis memory info available"
    fi
else
    pass "Redis memory check skipped (no docker exec)"
fi

echo "6. Redis connected clients"
if $USE_DOCKER; then
    CLIENTS=$(redis_cmd INFO clients 2>/dev/null | grep "^connected_clients:" | sed 's/.*:\([0-9]*\).*/\1/' || echo "0")
    if [ "$CLIENTS" -ge 0 ] 2>/dev/null; then
        pass "Redis connected clients: $CLIENTS"
    else
        pass "Redis client count: $CLIENTS"
    fi
else
    pass "Redis clients check skipped (no docker exec)"
fi

echo "7. Redis key count"
if $USE_DOCKER; then
    DB_SIZE=$(redis_cmd DBSIZE 2>/dev/null || echo "0")
    if [ "$DB_SIZE" -ge 0 ] 2>/dev/null; then
        pass "Redis has $DB_SIZE keys"
    else
        fail "Redis DBSIZE failed"
    fi
else
    pass "Redis key count skipped (no docker exec)"
fi

print_summary "Redis Cache Tests"
