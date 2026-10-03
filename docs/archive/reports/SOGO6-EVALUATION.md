# SOGo 6 Evaluation Guide

## Overview

SOGo 6 is a complete rebuild of the SOGo webmail and groupware suite. Unlike SOGo 5 (which uses GNUstep/Objective-C), SOGo 6 is built with modern technologies:

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Python 3.10+, Flask, MariaDB, Redis
- **Authentication**: LDAP (with plans for SQL user sources)

## Quick Start

```bash
# From the project root

# 1. Setup
bash sogo6/scripts/setup.sh

# 2. Start
docker compose up -d

# 3. Init
bash sogo6/scripts/init-sogo6.sh
```

### Verify Services

```bash
docker compose ps

curl http://localhost:3000/env
curl http://localhost:5000/api/user/v1/system
curl http://localhost:1080
```

### Access

- **Web UI**: http://localhost:3000
- **API Swagger**: http://localhost:5000/swagger-basic
- **Maildev**: http://localhost:1080

## Testing

### Manual

1. **Login** — navigate to http://localhost:3000, log in with `testuser@example.org` / `password123`
2. **Mail** — compose and send an email, verify in Maildev (http://localhost:1080)
3. **Calendar** — create/edit/delete events
4. **Address Book** — view LDAP contacts, create new ones

### Automated

```bash
npm install
npx playwright install chromium
node tests/sogo6-e2e-test.js
```

## Monitoring

```bash
# All logs
docker compose logs -f

# Specific service
docker compose logs -f sogo6-server

# Database
docker exec -it sogo6-mariadb psql -U sogo -d sogo

# Redis
docker exec -it sogo6-redis redis-cli

# LDAP
docker exec sogo6-ldap ldapsearch -x -b "dc=example,dc=org" "(objectClass=inetOrgPerson)"
```

## Resources

- **SOGo 6 UI**: https://github.com/tobias-weiss-ai-xr/SOGo6-UI
- **SOGo 6 Server**: https://github.com/tobias-weiss-ai-xr/SOGo6-server
- **SOGo 6 Docs**: https://www.sogo.nu/files/docs/v6/
