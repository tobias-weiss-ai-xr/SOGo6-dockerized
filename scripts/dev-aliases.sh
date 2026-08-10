#!/bin/bash
# SOGo 6 Dev Aliases - Add to ~/.bashrc or ~/.zshrc

# Dev stack management
alias sogo-dev-start='docker compose -f docker-compose.dev.yaml up -d --wait'
alias sogo-dev-stop='docker compose -f docker-compose.dev.yaml down'
alias sogo-dev-restart='sogo-dev-stop && sogo-dev-start'
alias sogo-dev-status='docker compose -f docker-compose.dev.yaml ps'
alias sogo-dev-logs='docker compose -f docker-compose.dev.yaml logs -f'
alias sogo-dev-clean='docker compose -f docker-compose.dev.yaml down -v'

# Shell access
alias sogo-dev-shell-server='docker compose -f docker-compose.dev.yaml exec sogo6-server /bin/sh'
alias sogo-dev-shell-ui='docker compose -f docker-compose.dev.yaml exec sogo6-ui /bin/sh'
alias sogo-dev-shell-postgres='docker compose -f docker-compose.dev.yaml exec sogo6-postgres psql -U sogo -d sogo'
alias sogo-dev-shell-redis='docker compose -f docker-compose.dev.yaml exec sogo6-redis redis-cli'
alias sogo-dev-shell-ldap='docker compose -f docker-compose.dev.yaml exec sogo6-ldap ldapsearch -x -H ldap://localhost:389 -b dc=example,dc=org -D cn=admin,dc=example,dc=org -w admin'

# Database tools
alias sogo-dev-pgadmin='docker compose -f docker-compose.dev.yaml up -d sogo6-pgadmin'
alias sogo-dev-redisinsight='docker compose -f docker-compose.dev.yaml up -d sogo6-redisinsight'

# Monitoring
alias sogo-dev-monitoring='docker compose -f docker-compose.dev.yaml --profile monitoring up -d'
alias sogo-dev-prometheus='open http://localhost:9090'
alias sogo-dev-grafana='open http://localhost:3001'

# LDAP tools
alias sogo-dev-ldap-tools='docker compose -f docker-compose.dev.yaml --profile ldap-tools up -d'
alias sogo-dev-ldapadmin='open http://localhost:8081'

# Mail tools
alias sogo-dev-mail-tools='docker compose -f docker-compose.dev.yaml --profile mail-tools up -d'
alias sogo-dev-mailhog='open http://localhost:8025'

# Testing
alias sogo-dev-test='SOGO_INTEGRATION_TESTS=1 docker compose -f docker-compose.dev.yaml exec sogo6-server python -m pytest /app/tests -v'
alias sogo-dev-test-watch='docker compose -f docker-compose.dev.yaml exec sogo6-server ptw'

# Quick open URLs
alias sogo-dev-ui='open http://localhost:3000'
alias sogo-dev-api='open http://localhost:5001/api/user/v1/system'
alias sogo-dev-maildev='open http://localhost:1080'
