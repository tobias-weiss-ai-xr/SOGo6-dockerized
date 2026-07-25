#!/bin/bash
# Verify dev environment setup

set -e

echo "🔍 Checking SOGo 6 Development Environment Setup"
echo "================================================"
echo ""

ERRORS=0

# Check if docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Docker is running"
fi

# Check if docker compose is available
if ! docker compose version >/dev/null 2>&1; then
    echo "❌ Docker Compose is not available"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Docker Compose is available"
fi

# Check if make is available
if ! make --version >/dev/null 2>&1; then
    echo "❌ Make is not available"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Make is available"
fi

# Check for dev compose file
if [ ! -f "docker-compose.dev.yaml" ]; then
    echo "❌ docker-compose.dev.yaml not found"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ docker-compose.dev.yaml exists"
fi

# Check for Makefile
if [ ! -f "Makefile" ]; then
    echo "❌ Makefile not found"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Makefile exists"
fi

# Check sogo6-ui and sogo6-server directories
if [ ! -d "sogo6-ui" ]; then
    echo "⚠️  sogo6-ui directory not found (run: make setup)"
fi

if [ ! -d "sogo6-server" ]; then
    echo "⚠️  sogo6-server directory not found (run: make setup)"
fi

# Check for sogo6 directories
if [ ! -d "sogo6" ]; then
    echo "❌ sogo6 directory not found"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ sogo6 directory exists"
fi

# Check if secrets directory exists with files
if [ -d "secrets" ]; then
    if [ -f "secrets/sogo6.vault.env" ]; then
        echo "✅ Secrets file exists"
    else
        echo "⚠️  Secrets directory exists but sogo6.vault.env not found"
    fi
else
    echo "⚠️  Secrets directory not found (create with: make secrets)"
fi

# Check documentation
if [ ! -f "DEVELOPMENT.md" ]; then
    echo "⚠️  DEVELOPMENT.md not found"
fi

if [ ! -f "docs/DEBUGGING.md" ]; then
    echo "⚠️  docs/DEBUGGING.md not found"
fi

if [ ! -f "docs/TESTING.md" ]; then
    echo "⚠️  docs/TESTING.md not found"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ All critical checks passed!"
    echo ""
    echo "To start the dev environment:"
    echo "  make dev-debug"
    echo ""
    echo "Or for specific services:"
    echo "  make build-dev && make start-dev"
else
    echo "❌ $ERRORS critical error(s) found"
    echo "Please fix the issues above before continuing"
    exit 1
fi
