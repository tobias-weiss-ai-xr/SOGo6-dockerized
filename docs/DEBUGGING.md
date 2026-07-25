# SOGo 6 Debugging Guide

## VS Code Debugging

### Python/Flask Server Debugging

1. **Setup VS Code Launch Configuration**

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: Flask Remote Debug",
      "type": "python",
      "request": "attach",
      "connect": {
        "host": "localhost",
        "port": 5678
      },
      "pathMappings": [
        {
          "localRoot": "${workspaceFolder}/sogo6-server",
          "remoteRoot": "/app"
        }
      ],
      "justMyCode": false
    },
    {
      "name": "Python: Flask Local",
      "type": "python",
      "request": "launch",
      "module": "debugpy",
      "args": [
        "--listen", "0.0.0.0:5678",
        "-m", "flask",
        "run",
        "--host=0.0.0.0",
        "--port=5000",
        "--reload"
      ],
      "env": {
        "FLASK_ENV": "development",
        "FLASK_DEBUG": "1"
      }
    }
  ]
}
```

2. **Start Debugging**
   - Start dev stack: `make start-dev`
   - In VS Code: Run > Start Debugging > "Python: Flask Remote Debug"
   - Set breakpoints in your Flask code

3. **Debug Console**
   - Use the VS Code debug console for interactive debugging
   - Variables, watch expressions, and call stack available

### React/UI Debugging

1. **Debug in Chrome**
   - Add to `.vscode/launch.json`:
```json
{
  "type": "chrome",
  "request": "launch",
  "name": "React: Launch Chrome",
  "url": "http://localhost:3000",
  "webRoot": "${workspaceFolder}/sogo6-ui",
  "sourceMaps": true,
  "trace": true
}
```

2. **Debug in Firefox**
   - Similar configuration for Firefox

3. **React DevTools**
   - Install Chrome extension: React Developer Tools
   - Inspect component hierarchy
   - View props and state
   - Profiler for performance

## Command Line Debugging

### Flask Server

```bash
# Shell into server
make dev-shell-server

# Run shell
flask shell

# Debug specific request
from app import app
app.test_client().get('/api/user/v1/system')

# Enable debug mode temporarily
from flask import current_app
current_app.debug = True
```

### Node/React

```bash
# Shell into UI
make dev-shell-ui

# Run tests
npm test

# Run specific test
npm test -- --testNamePattern="login"

# Debug with Node inspector
node --inspect-brk ./node_modules/.bin/react-scripts start
# Then connect with Chrome: chrome://inspect
```

### Database Debugging

**PostgreSQL:**
```bash
# Connect
make dev-shell-postgres

# Show slow queries (log_min_duration_statement)
ALTER SYSTEM SET log_min_duration_statement = '100ms';
SELECT pg_reload_conf();

# Enable statement logging
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

# Show active connections
SELECT * FROM pg_stat_activity;

# Show locks
SELECT * FROM pg_locks;

# Explain query
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

**Redis:**
```bash
# Connect
make dev-shell-redis

# Monitor commands
MONITOR

# Show slow log
SLOWLOG GET 10
SLOWLOG RESET

# Info
INFO memory
INFO clients
INFO server

# Keys and values
KEYS *
GET <key>
HGETALL <hash_key>
```

**LDAP:**
```bash
# Search
make dev-shell-ldap

# List all entries
ldapsearch -x -H ldap://sogo6-ldap:389 -b dc=example,dc=org -D cn=admin,dc=example,dc=org -w admin

# Specific entry
ldapsearch -x -H ldap://sogo6-ldap:389 -b uid=testuser,ou=users,dc=example,dc=org -D cn=admin,dc=example,dc=org -w admin

# Statistics
ldapsearch -x -H ldap://sogo6-ldap:389 -b cn=monitor -D cn=admin,dc=example,dc=org -w admin -s base
```

## API Debugging

### cURL Examples

```bash
# GET request
curl -v http://localhost:5001/api/user/v1/system

# POST request with JSON
curl -v -X POST http://localhost:5001/api/user/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

# With authentication
curl -v -H "Authorization: Bearer <token>" http://localhost:5001/api/user/v1/me

# Debug with verbose output
curl -vvv http://localhost:5001/api/user/v1/system
```

### Postman Setup

1. Import the OpenAPI spec (if available)
2. Create environment: `SOGo Dev`
3. Environment variables:
   - `base_url`: `http://localhost:5001`
   - `api_key`: `<your_token>`

### Using httpie

```bash
# Install: pip install httpie

# GET request
http GET http://localhost:5001/api/user/v1/system

# POST request
http POST http://localhost:5001/api/user/v1/users email=test@example.com password=password123

# With auth
http GET http://localhost:5001/api/user/v1/me "Authorization:Bearer <token>"
```

## Performance Debugging

### Memory Profiling

**Python:**
```bash
# Install
pip install memory-profiler

# Run with memory profiling
python -m memory_profiler app.py

# Line-by-line profiling
from memory_profiler import profile

@profile
def memory_intensive_function():
    # Your code here
    pass
```

**Node:**
```bash
# Heap snapshot
node --inspect ./node_modules/.bin/react-scripts start
# In Chrome: chrome://inspect > take heap snapshot

# Heap dump
const heapdump = require('heapdump');
heapdump.writeSnapshot('/tmp/heapdump-heapdump.json');
```

### CPU Profiling

**Python:**
```bash
# cProfile
python -m cProfile -o profile.prof app.py

# View
python -m pstats profile.prof

# SnakeViz
pip install snakeviz
snakeviz profile.prof
```

**Node:**
```bash
# CPU profile
node --prof ./node_modules/.bin/react-scripts start
# In Chrome: chrome://inspect > CPU profiling

# Clinic.js
npm install -g clinic
clinic doctor -- node ./node_modules/.bin/react-scripts start
```

### Database Query Profiling

**PostgreSQL:**
```sql
-- Enable timing
\timing on

-- Show query plan
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- Profile all queries
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;

-- Show slow queries
SELECT query, total_time, calls, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;
```

**Redis:**
```bash
# Enable latency monitoring
redis-cli --latency-history

# Show command stats
redis-cli INFO commandstats
```

## Network Debugging

### Check Container Connectivity

```bash
# Test connection from server to postgres
docker compose exec sogo6-server nc -zv sogo6-postgres 5432

# Test connection from server to redis
docker compose exec sogo6-server nc -zv sogo6-redis 6379

# Test connection to LDAP
docker compose exec sogo6-server nc -zv sogo6-ldap 389

# DNS lookup test
docker compose exec sogo6-server nslookup sogo6-postgres
```

### Check Open Ports

```bash
# All open ports on host
sudo lsof -i -P -n | grep LISTEN

# Specific port
sudo lsof -i :5001

# Docker container ports
docker ps --format "{{.Names}}: {{.Ports}}"
```

### Check Firewall

```bash
# Ubuntu
sudo ufw status

# CentOS
sudo firewall-cmd --list-all

# Docker may bypass firewall by default
```

## Logging

### View Logs

```bash
# All logs
make dev-logs

# Specific service
docker compose logs sogo6-server -f

# Show timestamps
docker compose logs --timestamps sogo6-server

# Show last N lines
docker compose logs --tail=100 sogo6-server

# Grep logs
docker compose logs sogo6-server | grep -i error
```

### Publish Logs to Host

```yaml
# In docker-compose.dev.yaml:
services:
  sogo6-server:
    volumes:
      - ./logs/sogo6-server.log:/var/log/sogo6-server.log
```

### External Logging

**Papertrail:**
```bash
# Install remote_syslog2
# Configure in container
docker run -e PAPERTRAIL_HOST=logsX.papertrailapp.com -e PAPERTRAIL_PORT=XXXXX gliderlabs/logspout
```

**ELK Stack:**
```yaml
# Add logstash service
logstash:
  image: docker.elastic.co/logstash/logstash:latest
  volumes:
    - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
```

## Common Issues

### 1. Server won't start

```bash
# Check if port is in use
lsof -i :5000

# Check Flask logs
docker compose logs sogo6-server

# Check if database is ready
docker compose logs sogo6-postgres

# Try pdb
make dev-shell-server
python -m pdb app.py
```

### 2. Database connection errors

```bash
# Test connection manually
make dev-shell-postgres
psql -U sogo -d sogo -h localhost

# Check connection from server
docker compose exec sogo6-server psql -U sogo -d sogo -h sogo6-postgres

# Check if database exists
psql -U sogo -l
```

### 3. Redis connection errors

```bash
# Test connection
make dev-shell-redis
PING

# Check from server
docker compose exec sogo6-server redis-cli -h sogo6-redis PING
```

### 4. LDAP connection errors

```bash
# Test connection
make dev-shell-ldap
ldapwhoami -x -H ldap://localhost:389 -D cn=admin,dc=example,dc=org -w admin

# Check from server
docker compose exec sogo6-server ldapsearch -x -H ldap://sogo6-ldap:389 -b dc=example,dc=org
```

### 5. CORS errors in browser

```bash
# Check CORS configuration in Flask
Fork the server code and ensure:
from flask_cors import CORS
CORS(app, origins=['http://localhost:3000', 'http://localhost:8080'])

# Or use Alter headers
docker compose exec sogo6-server curl -I -X OPTIONS http://localhost:5000/api/user/v1/system
```

### 6. Hot reload not working

```bash
# Check volume mounts
docker inspect <container_id> | grep -A 10 Mounts

# Check file watcher permissions
# On Linux, ensure inotify is working
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 7. Memory issues

```bash
# Check container memory
docker stats

# Check process memory
docker top <container_id>

# Increase limits in docker-compose.dev.yaml
```

### 8. Port already in use

```bash
# Find and kill process
sudo lsof -i :5001
kill -9 <PID>

# Or use different port in docker-compose.dev.yaml
```

### 9. Debugpy connection refused

```bash
# Check if debugpy is running
docker compose logs sogo6-server | grep debugpy

# Check if port is exposed
netstat -tulnp | grep 5678

# Ensure correct hostname
# Use host.docker.internal for Mac, or container name for Linux
```

### 10. Changes not reflected

```bash
# Clear browser cache
# Clear Docker build cache
docker build --no-cache

# Recreate containers
docker compose down
docker compose up -d
```

## Tips and Tricks

### 1. Interactive Debugging with ipdb

```python
import ipdb; ipdb.set_trace()
```

Place this line anywhere in your code to pause execution and enter interactive debugger.

### 2. Conditional Breakpoints

```python
import pdb

def my_function(x):
    if x > 100:  # Only break when condition is met
        pdb.set_trace()
    return x * 2
```

### 3. Remote pdb

```bash
# Run server with remote pdb
python -m pdb -c continue app.py

# In another terminal
telnet localhost 4444
```

### 4. Profile Specific Endpoint

```python
from flask import current_app

@app.route('/profile-endpoint')
@profile  # from memory_profiler
current_app.logger.info("Profiling...")
return "Done"
```

### 5. Break on Exception

```python
import sys

def handle_exception(exc_type, exc_value, exc_traceback):
    import pdb
    pdb.post_mortem(exc_traceback)

sys.excepthook = handle_exception
```

### 6. Logging Shortcuts

```python
# Add to app setup
def configure_logging(app):
    import logging
    logging.basicConfig(level=logging.DEBUG)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
```

### 7. Pretty Print in Debugger

```python
from pprint import pprint
pprint(variable.name)
```

### 8. Time Travel Debugging

```bash
# Install rr (Linux only)
sudo apt install rr

# Record
rr record python app.py

# Replay
rr replay
```

### 9. Git Bisect for Bug Hunting

```bash
# Start bisect
git bisect start

# Mark current commit as bad
git bisect bad

# Mark known good commit
git bisect good <commit>

# Git will check out a commit for you to test
# Once you find which commit introduced the bug:
git bisect reset
```

### 10. Strace for System Call Debugging

```bash
# Run with strace
docker run --rm -it --entrypoint strace sogo6-server -f -o /tmp/strace.log python app.py

# View output
docker cp <container_id>:/tmp/strace.log .
```
