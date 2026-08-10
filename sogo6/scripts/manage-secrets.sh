#!/bin/bash
# =============================================================================
# SOGo 6 Secret Manager — generate, store, rotate secrets
#
# Usage:
#   ./manage-secrets.sh                  # create vault if missing (idempotent)
#   ./manage-secrets.sh --list           # list all secrets (masked)
#   ./manage-secrets.sh --show           # show all secrets in plain text
#   ./manage-secrets.sh --rotate <key>   # rotate a single secret
#   ./manage-secrets.sh --rotate-all     # rotate every secret
#   ./manage-secrets.sh --env-file       # print docker-compose env_file content
#
# Vault file:  $VAULT_DIR/sogo6.vault.env  (gitignored, never commit)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VAULT_DIR="$PROJECT_ROOT/secrets"
VAULT_FILE="$VAULT_DIR/sogo6.vault.env"
MARKER="# SOGo 6 Vault — auto-generated, do not edit manually"

# ── Key definitions ──────────────────────────────────────────────────────────
# Format: KEY_NAME|description|length
KEYS=(
  "SOGO_P_VOUCHER_SECRET|Voucher signing secret|32"
  "SOGO_AES_ENC_KEY|AES encryption key|32"
  "SOGO_P_DB_PASS|PostgreSQL application password|24"
  "POSTGRES_PASSWORD|PostgreSQL root password|24"
  "LDAP_ADMIN_PASSWORD|OpenLDAP admin password|24"
  "LDAP_CONFIG_PASSWORD|OpenLDAP config password|24"
  "SOGO_SECRET_KEY|Flask session / JWT fallback|64"
)

# ── Helpers ──────────────────────────────────────────────────────────────────
random_secret() {
  local len="$1"
  if command -v openssl &>/dev/null; then
    openssl rand -hex "$((len / 2))" | cut -c1-"$len"
  else
    tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c "$len"
  fi
}

init_vault() {
  mkdir -p "$VAULT_DIR"
  if [ ! -f "$VAULT_FILE" ]; then
    echo "$MARKER" > "$VAULT_FILE"
    echo "# Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$VAULT_FILE"
    echo "" >> "$VAULT_FILE"
    for entry in "${KEYS[@]}"; do
      key="${entry%%|*}"
      rest="${entry#*|}"
      len="${rest##*|}"
      echo "${key}=$(random_secret "$len")" >> "$VAULT_FILE"
    done
    echo "Vault created: $VAULT_FILE"
  else
    echo "Vault exists: $VAULT_FILE (use --rotate to change keys)"
  fi
  chmod 600 "$VAULT_FILE"
}

list_secrets() {
  if [ ! -f "$VAULT_FILE" ]; then
    echo "No vault file found. Run without flags to create one."
    exit 1
  fi
  echo "SOGo 6 Secrets (masked):"
  echo "------------------------"
  while IFS='=' read -r key val; do
    case "$key" in
      ''|\#*) continue ;;
    esac
    if [ ${#val} -gt 8 ]; then
      echo "  $key = ${val:0:4}...${val: -4} (${#val} chars)"
    else
      echo "  $key = (too short, ${#val} chars)"
    fi
  done < "$VAULT_FILE"
}

show_secrets() {
  if [ ! -f "$VAULT_FILE" ]; then
    echo "No vault file found."
    exit 1
  fi
  cat "$VAULT_FILE"
}

rotate_key() {
  local target_key="$1"
  if [ ! -f "$VAULT_FILE" ]; then
    echo "No vault file — run without flags first."
    exit 1
  fi
  local found=0
  for entry in "${KEYS[@]}"; do
    key="${entry%%|*}"
    if [ "$key" = "$target_key" ]; then
      found=1
      rest="${entry#*|}"
      len="${rest##*|}"
      new_val="$(random_secret "$len")"
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^${key}=.*|${key}=${new_val}|" "$VAULT_FILE"
      else
        sed -i "s|^${key}=.*|${key}=${new_val}|" "$VAULT_FILE"
      fi
      echo "Rotated: $target_key"
      break
    fi
  done
  if [ "$found" -eq 0 ]; then
    echo "Unknown key: $target_key"
    echo "Known keys:"
    for entry in "${KEYS[@]}"; do
      echo "  ${entry%%|*}"
    done
    exit 1
  fi
}

rotate_all() {
  for entry in "${KEYS[@]}"; do
    key="${entry%%|*}"
    rotate_key "$key"
  done
}

print_env_file() {
  if [ ! -f "$VAULT_FILE" ]; then
    echo "No vault file found."
    exit 1
  fi
  echo "# SOGo 6 env_file — source in docker-compose with 'env_file: ./secrets/sogo6.vault.env'"
  echo "# Generated from vault at $VAULT_FILE"
  echo ""
  grep -v '^#' "$VAULT_FILE" | grep -v '^$'
}

# ── CLI ──────────────────────────────────────────────────────────────────────
case "${1:-}" in
  --list|-l)
    list_secrets
    ;;
  --show|-s)
    show_secrets
    ;;
  --rotate|-r)
    if [ -z "${2:-}" ]; then
      echo "Usage: $0 --rotate <KEY_NAME>"
      echo "Known keys:"
      for entry in "${KEYS[@]}"; do
        echo "  ${entry%%|*}"
      done
      exit 1
    fi
    rotate_key "$2"
    ;;
  --rotate-all|-R)
    rotate_all
    ;;
  --env-file|-e)
    print_env_file
    ;;
  --help|-h)
    sed -n '2,12p' "$0"
    exit 0
    ;;
  *)
    init_vault
    ;;
esac
