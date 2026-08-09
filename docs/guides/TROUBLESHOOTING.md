# Troubleshooting Guide

## Common Issues and Solutions

---

## Issue: sogo6-stalwart Container Fails to Start

### Symptoms
```
✘ Container sogo6-stalwart                                      Error dependency sogo6-stalwart failed to start
sogo6-stalwart  | ⚠️ Startup failed: Failed to create tables: PostgreSQL error (store.postgresql-error)
sogo6-postgres  | FATAL:  database "stalwart" does not exist
```

### Root Cause
Stalwart mail server is trying to connect to a PostgreSQL database named "stalwart", but only the "sogo" database was created.

### Solution
The fix has been applied in commit `623d0df`. PostgreSQL now creates both databases:

```yaml
POSTGRES_DB: ${PG_DATABASE:-sogo},stalwart
```

### How to Apply Fix

1. **Pull latest changes:**
   ```bash
   git pull origin dev
   ```

2. **Stop existing containers:**
   ```bash
   docker compose --profile mail-stalwart --profile db-postgres --profile auth-ldap down
   ```

3. **Remove old volumes (if starting fresh):**
   ```bash
   docker volume rm sogo6-stalwart-openldap-dockerized_sogo6-postgres-data
   ```

4. **Start fresh:**
   ```bash
   docker compose --profile mail-stalwart --profile db-postgres --profile auth-ldap up -d
   ```

### Verification
```bash
# Check if all containers are healthy
docker compose ps

# Check stalwart logs
docker compose logs -f sogo6-stalwart

# Should see: "Stalwart JMAP server started"
```

---

## Issue: PostgreSQL Connection Refused

### Symptoms
```
FATAL: connection refused
```

### Solution
1. Ensure PostgreSQL container is healthy:
   ```bash
   docker compose ps sogo6-postgres
   ```

2. Check if PostgreSQL is ready:
   ```bash
   docker compose logs sogo6-postgres | grep "database system is ready"
   ```

3. Wait for initialization to complete (can take 30-60 seconds on first start)

---

## Issue: LDAP Authentication Fails

### Symptoms
```
LDAP bind failed
Invalid credentials
```

### Solution
1. Check LDAP container health:
   ```bash
   docker compose logs sogo6-ldap | grep "LDAP initialization complete"
   ```

2. Verify test user exists:
   ```bash
   docker compose exec sogo6-ldap ldapsearch -x -b "dc=example,dc=org" "(uid=testuser@example.org)"
   ```

3. Default test credentials (from `.env`):
   - Email: `testuser@example.org`
   - Password: Check `LDAP_ADMIN_PASSWORD` in `.env`

---

## Issue: UI Not Loading

### Symptoms
- Browser shows blank page
- API calls fail

### Solution
1. Check UI container:
   ```bash
   docker compose logs sogo6-ui | tail -50
   ```

2. Verify API server is healthy:
   ```bash
   curl http://localhost:5001/api/user/v1/health
   ```

3. Check if UI is accessible:
   ```bash
   curl http://localhost:3000
   ```

---

## Issue: Docker Compose Profile Not Working

### Symptoms
```
WARN[0000] The "mail-stalwart" profile is not defined
```

### Solution
Use correct profile names:
```bash
# Correct syntax
docker compose --profile mail-stalwart --profile db-postgres --profile auth-ldap up -d

# Or use the Makefile
make up
```

---

## Issue: Admin Config API Returns HTML Error Page

### Symptoms
```
HTTP 500 Internal Server Error
ValueError: dictionary update sequence element #0 has length 1; 2 is required
```

### Root Cause
MariaDB stores JSON columns as `LONGTEXT` (string), while PostgreSQL stores them as `JSONB` (native dict). When marshmallow tried to serialize database results, it received strings from MariaDB but expected dicts, causing `TypeError: string indices must be integers` or marshmallow serialization errors.

### Solution
Fixed in commit `5888e9b` and `3f32e7e`. The code now normalizes JSON column values:

1. **`sogo6-server/app/module/admin/ModuleAdminConfig.py`**:
   - Added `json.loads()` in `_get_setting_from_table_settings()` for SELECT queries
   - Added `json.loads()` in `_update_setting_in_table_settings()` for UPDATE/INSERT queries

2. **`sogo6/config/init/domain_settings.json`**:
   - Fixed `US_TYPE`: `"sql"` → `"mysql"` (valid: ldap, postgresql, mysql)
   - Added required fields: `US_CAN_AUTH`, `US_MAIL`, `US_IS_ADDRESSBOOK`, `US_HAS_RESOURCE`

### Verification
```bash
# Test both databases work correctly
curl -s http://localhost:5001/api/admin/v1/config/system \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Should return valid JSON on both MariaDB and PostgreSQL
```

### Notes
- POST/PATCH endpoints still have schema validation issues (separate bug)
- GET endpoints for `/config/system` and `/config/domain-default` are fully fixed

---

## Quick Diagnostic Commands

### Check all container statuses
```bash
docker compose ps -a
```

### View all logs
```bash
docker compose logs --tail=100
```

### Check resource usage
```bash
docker stats sogo6-*
```

### Verify network connectivity
```bash
docker compose exec sogo6-server ping sogo6-postgres
docker compose exec sogo6-server ping sogo6-ldap
docker compose exec sogo6-server ping sogo6-stalwart
```

### Database connectivity test
```bash
docker compose exec sogo6-postgres psql -U sogo -c "\l"
```

Should show:
```
sogo
stalwart
postgres
template0
template1
```

---

## Environment Variable Issues

### Check current environment
```bash
docker compose config | grep -E "POSTGRES_|STALWART_"
```

### Common environment problems

1. **Empty passwords** - Set strong passwords in `.env`:
   ```bash
   PG_PASSWORD=strong_password_here
   STALWART_SECRET=strong_secret_here
   ```

2. **Wrong DB_TYPE** - Should match your database:
   ```bash
   DB_TYPE=postgres  # or DB_TYPE=mariadb
   ```

3. **Missing profiles** - Always specify profiles:
   ```bash
   docker compose --profile mail-stalwart --profile db-postgres --profile auth-ldap up -d
   ```

---

## Performance Issues

### High memory usage
```bash
# Check memory limits
docker compose config | grep memory

# Adjust in docker-compose.yaml if needed
```

### Slow startup
- First startup can take 2-3 minutes for database initialization
- LDAP seed data loading adds 30-60 seconds
- Wait for all health checks to pass

---

## Production Deployment

### Security Checklist
- [ ] Change all default passwords in `.env`
- [ ] Set strong `SCIM_BEARER_TOKEN`
- [ ] Set strong `INTERCOM_SHARED_SECRET`
- [ ] Enable SSL/TLS for mail connections
- [ ] Configure firewall rules
- [ ] Set up backup strategy for volumes
- [ ] Enable logging and monitoring

### Production Environment Variables
```bash
# Required for production
PG_PASSWORD=<strong_password>
STALWART_SECRET=<strong_secret>
SCIM_BEARER_TOKEN=<32_char_random_string>
INTERCOM_SHARED_SECRET=<random_string>

# Enable SSL
STALWART_TLS_ENABLED=true
```

---

## Getting Help

### Logs to collect
```bash
# All container logs
docker compose logs > all-logs.txt

# Specific service
docker compose logs sogo6-stalwart > stalwart-logs.txt
docker compose logs sogo6-postgres > postgres-logs.txt
docker compose logs sogo6-ldap > ldap-logs.txt
```

### System information
```bash
# Docker version
docker --version
docker compose version

# System info
uname -a
df -h
```

---

## Related Documentation
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development setup
- [README.md](./README.md) - Project overview
- [docker-compose.yaml](./docker-compose.yaml) - Service configuration
