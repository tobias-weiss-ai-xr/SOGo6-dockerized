#!/bin/bash
# Backup script for SOGo 6 evaluation data volumes
# Usage: bash sogo6/scripts/backup.sh [output-dir]
# Default output: ./backups/sogo6-<date>/

set -euo pipefail

BACKUP_DIR="${1:-$(dirname "$0")/../../backups/sogo6-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$BACKUP_DIR"

echo "=== SOGo 6 Backup ==="
echo "Output: $BACKUP_DIR"
echo ""

# 1. PostgreSQL dump
echo "[1/4] Dumping PostgreSQL ..."
docker exec sogo6-postgres pg_dump -U sogo sogo6 > "$BACKUP_DIR/postgres.sql" 2>/dev/null || {
  echo "  WARN: PostgreSQL dump failed (may need sudo)"
  sudo docker exec sogo6-postgres pg_dump -U sogo sogo6 > "$BACKUP_DIR/postgres.sql" 2>&1
}
wc -c "$BACKUP_DIR/postgres.sql" | awk '{print "  Size: "$1" bytes"}'

# 2. LDAP data dump
echo "[2/4] Dumping LDAP ..."
docker exec sogo6-ldap ldapsearch -x -H ldap://localhost:389 \
  -D "cn=admin,dc=example,dc=org" -w admin \
  -b "dc=example,dc=org" \
  > "$BACKUP_DIR/ldap.ldif" 2>&1
wc -c "$BACKUP_DIR/ldap.ldif" | awk '{print "  Size: "$1" bytes"}'

# 3. Redis dump
echo "[3/4] Dumping Redis ..."
docker exec sogo6-redis redis-cli SAVE > /dev/null 2>&1 && \
docker cp sogo6-redis:/data/dump.rdb "$BACKUP_DIR/redis.rdb" 2>&1
ls -la "$BACKUP_DIR/redis.rdb" 2>/dev/null | awk '{print "  Size: "$5" bytes"}' || echo "  WARN: Redis dump failed"

# 4. Docker compose config backup
echo "[4/4] Backing up compose configs ..."
cp "$(dirname "$0")/../../docker-compose.yaml" "$BACKUP_DIR/" 2>/dev/null || true

echo ""
echo "=== Backup complete: $BACKUP_DIR ==="
echo "Contents:"
ls -lh "$BACKUP_DIR/"
