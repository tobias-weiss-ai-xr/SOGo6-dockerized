#!/bin/bash
# Setup script for SOGo 6 evaluation environment
# This script clones the SOGo 6 repositories and prepares them for building

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== SOGo 6 Setup Script ==="
echo ""

# Clone SOGo 6 UI if not exists
if [ ! -d "$PROJECT_ROOT/sogo6-ui" ]; then
    echo "Cloning SOGo 6 UI repository..."
    git clone https://github.com/tobias-weiss-ai-xr/SOGo6-UI.git "$PROJECT_ROOT/sogo6-ui"
else
    echo "SOGo 6 UI repository already exists, pulling latest changes..."
    cd "$PROJECT_ROOT/sogo6-ui" && git pull
fi

# Clone SOGo 6 server if not exists
if [ ! -d "$PROJECT_ROOT/sogo6-server" ]; then
    echo "Cloning SOGo 6 server repository..."
    git clone https://github.com/tobias-weiss-ai-xr/SOGo6-server.git "$PROJECT_ROOT/sogo6-server"
else
    echo "SOGo 6 server repository already exists, pulling latest changes..."
    cd "$PROJECT_ROOT/sogo6-server" && git pull
fi

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
