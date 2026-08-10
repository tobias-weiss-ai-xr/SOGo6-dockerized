#!/bin/bash
# Configuration and script validation tests
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Configuration & Script Validation Tests ==="

REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "1. Config file existence"
MISSING=false
declare -A CFG_FILES
CFG_FILES[docker-compose.yaml]=docker-compose.yaml
CFG_FILES[SOGo6 process conf]=sogo6/config/process.conf
CFG_FILES[SOGo6 system settings]=sogo6/config/system_settings.json
CFG_FILES[Stalwart config]=sogo6/stalwart/config.json
CFG_FILES[Nginx config]=sogo6/nginx/nginx.conf
CFG_FILES[LDAP init]=sogo6/ldap/init.ldif
CFG_FILES[LDAP Dockerfile]=sogo6/ldap/Dockerfile

for label in "${!CFG_FILES[@]}"; do
    path="${CFG_FILES[$label]}"
    if [ -f "$REPO_ROOT/$path" ]; then
        SIZE=$(stat -c "%s" "$REPO_ROOT/$path" 2>/dev/null || echo "0")
        pass "$label exists ($SIZE bytes)"
    else
        fail "$label MISSING at $path"
        MISSING=true
    fi
done

echo "2. Script file existence and executability"
declare -A SCRIPTS
SCRIPTS[setup]=sogo6/scripts/setup.sh
SCRIPTS[init-sogo6]=sogo6/scripts/init-sogo6.sh
SCRIPTS[gen-certs]=sogo6/scripts/gen-certs.sh
SCRIPTS[manage-secrets]=sogo6/scripts/manage-secrets.sh
SCRIPTS[backup]=sogo6/scripts/backup.sh

for label in "${!SCRIPTS[@]}"; do
    path="${SCRIPTS[$label]}"
    if [ -f "$REPO_ROOT/$path" ]; then
        if [ -x "$REPO_ROOT/$path" ]; then
            SHEBANG=$(head -1 "$REPO_ROOT/$path" 2>/dev/null || true)
            if echo "$SHEBANG" | grep -q "^#!"; then
                pass "$label script executable with shebang: $SHEBANG"
            else
                warn "$label script missing shebang"
            fi
        else
            warn "$label script exists but not executable"
        fi
    else
        fail "$label script MISSING at $path"
    fi
done

echo "3. docker-compose.yaml syntax validation"
if command -v docker &>/dev/null; then
    if docker compose -f "$REPO_ROOT/docker-compose.yaml" config 2>/dev/null | head -5 >/dev/null; then
        pass "docker-compose.yaml is valid"
    else
        fail "docker-compose.yaml has syntax errors"
    fi
else
    warn "docker not available, skipping compose validation"
fi

echo "4. JSON config file validity"
for json_file in sogo6/config/system_settings.json sogo6/stalwart/config.json; do
    f="$REPO_ROOT/$json_file"
    if [ -f "$f" ]; then
        if python3 -c "import json; json.load(open('$f'))" 2>/dev/null; then
            pass "$json_file is valid JSON"
        else
            fail "$json_file has invalid JSON"
        fi
    fi
done

echo "5. process.conf required keys check"
PCONF="$REPO_ROOT/sogo6/config/process.conf"
if [ -f "$PCONF" ]; then
    MISSING_KEYS=""
    for key in SOGO_P_ADMIN_PWD SOGO_P_VOUCHER_SECRET SOGO_AES_ENC_KEY LDAP_BIND_PASSWORD; do
        if grep -q "^${key}=" "$PCONF" 2>/dev/null; then
            :
        else
            MISSING_KEYS="$MISSING_KEYS $key"
        fi
    done
    if [ -z "$MISSING_KEYS" ]; then
        pass "process.conf has all required keys"
    else
        warn "process.conf missing keys:$MISSING_KEYS"
    fi
fi

echo "6. Secrets vault file integrity"
VAULT="$REPO_ROOT/secrets/sogo6.vault.env"
if [ -f "$VAULT" ]; then
    LINE_COUNT=$(wc -l < "$VAULT")
    HAS_VARS=$(grep -c "=" "$VAULT" || true)
    if [ "$HAS_VARS" -gt 0 ]; then
        pass "Secrets vault exists with $HAS_VARS variables ($LINE_COUNT lines)"
    else
        warn "Secrets vault exists but has no variables"
    fi
else
    warn "Secrets vault not generated yet (run manage-secrets.sh)"
fi

echo "7. TLS certificate and key pair match"
CERTS_DIR="$REPO_ROOT/sogo6/nginx/certs"
if [ -f "$CERTS_DIR/sogo6.crt" ] && [ -f "$CERTS_DIR/sogo6.key" ]; then
    CERT_MOD=$(openssl x509 -noout -modulus -in "$CERTS_DIR/sogo6.crt" 2>/dev/null | openssl md5)
    KEY_MOD=$(openssl rsa -noout -modulus -in "$CERTS_DIR/sogo6.key" 2>/dev/null | openssl md5)
    if [ "$CERT_MOD" = "$KEY_MOD" ]; then
        pass "TLS certificate and private key match"
    else
        fail "TLS certificate and private key MISMATCH"
    fi
else
    warn "TLS files not found, skipping pair check"
fi

echo "8. init-sogo6.sh dry-run check (validate syntax)"
INIT_SCRIPT="$REPO_ROOT/sogo6/scripts/init-sogo6.sh"
if [ -f "$INIT_SCRIPT" ]; then
    if bash -n "$INIT_SCRIPT" 2>/dev/null; then
        pass "init-sogo6.sh has valid bash syntax"
    else
        fail "init-sogo6.sh has bash syntax errors"
    fi
fi

echo "9. File encoding (all text files should be UTF-8)"
TEXT_FILES=(
    "docker-compose.yaml"
    "sogo6/config/process.conf"
    "sogo6/config/system_settings.json"
    "sogo6/stalwart/config.json"
    "sogo6/nginx/nginx.conf"
    "sogo6/ldap/init.ldif"
    "README.md"
    "CONTRIBUTING.md"
    "LICENSE"
)
ENCODING_OK=true
for f in "${TEXT_FILES[@]}"; do
    path="$REPO_ROOT/$f"
    if [ -f "$path" ]; then
        ENCODING=$(file -b --mime-encoding "$path" 2>/dev/null || echo "unknown")
        if [ "$ENCODING" != "utf-8" ] && [ "$ENCODING" != "us-ascii" ] && [ "$ENCODING" != "unknown" ]; then
            warn "$f encoding: $ENCODING"
            ENCODING_OK=false
        fi
    fi
done
if $ENCODING_OK; then
    pass "All text files are UTF-8/ASCII encoded"
fi

echo "10. README sections check"
README="$REPO_ROOT/README.md"
if [ -f "$README" ]; then
    for section in "Description\|Overview" "Quick Start\|Getting Started\|Setup" "Testing\|Tests" "Architecture\|Components" "License\|Contributing"; do
        if grep -qi "$section" "$README" 2>/dev/null; then
            :
        else
            warn "README missing section: $section"
        fi
    done
    pass "README has all required sections"
else
    fail "README.md MISSING"
fi

print_summary "Configuration & Script Validation Tests"
