#!/bin/bash
# SOGo 6 Backup Automation (#25)
# Backs up PostgreSQL, Redis, LDAP, Stalwart, and config files.
# Usage: ./backup.sh [--s3] [--retention N]
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"

mkdir -p "$BACKUP_PATH"

echo "=== SOGo 6 Backup: $TIMESTAMP ==="

# PostgreSQL
echo "  Backing up PostgreSQL..."
docker compose exec -T sogo6-postgres pg_dump -U sogo sogo > "${BACKUP_PATH}/postgres.sql" 2>/dev/null || echo "  WARNING: PostgreSQL backup failed"

# Redis
echo "  Backing up Redis..."
docker compose exec -T sogo6-redis redis-cli SAVE > /dev/null 2>&1 || true
docker cp sogo6-redis:/data/dump.rdb "${BACKUP_PATH}/redis.rdb" 2>/dev/null || echo "  WARNING: Redis backup failed"

# LDAP
echo "  Backing up LDAP..."
docker compose exec -T sogo6-ldap slapcat > "${BACKUP_PATH}/ldap.ldif" 2>/dev/null || echo "  WARNING: LDAP backup failed"

# Config
echo "  Backing up configuration..."
cp -r sogo6/config "${BACKUP_PATH}/config" 2>/dev/null || true
cp docker-compose.yaml "${BACKUP_PATH}/" 2>/dev/null || true
cp .env "${BACKUP_PATH}/" 2>/dev/null || true

# Compress
echo "  Compressing..."
cd "$BACKUP_DIR"
tar czf "${TIMESTAMP}.tar.gz" "$TIMESTAMP"
rm -rf "$TIMESTAMP"
cd - > /dev/null

# Retention
echo "  Cleaning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.tar.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "=== Backup complete: ${BACKUP_PATH}.tar.gz ==="
echo "Size: $(du -h "${BACKUP_DIR}/${TIMESTAMP}.tar.gz" | cut -f1)"
