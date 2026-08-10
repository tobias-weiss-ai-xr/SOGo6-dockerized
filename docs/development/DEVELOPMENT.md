# SOGo 6 Development Guide

## Quick Start

### Start Dev Stack with All Tools

```bash
make dev-debug
```

This starts the full development environment with debugging tools, monitoring, and database admins.

### Start Only Core Services

```bash
make start-dev
```

## Development URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| UI | http://localhost:3000 | testuser@example.org / password123 |
| API | http://localhost:5001 | - |
| Nginx | http://localhost:80 / https://localhost:443 | - |
| PgAdmin | http://localhost:5050 | dev@example.org / password123 |
| Redis Insight | http://localhost:5540 | - |
| Mailhog | http://localhost:8025 | - |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3001 | admin / password123 |
| Maildev | http://localhost:1080 | - |

## Database Access

### PostgreSQL
```bash
# Direct connection
make dev-shell-postgres

# Or via PgAdmin: http://localhost:5050
# Connection: host=sogo6-postgres, database=sogo, user=sogo
```

### Redis
```bash
# CLI
make dev-shell-redis

# Or via Redis Insight: http://localhost:5540
```

### LDAP
```bash
# CLI
make dev-shell-ldap

# Or via LDAP Admin: http://localhost:8081
```

## Debugging

### Server Debugging

The Flask server runs with `FLASK_DEBUG=1` and `GUNICORN_WORKERS=1`.

```bash
# Shell into server
make dev-shell-server

# View logs
make dev-logs

# Debug port exposed on 5678 for VS Code/PyCharm
```

### UI Debugging

React dev server runs with hot reload enabled.

```bash
# Shell into UI
make dev-shell-ui

# View logs
docker compose -f docker-compose.dev.yaml logs sogo6-ui -f
```

## Testing

### Run All Tests
```bash
make test-dev
```

### Watch Mode Tests
```bash
make test-watch
```

### Individual Test Suites
```bash
# API tests
docker compose -f docker-compose.dev.yaml exec sogo6-server bash tests/api-test.sh

# SMTP tests
docker compose -f docker-compose.dev.yaml exec sogo6-stalwart bash tests/smtp-test.sh

# LDAP tests
docker compose -f docker-compose.dev.yaml exec sogo6-ldap bash tests/ldap-test.sh
```

## Monitoring

### Start Monitoring Stack
```bash
make dev-monitoring
```

### Prometheus Metrics
- Server: http://localhost:9090
- Target: sogo6-server:5000/metrics

### Grafana Dashboards
- URL: http://localhost:3001
- Add Prometheus as data source: http://sogo6-prometheus:9090

## LDAP Tools

```bash
# Start all LDAP admin tools
make dev-ldap-tools

# Available tools:
# - LDAP Admin: http://localhost:8081
# - LDAP UI: http://localhost:8082  
# - Ladon: http://localhost:8083
# - phpLDAPadmin: http://localhost:8084
```

## Mail Tools

```bash
# Start Mailhog for email testing
make dev-mail-tools

# Mailhog Web UI: http://localhost:8025
# SMTP port: 1026
```

## Hot Reload

The dev stack supports hot reload:

- **UI**: Changes in `sogo6-ui/` automatically reload
- **Server**: Changes in `sogo6-server/` trigger reload (Flask debug mode)

## Volume Management

### Clean Dev Data
```bash
make dev-clean
```

This removes all dev containers and volumes.

### Reset Everything
```bash
make dev-reset
```

This cleans and reinitializes the dev stack.

## Docker Compose Profiles

Use profiles to start specific tool sets:

```bash
# Monitoring only
docker compose -f docker-compose.dev.yaml --profile monitoring up -d

# LDAP tools only
docker compose -f docker-compose.dev.yaml --profile ldap-tools up -d

# Mail tools only
docker compose -f docker-compose.dev.yaml --profile mail-tools up -d
```

## Environment Variables

Copy `.env.development` to `.env.development.local` for local overrides:

```bash
cp .env.development .env.development.local
```

Key dev settings:
- `FLASK_DEBUG=1` - Enable Flask debugger
- `NODE_ENV=development` - Enable React dev mode
- `LOG_LEVEL=debug` - Verbose logging
- `PYTHONUNBUFFERED=1` - Real-time Python logs

## VS Code Dev Containers

Open the project in VS Code with Dev Containers extension for:
- Pre-configured Python/Node environments
- Docker integration
- Debug configurations
- Linting and formatting

## Performance Tuning

Dev stack uses higher resource limits:
- Server: 768MB RAM, 2 CPUs
- UI: 512MB RAM, 2 CPUs
- PostgreSQL: 512MB RAM with query logging
- Redis: 256MB RAM with AOF persistence

## Troubleshooting

### Container won't start
```bash
make dev-logs
docker compose -f docker-compose.dev.yaml ps
```

### Database connection issues
```bash
make dev-shell-postgres
# Check if PostgreSQL is running and accepting connections
```

### LDAP issues
```bash
make dev-shell-ldap
# Test LDAP connection directly
```

### Port conflicts
```bash
# Check which ports are in use
lsof -i :5001
lsof -i :3000
```

## Production vs Development

| Feature | Production | Development |
|---------|-----------|-------------|
| Logging | Info level | Debug level |
| Workers | Multiple | Single |
| Hot Reload | Disabled | Enabled |
| Database Query Logging | Off | On |
| Dev Tools | None | Full stack |
| Memory Limits | Lower | Higher |
| Exposed Ports | Minimal | All services |
