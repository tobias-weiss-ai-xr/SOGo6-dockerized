#!/bin/bash
# Backup all Docker volumes
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTDIR="${1:-$PROJECT_DIR/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DOCKER_CMD="docker"
if command -v sudo &>/dev/null; then
    DOCKER_CMD="sudo docker"
fi

mkdir -p "$OUTDIR"

echo "=== Backup started: $(date) ==="
echo "Output directory: $OUTDIR"

backup_volume() {
    local volume=$1 name=$2
    echo "Backing up $name ($volume)..."
    if $DOCKER_CMD volume inspect "$volume" &>/dev/null; then
        $DOCKER_CMD run --rm \
            -v "$volume":/source:ro \
            -v "$OUTDIR":/backup \
            alpine tar czf "/backup/${name}-${TIMESTAMP}.tar.gz" -C /source . 2>/dev/null
        echo "  -> ${name}-${TIMESTAMP}.tar.gz"
    else
        echo "  Volume $volume not found, skipping"
    fi
}

echo ""
echo "[1/3] Backup PostgreSQL data"
if $DOCKER_CMD ps --format '{{.Names}}' 2>/dev/null | grep -q sogo6-postgres; then
    $DOCKER_CMD exec sogo6-postgres pg_dumpall -U sogo > "$OUTDIR/sogo6-postgresql-${TIMESTAMP}.sql" 2>/dev/null
    echo "  -> sogo6-postgresql-${TIMESTAMP}.sql ($(wc -c < "$OUTDIR/sogo6-postgresql-${TIMESTAMP}.sql") bytes)"
fi

echo ""
echo "[2/3] Export Docker volumes"
backup_volume "sogo6-stalwart-data" "stalwart-data"
backup_volume "sogo6-redis-data" "redis-data"

echo ""
echo "[3/3] Backup Docker compose config"
cp "$PROJECT_DIR/docker-compose.yaml" "$OUTDIR/docker-compose-${TIMESTAMP}.yaml"
echo "  -> docker-compose-${TIMESTAMP}.yaml"

echo ""
du -sh "$OUTDIR"/*-"${TIMESTAMP}".*
echo ""
echo "=== Backup complete: $(date) ==="
echo "Total size: $(du -sh "$OUTDIR" | cut -f1)"
