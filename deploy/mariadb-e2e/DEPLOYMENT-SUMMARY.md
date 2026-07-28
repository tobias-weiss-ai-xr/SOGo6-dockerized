# vhrz2392 MariaDB E2E Test Deployment

## Deployment Package Created

**Location:** `deploy/mariadb-e2e/`

### Files Included

| File | Purpose | Size |
|------|---------|------|
| `.env` | Environment configuration | 1.6 KB |
| `docker-compose.yaml` | Service definitions | 3.9 KB |
| `deploy.sh` | One-command deployment | 1.4 KB |
| `run-e2e-tests.sh` | Automated test suite | 7.8 KB |
| `README.md` | Documentation | 4.4 KB |

## Quick Deploy to vhrz2392

### Option 1: SCP + SSH

```bash
# From your local machine
cd deploy/mariadb-e2e
scp * root@vhrz2392:/opt/mariadb-e2e/

# SSH to vhrz2392
ssh root@vhrz2392
cd /opt/mariadb-e2e

# Deploy
./deploy.sh

# Run tests (local)
./run-e2e-tests.sh

# Run tests (remote server)
./run-e2e-tests.sh --host vhrz2392
```

### Option 2: Git Clone

If vhrz2392 has git access:

```bash
# On vhrz2392
cd /opt
git clone <your-repo-url>
cd <repo>/deploy/mariadb-e2e
./deploy.sh
./run-e2e-tests.sh
```

### Option 3: tar + scp

```bash
# From your local machine
cd deploy
tar czf mariadb-e2e.tar.gz mariadb-e2e/

# Transfer
scp mariadb-e2e.tar.gz root@vhrz2392:/opt/

# On vhrz2392
ssh root@vhrz2392
cd /opt
tar xzf mariadb-e2e.tar.gz
cd mariadb-e2e
./deploy.sh
./run-e2e-tests.sh
```

## Test Suite Overview

### 10 Test Categories

1. **Health Check** - API availability
2. **System Info** - Metadata endpoint
3. **Database Connection** - MariaDB connectivity
4. **User Registration** - CRUD operations
5. **LDAP User Sync** - Directory integration
6. **Calendar API** - Feature functionality
7. **Connection Pool** - Pool management (5 concurrent)
8. **Character Set** - UTF8MB4 verification
9. **MariaDB Version** - Version check
10. **Performance** - 100 request benchmark

### Expected Output

```
============================================================
  MariaDB E2E Test Suite - vhrz2392
  2024-07-28 09:30:00 UTC
============================================================

[INFO] Waiting for SOGo API...
[INFO] SOGo API is ready after 45s

▶ Health Check
  ✓ PASS (HTTP 200)

▶ System Info
  ✓ PASS (HTTP 200)

▶ Database Connection Test
  ✓ Database connection OK

▶ User Registration
  ✓ User registered: testuser1722156600@vhrz2392.test.local

... (more tests)

============================================================
  Test Summary
============================================================
  Passed: 15
  Failed: 0
============================================================
✓ All tests passed!
```

## MariaDB-Specific Tests

### Character Set Verification

```bash
# Manual check
docker exec mariadb-e2e-mariadb mysql -usogo -p \
  -e "SHOW VARIABLES LIKE 'character_set%';"
```

Expected:
```
character_set_server    utf8mb4
character_set_database  utf8mb4
character_set_client    utf8mb4
```

### Connection Pool Test

Tests 5 sequential connections to verify pool management:
```
  ✓ Connection 1: OK
  ✓ Connection 2: OK
  ✓ Connection 3: OK
  ✓ Connection 4: OK
  ✓ Connection 5: OK
```

### Performance Benchmark

- 100 requests to `/api/user/v1/health`
- Target: <500ms average response time
- Measures connection pool efficiency

## Troubleshooting

### Common Issues

**Issue:** MariaDB fails to start
```bash
docker compose logs mariadb
# Look for: permission errors, disk space, port conflicts
```

**Issue:** API can't connect to database
```bash
docker compose logs server
# Check: SOGO_DB_URI, credentials, network
```

**Issue:** LDAP sync fails
```bash
docker compose logs ldap
# Check: LDAP_ADMIN_PASSWORD, base DN
```

### Debug Commands

```bash
# Check all services
docker compose ps

# View logs
docker compose logs -f

# Test database connection
docker exec mariadb-e2e-mariadb mysql -usogo -pS0g0_P@ssw0rd_2024! -e "SHOW DATABASES;"

# Test API
curl http://localhost:5001/api/user/v1/health

# Check network
docker network inspect mariadb-e2e_mariadb-e2e-net
```

## Cleanup

```bash
# Stop services
docker compose down

# Remove all data (volumes)
docker compose down -v

# Remove images
docker compose down --rmi all

# Complete cleanup
docker compose down -v --rmi all --remove-orphans
```

## Reporting Results

After running tests, please share:

1. **Test output** (full `run-e2e-tests.sh` output)
2. **Service status** (`docker compose ps`)
3. **Any errors** from logs
4. **Performance metrics** (avg response time)

## Security Notes

⚠️ **This is a test deployment with default passwords**

For production:
- Change all passwords in `.env`
- Enable TLS/SSL
- Restrict network access
- Set up backups
- Monitor logs

## Next Steps After Testing

If tests pass:
1. ✅ MariaDB adapter confirmed working
2. ✅ Document any issues found
3. ✅ Create GitHub issue for improvements
4. ✅ Consider production deployment

If tests fail:
1. 📝 Document exact error messages
2. 📝 Check MariaDB logs
3. 📝 Create GitHub issue with details
4. 📝 Include `docker compose logs` output
