#!/bin/bash
# SOGo 6 Development Stack Quick Start Script

set -e

echo "🚀 SOGo 6 Development Environment"
echo "=================================="
echo ""

# Check if docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker compose is available
if ! docker compose version >/dev/null 2>&1; then
    echo "❌ Docker Compose is not available."
    exit 1
fi

echo "📋 Checking prerequisites..."
echo ""

# Build images
echo "🔨 Building development images..."
docker compose -f docker-compose.dev.yaml build --parallel

echo ""
echo "🚀 Starting development stack..."
echo ""

# Start with all profiles
docker compose -f docker-compose.dev.yaml up -d --wait --wait-timeout 180

echo ""
echo "✅ Development stack is ready!"
echo ""
echo "📊 Services:"
echo ""
docker compose -f docker-compose.dev.yaml ps
echo ""
echo "🌐 Access URLs:"
echo ""
echo "  🖥️  UI:              http://localhost:3000"
echo "  🔌 API Server:      http://localhost:5001"
echo "  🗄️  PgAdmin:         http://localhost:5050 (dev@example.org / password123)"
echo "  🔴 Redis Insight:   http://localhost:5540"
echo "  📧 Mailhog:         http://localhost:8025"
echo "  📈 Prometheus:      http://localhost:9090"
echo "  📊 Grafana:         http://localhost:3001 (admin / password123)"
echo "  🌐 Nginx:           http://localhost:80 / https://localhost:443"
echo "  📮 Maildev:         http://localhost:1080"
echo ""
echo "🔧 Database Ports:"
echo ""
echo "  🐘 PostgreSQL:      localhost:5432"
echo "  🔴 Redis:           localhost:6379"
echo "  📇 LDAP:            localhost:389"
echo "  📧 SMTP (Maildev):  localhost:1025 / Web: localhost:1080"
echo "  📧 SMTP (Stalwart): localhost:20025"
echo ""
echo "🛠️  Useful Commands:"
echo ""
echo "  make dev-logs           - View all logs"
echo "  make dev-shell-server   - Shell into server container"
echo "  make dev-shell-ui       - Shell into UI container"
echo "  make dev-shell-postgres - Access PostgreSQL CLI"
echo "  make test-dev           - Run integration tests"
echo "  make dev-clean           - Clean all dev data"
echo ""
echo "📖 Documentation: See DEVELOPMENT.md"
echo ""
