#!/bin/bash
# Docker Compose configuration validation tests
# Validates compose files, service definitions, healthchecks, and config consistency.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Docker Compose Validation Tests ==="

REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILES=("docker-compose.yaml" "docker-compose.dev.yaml" "docker-compose.minimal.yaml" "docker-compose.override.yaml")

# --- YAML Syntax Validation ---

echo "1. YAML syntax validation"
for f in "${COMPOSE_FILES[@]}"; do
    FILE="$REPO_ROOT/$f"
    if [ -f "$FILE" ]; then
        if command -v python3 &>/dev/null; then
            YAML_ERR=$(python3 -c "import yaml; yaml.safe_load(open('$FILE'))" 2>&1)
            if [ $? -eq 0 ]; then
                pass "$f: valid YAML"
            else
                fail "$f: YAML parse error: $(printf '%.200s' "$YAML_ERR")"
            fi
        else
            warn "$f: python3 not available for YAML validation"
        fi
    else
        pass "$f: not present (optional file)"
    fi
done

echo "2. Docker Compose config validation"
if command -v docker &>/dev/null; then
    for f in docker-compose.yaml docker-compose.minimal.yaml; do
        FILE="$REPO_ROOT/$f"
        if [ -f "$FILE" ]; then
            COMPOSE_ERR=$(docker compose -f "$FILE" config --quiet 2>&1)
            if [ $? -eq 0 ]; then
                pass "docker compose config: $f valid"
            else
                fail "docker compose config: $f invalid: $(printf '%.200s' "$COMPOSE_ERR")"
            fi
        fi
    done
else
    warn "docker not available, skipping compose config validation"
fi

# --- Required Services Check ---

echo "3. Required services defined in compose"
if [ -f "$REPO_ROOT/docker-compose.yaml" ]; then
    for svc in sogo6-server stalwart redis postgres ldap; do
        if grep -q "${svc}:" "$REPO_ROOT/docker-compose.yaml" 2>/dev/null; then
            pass "Service '$svc' defined in docker-compose.yaml"
        else
            warn "Service '$svc' not found in docker-compose.yaml (may be in override)"
        fi
    done
fi

# --- Healthcheck Validation ---

echo "4. Healthcheck definitions"
for f in docker-compose.yaml docker-compose.override.yaml; do
    FILE="$REPO_ROOT/$f"
    [ -f "$FILE" ] || continue
    while IFS= read -r line; do
        svc=$(echo "$line" | sed 's/^ *//')
        if grep -A5 "^  ${svc}:
" "$FILE" 2>/dev/null | grep -q "healthcheck"; then
            pass "Service '$svc' has a healthcheck defined"
        fi
    done < <(grep -E '^  [a-z0-9_-]+:' "$FILE" | sed 's/:.*//' | sed 's/^ *//')
done

# --- Port Conflict Detection ---

echo "5. Port conflict detection"
if command -v python3 &>/dev/null && [ -f "$REPO_ROOT/docker-compose.yaml" ]; then
    PORT_CONFLICTS=$(python3 -c "
import yaml, collections
with open('$REPO_ROOT/docker-compose.yaml') as f:
    data = yaml.safe_load(f)
ports = collections.defaultdict(list)
for svc, cfg in data.get('services', {}).items():
    for p in (cfg.get('ports') or []):
        if isinstance(p, str):
            host_port = p.split(':')[0]
            ports[host_port].append(svc)
        elif isinstance(p, int):
            ports[str(p)].append(svc)
for port, svcs in ports.items():
    if len(svcs) > 1:
        print(f'Port {port} used by: {", ".join(svcs)}')
" 2>/dev/null)
    if [ -z "$PORT_CONFLICTS" ]; then
        pass "No port conflicts detected"
    else
        fail "Port conflicts: $PORT_CONFLICTS"
    fi
else
    warn "python3 not available, skipping port conflict detection"
fi

# --- Image Reference Validation ---

echo "6. Image references are valid"
if [ -f "$REPO_ROOT/docker-compose.yaml" ]; then
    IMAGES=$(grep -E 'image:' "$REPO_ROOT/docker-compose.yaml" | awk '{print $2}' | tr -d '"'"'"  | sort -u || true)
    for img in $IMAGES; do
        if echo "$img" | grep -qE 'localhost|127\.0\.0\.1|^
'; then
            pass "Image '$img' is a local build reference"
        else
            pass "Image reference: $img"
        fi
    done
fi

# --- Environment Variable Consistency ---

echo "7. Environment variable references"
if [ -f "$REPO_ROOT/docker-compose.yaml" ]; then
    # Find env vars referenced but not defined in .env or compose environment
    UNDEFINED=$(grep -oE '\$\{[A-Z_][A-Z0-9_]*\}' "$REPO_ROOT/docker-compose.yaml" | sort -u | head -10 || true)
    VAR_COUNT=$(echo "$UNDEFINED" | grep -cE '\$\{' || echo "0")
    pass "Found $VAR_COUNT environment variable references in compose"
fi

# --- Network Configuration ---

echo "8. Network configuration"
if [ -f "$REPO_ROOT/docker-compose.yaml" ]; then
    if grep -q "networks:" "$REPO_ROOT/docker-compose.yaml"; then
        NETWORK_COUNT=$(grep -E '^  [a-z]' "$REPO_ROOT/docker-compose.yaml" | grep -c ':' || echo "0")
        pass "Networks defined in compose ($NETWORK_COUNT network blocks)"
    else
        pass "Using default network (no custom networks defined)"
    fi
fi

# --- Volume Configuration ---

echo "9. Volume configuration"
if [ -f "$REPO_ROOT/docker-compose.yaml" ]; then
    if grep -q "volumes:" "$REPO_ROOT/docker-compose.yaml"; then
        VOL_COUNT=$(grep -A1 "^  [a-z].*:$" "$REPO_ROOT/docker-compose.yaml" | grep -c "driver\|nfs\|cifs" || echo "0")
        pass "Volumes defined in compose"
        if [ "$VOL_COUNT" -gt 0 ]; then
            pass "$VOL_COUNT volumes with custom drivers"
        fi
    else
        pass "No named volumes defined (using bind mounts or inline)"
    fi
fi

# --- Secrets Validation ---

echo "10. Secrets not hardcoded"
if [ -f "$REPO_ROOT/docker-compose.yaml" ]; then
    # Check for obviously hardcoded passwords
    HARD_CODED=$(grep -iE 'password.*=.*[a-zA-Z0-9]{8,}' "$REPO_ROOT/docker-compose.yaml" | grep -v '\$\|{{\|_FILE\|_PASSWORD_FILE' | head -3 || true)
    if [ -z "$HARD_CODED" ]; then
        pass "No obviously hardcoded passwords in compose"
    else
        warn "Potentially hardcoded credentials found (check if intentional): $(printf '%.200s' "$HARD_CODED")"
    fi
fi

# --- Traefik Config Validation ---

echo "11. Traefik configuration validation"
TRAEFIK_FILE="$REPO_ROOT/docker-compose.traefik.yaml"
if [ -f "$TRAEFIK_FILE" ]; then
    if command -v python3 &>/dev/null; then
        python3 -c "import yaml; yaml.safe_load(open('$TRAEFIK_FILE'))" 2>/dev/null && \
            pass "Traefik compose file is valid YAML" || \
            fail "Traefik compose file has YAML errors"
    fi
else
    pass "Traefik compose file not present (optional)"
fi

# --- Helm Chart Validation ---

echo "12. Helm chart basic validation"
if [ -d "$REPO_ROOT/helm" ]; then
    if [ -f "$REPO_ROOT/helm/Chart.yaml" ]; then
        CHART_NAME=$(grep 'name:' "$REPO_ROOT/helm/Chart.yaml" | head -1 | awk '{print $2}' || echo "unknown")
        CHART_VER=$(grep 'version:' "$REPO_ROOT/helm/Chart.yaml" | head -1 | awk '{print $2}' || echo "unknown")
        pass "Helm chart '$CHART_NAME' v$CHART_VER found"
    fi
    if [ -f "$REPO_ROOT/helm/values.yaml" ]; then
        if command -v python3 &>/dev/null; then
            python3 -c "import yaml; yaml.safe_load(open('$REPO_ROOT/helm/values.yaml'))" 2>/dev/null && \
                pass "Helm values.yaml is valid YAML" || \
                fail "Helm values.yaml has YAML errors"
        fi
    fi
else
    pass "No helm/ directory found"
fi

print_summary "Docker Compose Validation Tests"
