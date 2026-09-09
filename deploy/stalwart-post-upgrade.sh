#!/usr/bin/env bash
# One-time fixes for the stalwart-rewrite (0.16.21) registry migration.
#
# Migrating a 0.16.18 data dir to the rewrite drops two registry objects that
# LDAP auth depends on, and mangles the login filter placeholder:
#   1. the Authentication singleton (default auth directory) is gone
#   2. the login Domain object (e.g. example.org) is gone  → "Domain not found"
#   3. filterLogin placeholders {username} become literal "?"               → bind never matches
# This script repairs all three via the JMAP registry API. Idempotent — safe
# to re-run. Requires: container running, STALWART_RECOVERY_ADMIN creds.
#
# Usage: [STALWART_DOMAIN=example.org] ./deploy/stalwart-post-upgrade.sh
set -euo pipefail

DOMAIN="${STALWART_DOMAIN:-example.org}"
ADMIN="${STALWART_RECOVERY_ADMIN:-admin:eval_admin_2026}"
CTR="${STALWART_CONTAINER:-sogo6-stalwart}"

jmap() { # JMAP request via the container's local HTTPS endpoint
  docker exec "$CTR" curl -sk -u "$ADMIN" -H 'Content-Type: application/json' \
    -d "$1" https://127.0.0.1:443/jmap
}

# 1. Default auth directory: point the Authentication singleton at the LDAP dir
DIR_ID=$(jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Directory/get\",{\"accountId\":\"0\",\"ids\":null},\"c1\"]]}" \
  | grep -o '"id":"[a-z0-9]*"' | head -1 | cut -d'"' -f4)
[ -n "$DIR_ID" ] || { echo "FATAL: no directory object in registry"; exit 1; }
echo "Directory: $DIR_ID"
jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Authentication/set\",{\"accountId\":\"0\",\"update\":{\"singleton\":{\"directoryId\":\"$DIR_ID\"}}},\"c1\"]]}" >/dev/null
echo "Authentication singleton -> $DIR_ID"

# 2. Login domain object (silently tolerated if it already exists)
jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Domain/set\",{\"accountId\":\"0\",\"create\":{\"d\":{\"name\":\"$DOMAIN\"}}},\"c1\"]]}" >/dev/null
echo "Domain ensured: $DOMAIN"

# 3. Repair the login filter placeholder if the migration mangled it
jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Directory/set\",{\"accountId\":\"0\",\"update\":{\"$DIR_ID\":{\"filterLogin\":\"(|(uid={username})(mail={username}))\"}}},\"c1\"]]}" >/dev/null
echo "filterLogin restored"

echo "Restarting $CTR ..."
docker restart "$CTR" >/dev/null
sleep 10
docker inspect "$CTR" --format 'Health: {{.State.Health.Status}}'
echo "Verify: (printf 'a LOGIN user@%s pw\r\nb LIST \"\" \"*\"\r\n' \"$DOMAIN\") | openssl s_client -connect 127.0.0.1:20993 -quiet" # IMAPS port per compose
