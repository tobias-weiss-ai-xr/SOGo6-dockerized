#!/bin/bash
# Deployment script for mariadb-e2e MariaDB E2E test
# Run this on mariadb-e2e server

set -euo pipefail

echo "============================================================"
echo "  mariadb-e2e MariaDB E2E Deployment Script"
echo "============================================================"

# Check prerequisites
echo ""
echo "Checking prerequisites..."

if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker not installed"
    exit 1
fi

if ! command -v docker compose &>/dev/null; then
    echo "ERROR: Docker Compose not installed"
    exit 1
fi

echo "✓ Docker: $(docker --version | head -1)"
echo "✓ Docker Compose: $(docker compose version --short)"

# Start services
echo ""
echo "Starting services..."
docker compose up -d --wait --wait-timeout 120

# Show status
echo ""
echo "Service status:"
docker compose ps

# Show logs (last 20 lines)
echo ""
echo "Recent logs:"
docker compose logs --tail=20

echo ""
echo "============================================================"
echo "  Deployment complete!"
echo "============================================================"
echo ""
echo "Next steps:"
echo "  1. Wait for services to be healthy (check with 'docker compose ps')"
echo "  2. Run E2E tests: ./run-e2e-tests.sh"
echo ""
echo "Access points:"
echo "  API:  http://localhost:5001"
echo "  UI:   http://localhost:3000"
echo "  MariaDB: localhost:3306"
echo ""
