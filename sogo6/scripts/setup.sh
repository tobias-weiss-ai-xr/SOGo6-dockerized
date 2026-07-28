#!/bin/bash
# Setup script for SOGo 6 evaluation environment
# This script initializes git submodules and prepares everything for building

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== SOGo 6 Setup Script ==="
echo ""

# Initialize and update git submodules (SOGo6-UI and SOGo6-server)
echo "Initializing git submodules..."
cd "$PROJECT_ROOT"
git submodule update --init --recursive
cd "$PROJECT_ROOT/sogo6-ui"
git checkout dev 2>/dev/null || true
git pull origin dev 2>/dev/null || true
cd "$PROJECT_ROOT/sogo6-server"
git checkout dev 2>/dev/null || true
git pull origin dev 2>/dev/null || true
cd "$PROJECT_ROOT"

echo ""

# Generate secrets vault if missing
bash "$SCRIPT_DIR/manage-secrets.sh" 2>/dev/null || true

# Generate self-signed TLS certificates if missing
bash "$SCRIPT_DIR/gen-certs.sh" 2>/dev/null || true

echo ""
echo "=== Building SOGo 6 Docker Images ==="
echo ""

# Build SOGo 6 UI image
echo "Building SOGo 6 UI Docker image..."
cd "$PROJECT_ROOT/sogo6-ui"
docker build -t sogo6-ui:latest .

# Build SOGo 6 server image
echo "Building SOGo 6 server Docker image..."
cd "$PROJECT_ROOT/sogo6-server"
docker build -t sogo6-server:latest -f deploy/local/Dockerfile.local .

# Build LDAP image
echo "Building SOGo 6 LDAP Docker image..."
cd "$PROJECT_ROOT/sogo6/ldap"
docker build -t sogo6-ldap:latest .

echo ""
echo "=== Setup Complete ==="
echo ""
echo "You can now start SOGo 6 with:"
echo "  docker compose up -d"
echo ""
echo "Then initialize the system:"
echo "  bash sogo6/scripts/init-sogo6.sh"
echo ""
echo "Access points:"
echo "  SOGo 6 UI:     http://localhost:3000"
echo "  SOGo 6 API:    http://localhost:5000"
echo "  Maildev UI:    http://localhost:1080"
echo ""
