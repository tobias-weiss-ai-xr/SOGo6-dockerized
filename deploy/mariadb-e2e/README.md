# MariaDB E2E Test Deployment - vhrz2392

End-to-end testing of the MariaDB adapter on MariaDB E2E Test.

## Quick Start

```bash
# 1. Copy files to vhrz2392
scp -r deploy/mariadb-e2e root@vhrz2392:/opt/

# 2. SSH to vhrz2392
ssh root@vhrz2392

# 3. Navigate to deployment directory
cd /opt/mariadb-e2e

# 4. Review and customize .env if needed
nano .env

# 5. Start the stack
docker compose up -d

# 6. Wait for services to be healthy (~60s)
docker compose ps

# 7. Run E2E tests
chmod +x run-e2e-tests.sh
./run-e2e-tests.sh
```

## Host Configuration

The E2E test script supports multiple hosts via environment variables or command line:

### Environment Variables (from `.env`)

```bash
E2E_API_HOST=localhost    # API host for tests
E2E_UI_HOST=localhost     # UI host for tests
API_PORT=5001             # API port
UI_PORT=3000              # UI port
```

### Command Line Options

```bash
# Test against MariaDB E2E Test
./run-e2e-tests.sh --host vhrz2392

# Test API and UI on different hosts
./run-e2e-tests.sh --api-host api.example.com --ui-host ui.example.com

# Test with custom port
./run-e2e-tests.sh --api-host localhost --api-port 8080

# Show help
./run-e2e-tests.sh --help
```

### Example Usage

```bash
# Local testing (default)
./run-e2e-tests.sh

# Remote server testing
E2E_API_HOST=vhrz2392 ./run-e2e-tests.sh

# Production testing
./run-e2e-tests.sh --api-host api.production.com --ui-host app.production.com
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  vhrz2392 Server                                            │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  UI      │  │ Server   │  │ MariaDB  │  │  Redis   │   │
│  │ :3000    │  │ :5001    │  │ :3306    │  │  :6379   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       └─────────────┴─────────────┴─────────────┘          │
│                        mariadb-e2e-net                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  OpenLDAP (internal only)                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| UI | 3000 | Next.js frontend |
| Server | 5001 | Flask API (MariaDB adapter) |
| MariaDB | 3306 | Database |
| Redis | 6379 | Cache/session store |
| LDAP | 389 | Directory (internal only) |

## Test Coverage

1. **Health Check** - API availability
2. **System Info** - Application metadata
3. **Database Connection** - MariaDB connectivity
4. **User Registration** - CRUD operations
5. **LDAP User Sync** - Directory integration
6. **Calendar API** - Feature functionality
7. **Connection Pool** - Pool management
8. **Character Set** - UTF8MB4 support
9. **MariaDB Version** - Version verification
10. **Performance** - 100 request benchmark

## Expected Results

```
============================================================
  Test Summary
============================================================
  Passed: 15
  Failed: 0
============================================================
✓ All tests passed!
```

## Troubleshooting

### Services not starting
```bash
docker compose logs -f mariadb
docker compose logs -f server
```

### Database connection errors
```bash
# Check MariaDB is healthy
docker compose ps

# Test connection manually
docker exec mariadb-e2e-mariadb mysql -usogo -pS0g0_P@ssw0rd_2024! -e "SHOW DATABASES;"
```

### API errors
```bash
# Check API logs
docker compose logs -f server

# Test API directly
curl http://localhost:5001/api/user/v1/health
```

## Cleanup

```bash
# Stop and remove all containers
docker compose down -v

# Remove volumes (WARNING: deletes all data)
docker volume rm mariadb-e2e_mariadb-data
```

## Environment Variables

See `.env` file for all configurable options:
- `MARIADB_*` - Database credentials
- `LDAP_*` - Directory credentials  
- `API_PORT` - API port (default: 5001)
- `SOGO_LOG_LEVEL` - Logging verbosity

## Next Steps

After successful E2E tests:
1. Review test output for any warnings
2. Check MariaDB performance metrics
3. Monitor connection pool usage
4. Consider production hardening (TLS, backups)
