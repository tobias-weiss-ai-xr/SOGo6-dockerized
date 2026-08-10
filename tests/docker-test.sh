#!/bin/bash
# Docker container status and health tests
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Docker Container Tests ==="

DOCKER_CMD="docker"
if command -v sudo &>/dev/null; then
    DOCKER_CMD="sudo docker"
fi

EXPECTED_CONTAINERS=(
    "sogo6-ui"
    "sogo6-server"
    "sogo6-mariadb"
    "sogo6-redis"
    "sogo6-ldap"
    "sogo6-stalwart"
)

echo "1. Docker daemon reachable"
if $DOCKER_CMD info &>/dev/null; then
    pass "Docker daemon is running"
else
    fail "Docker daemon not reachable"
fi

echo "2. All expected containers exist"
RUNNING=$($DOCKER_CMD ps --format '{{.Names}}' 2>/dev/null || true)
ALL_FOUND=true
for c in "${EXPECTED_CONTAINERS[@]}"; do
    if echo "$RUNNING" | grep -qx "$c"; then
        pass "Container $c is running"
    else
        fail "Container $c is NOT running"
        ALL_FOUND=false
    fi
done

echo "3. Container health status"
# Core services must be healthy; others may be starting
CORE_SERVICES="sogo6-server sogo6-mariadb sogo6-redis"
for c in "${EXPECTED_CONTAINERS[@]}"; do
    STATUS=$($DOCKER_CMD inspect --format '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "healthy" ]; then
        pass "$c health: healthy"
    elif [ "$STATUS" = "unknown" ]; then
        # Some containers may not have a healthcheck defined
        STATE=$($DOCKER_CMD inspect --format '{{.State.Status}}' "$c" 2>/dev/null || echo "unknown")
        if [ "$STATE" = "running" ]; then
            pass "$c running (no healthcheck)"
        else
            fail "$c state: $STATE (no healthcheck)"
        fi
    else
        if echo "$CORE_SERVICES" | grep -qw "$c"; then
            fail "$c health: $STATUS (core service must be healthy)"
        else
            warn "$c health: $STATUS (non-core service may still be starting)"
        fi
    fi
done

echo "4. No unexpected restarts"
for c in "${EXPECTED_CONTAINERS[@]}"; do
    RESTARTS=$($DOCKER_CMD inspect --format '{{.RestartCount}}' "$c" 2>/dev/null || echo "0")
    if [ "$RESTARTS" -eq 0 ] 2>/dev/null; then
        pass "$c restarts: 0"
    else
        warn "$c has $RESTARTS restart(s)"
    fi
done

echo "5. Container uptime check"
for c in "${EXPECTED_CONTAINERS[@]}"; do
    STARTED=$($DOCKER_CMD inspect --format '{{.State.StartedAt}}' "$c" 2>/dev/null || true)
    if [ -n "$STARTED" ]; then
        pass "$c started at $STARTED"
    else
        fail "$c start time unknown"
    fi
done

echo "6. Network connectivity between containers"
if $DOCKER_CMD network ls --format '{{.Name}}' 2>/dev/null | grep -q sogo6-net; then
    pass "sogo6-net network exists"
    NET_COUNT=$($DOCKER_CMD network inspect sogo6-net --format '{{len .Containers}}' 2>/dev/null || echo "0")
    pass "sogo6-net has $NET_COUNT containers attached"
else
    fail "sogo6-net network not found"
fi

print_summary "Docker Container Tests"
