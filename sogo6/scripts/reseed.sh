#!/usr/bin/env bash
# =============================================================================
# sogo6-reseed — re-apply server settings from the init JSON after .env changes
# =============================================================================
# The SOGo server seeds its DB from /etc/sogo/init/*.json ONLY on the first
# boot (empty settings tables). If you change .env AFTER the first boot
# (LDAP bind password, secrets, SMTP...), the running configuration keeps the
# old values and login starts returning 401/500 with no obvious cause.
#
# This script clears the settings + domain rows and restarts the server so the
# current environment is re-read and re-seeded. Run it whenever you change
# SOGO_LDAP_*, SOGO_P_VOUCHER_SECRET, SOGO_SECRET_KEY, SOGO_AES_ENC_KEY, etc.
#
# Usage:
#   ./sogo6/scripts/reseed.sh                 # preview (backup + confirm)
#   ./sogo6/scripts/reseed.sh --yes           # non-interactive
#
# Requires: docker + docker compose, the mariadb container of this stack.
# =============================================================================
set -euo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${1:-$STACK_DIR/docker-compose.yaml}"
DB_CONTAINER="${DB_CONTAINER:-sogo6-mariadb}"
DB_USER="${MARIADB_USER:-sogo}"
DB_PASS="${MARIADB_PASSWORD:-${MARIADB_PASSWORD_MISSING}}"
DB_NAME="${MARIADB_DATABASE:-sogo}"
# Table names follow process.conf SOGO_P_TABLE_* defaults. Override if changed.
TBL_SETTINGS="${SOGO_P_TABLE_SETTINGS:-sogo6_sogo_settings}"
TBL_DOMAINS="${SOGO_P_TABLE_DOMAINS:-sogo6_sogo_settings_domains}"

[ -n "$DB_PASS" ] || { echo "ERROR: MARIADB_PASSWORD not set (load .env first: set -a; . ./.env; set +a)"; exit 1; }

backup_tables() {
  local bak="$STACK_DIR/backups/sogo-settings-$(date +%Y%m%d-%H%M%S).sql"
  mkdir -p "$STACK_DIR/backups"
  docker exec "$DB_CONTAINER" sh -c \
    "mariadb-dump -u$DB_USER -p'$DB_PASS' $DB_NAME $TBL_SETTINGS $TBL_DOMAINS" > "$bak"
  echo "backup -> $bak"
}

if [ "${1:-}" != "--yes" ]; then
  echo "! This clears $TBL_SETTINGS and $TBL_DOMAINS and restarts sogo6-server."
  echo "! Settings will be re-seeded from the init JSON with the CURRENT .env values."
  read -r -p "Proceed? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || exit 0
fi

backup_tables

echo "clearing settings tables..."
docker exec "$DB_CONTAINER" sh -c "mariadb -u$DB_USER -p'$DB_PASS' $DB_NAME -e 'DELETE FROM $TBL_SETTINGS; DELETE FROM $TBL_DOMAINS;'"

echo "restarting sogo6-server so it re-seeds from /etc/sogo/init/*.json..."
docker compose -f "$COMPOSE_FILE" restart sogo6-server
sleep 15

echo "done. Verify: curl -s http://localhost:5001/api/user/v1/health"
