# Database Switch Guide: PostgreSQL ↔ MariaDB

SOGo6 supports both **PostgreSQL** and **MariaDB** (MySQL) as database backends. This guide explains how to switch between them.

## Quick Start

### Using MariaDB (Default)
```bash
# Start with MariaDB
docker compose --profile mail-stalwart --profile db-mariadb --profile auth-ldap up -d
# or
make start
```

### Using PostgreSQL
```bash
# Start with PostgreSQL
docker compose --profile mail-stalwart --profile db-postgres --profile auth-ldap up -d
# or
make start-alt
```

## How to Switch Databases

### ⚠️ Important Notes Before Switching

1. **Data Migration Required**: Switching databases requires migrating your data. There is no automatic migration.
2. **Clean Start Recommended**: For development/testing, it's easiest to start fresh with the new database.
3. **Production**: Use proper database migration tools and backup before switching.

### Option 1: Fresh Start (Recommended for Development)

```bash
# 1. Stop and remove all containers and volumes
docker compose down -v

# 2. Start with your preferred database
# For MariaDB:
docker compose --profile mail-stalwart --profile db-mariadb --profile auth-ldap up -d

# For PostgreSQL:
docker compose --profile mail-stalwart --profile db-postgres --profile auth-ldap up -d
```

### Option 2: Switch Configuration (Advanced)

If you want to switch the configuration without starting fresh:

1. **Update `sogo6/config/process.conf`**:
   ```bash
   # For MariaDB:
   SOGO_P_DB_TYPE=MySQL
   SOGO_P_DB_HOST=sogo6-mariadb
   SOGO_P_DB_PORT=3306
   
   # For PostgreSQL:
   SOGO_P_DB_TYPE=PostgreSQL
   SOGO_P_DB_HOST=sogo6-postgres
   SOGO_P_DB_PORT=5432
   ```

2. **Rebuild and restart**:
   ```bash
   docker compose build sogo6-server
   docker compose up -d
   ```

3. **Migrate data** from old database to new database manually.

## Configuration Files

### Environment Variables (`.env`)

Both database configurations are available in `.env`:

```bash
# PostgreSQL settings
PG_USER=sogo
PG_PASSWORD=sogo_password_change_me
PG_DATABASE=sogo
PG_PORT=5432

# MariaDB settings
MARIADB_ROOT_PASSWORD=root_password_change_me
MARIADB_USER=sogo
MARIADB_PASSWORD=sogo_password_change_me
MARIADB_DATABASE=sogo
MARIADB_PORT=3306
```

### Server Configuration (`sogo6/config/process.conf`)

The database type is configured in `SOGO_P_DB_TYPE`:

```bash
# For MariaDB (default)
SOGO_P_DB_TYPE=MySQL
SOGO_P_DB_USER=sogo
SOGO_P_DB_PASS=sogo_password_change_me
SOGO_P_DB_HOST=sogo6-mariadb
SOGO_P_DB_PORT=3306

# For PostgreSQL (uncomment and adapt)
# SOGO_P_DB_TYPE=PostgreSQL
# SOGO_P_DB_USER=sogo
# SOGO_P_DB_PASS=sogo_password_change_me
# SOGO_P_DB_HOST=sogo6-postgres
# SOGO_P_DB_PORT=5432
```

## Profiles Explained

| Profile | Purpose |
|---------|---------|
| `db-mariadb` | Enables MariaDB service (default) |
| `db-postgres` | Enables PostgreSQL service |
| `mail-stalwart` | Enables Stalwart mail server |
| `auth-ldap` | Enables OpenLDAP authentication |

**Note**: Only enable ONE database profile at a time (`db-mariadb` OR `db-postgres`).

## Verify Database Connection

### For MariaDB
```bash
# Connect to MariaDB
docker compose exec sogo6-mariadb mysql -u sogo -psogo_password_change_me sogo

# Check tables
docker compose exec sogo6-mariadb mysql -u sogo -psogo_password_change_me sogo -e "SHOW TABLES;"
```

### For PostgreSQL
```bash
# Connect to PostgreSQL
docker compose exec sogo6-postgres psql -U sogo -d sogo

# Check tables
docker compose exec sogo6-postgres psql -U sogo -d sogo -c "\dt"
```

## Database Admin Tools

### MariaDB
```bash
# Use Adminer (web UI)
docker compose --profile dbadmin up -d
# Access: http://localhost:5050
```

### PostgreSQL
```bash
# Use PgAdmin (web UI)
docker compose --profile pgadmin up -d
# Access: http://localhost:5050
# Login: dev@example.org / password123
```

## Troubleshooting

### Container Won't Start After Switch

1. **Check which database is running**:
   ```bash
   docker compose ps
   ```

2. **Ensure only one database is active**:
   ```bash
   # Stop the wrong database
   docker compose --profile db-postgres down  # if using MariaDB
   docker compose --profile db-mariadb down   # if using PostgreSQL
   ```

3. **Check server logs**:
   ```bash
   docker compose logs sogo6-server
   ```

### Connection Errors

- **MariaDB**: Ensure `sogo6-mariadb` is running and healthy
- **PostgreSQL**: Ensure `sogo6-postgres` is running and healthy
- Check that `SOGO_P_DB_HOST` matches the container name

## Comparison

| Feature | MariaDB | PostgreSQL |
|---------|---------|------------|
| **Default** | ✅ Yes | ❌ No |
| **Performance** | Excellent for SOGo | Excellent |
| **Setup** | Simpler | More configuration |
| **Tools** | Adminer, MySQL CLI | PgAdmin, psql |
| **Compatibility** | MySQL-compatible | PostgreSQL-native |

## Summary

- **Default**: MariaDB (no profile needed for `make start`)
- **Alternative**: PostgreSQL (use `make start-alt` or `--profile db-postgres`)
- **Switching**: Requires `docker compose down -v` for clean start
- **Configuration**: Controlled by `SOGO_P_DB_TYPE` in `process.conf`

For production deployments, choose one database and stick with it. Use migration tools if you need to switch in production.
