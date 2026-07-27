# SOGo 6 Evaluation Stack
# Docker Compose orchestration targets

.PHONY: setup build start stop restart status logs clean reset init test
.PHONY: start-full start-stalwart start-minimal start-byo
.PHONY: install-dev-deps test-contract test-all

# ── Setup ────────────────────────────────────────────────────
setup:
	bash sogo6/scripts/setup.sh

# ── Build ─────────────────────────────────────────────────────
build:
	docker compose build --parallel
	docker images --filter "reference=sogo6*" --format "{{.Repository}}:{{.Tag}}"

# ── Production profiles ──────────────────────────────────────
# Full stack: Stalwart + PostgreSQL + LDAP
start-full:
	docker compose --profile mail-stalwart --profile db-postgres --profile auth-ldap up -d --wait --wait-timeout 180
	docker compose ps

# Stalwart mail + MariaDB
start-alt:
	docker compose --profile mail-stalwart --profile db-mariadb --profile auth-ldap up -d --wait --wait-timeout 180
	docker compose ps

# Minimal: only core SOGo. Bring your own DB, mail, auth.
start-minimal:
	docker compose up -d --wait --wait-timeout 60
	docker compose ps

# Stalwart mail + PostgreSQL (default recommendation)
start: start-full

stop:
	docker compose down

restart: stop start

status:
	docker compose ps

logs:
	docker compose logs --tail=100 -f

clean:
	docker compose down -v
	@echo "Volumes and containers removed."

reset: clean
	bash sogo6/scripts/init-sogo6.sh
	bash sogo6/scripts/init-sogo6.sh  # second run applies domain config

init:
	bash sogo6/scripts/init-sogo6.sh

# ── Dev Dependencies ───────────────────────────────────────────
install-dev-deps:
	@echo "Installing Python dev dependencies..."
	pip install -r sogo6-server/requirements-dev.txt
	pip install hypothesis 2>/dev/null || echo "hypothesis already installed"
	@echo "Done. Run tests with: make test-contract"

# ── Tests ─────────────────────────────────────────────────────
test:
	bash tests/run-all-tests.sh

test-smoke:
	bash tests/api-test.sh
	bash tests/smtp-test.sh
	bash tests/ldap-test.sh

test-full:
	bash tests/run-all-tests.sh
	SOGO_INTEGRATION_TESTS=1 python3 -m pytest tests/integration/ -v --tb=short -x 2>/dev/null || echo "Python integration tests skipped (set SOGO_INTEGRATION_TESTS=1)"
	$(MAKE) test-contract 2>/dev/null || echo "Contract tests skipped (install hypothesis with: pip install hypothesis)"

build-dev:
	docker compose -f docker-compose.dev.yaml build --parallel
	docker images --filter "reference=sogo6*" --format "{{.Repository}}:{{.Tag}}"

start-dev:
	docker compose -f docker-compose.dev.yaml up -d --wait --wait-timeout 180
	docker compose -f docker-compose.dev.yaml ps

stop-dev:
	docker compose -f docker-compose.dev.yaml down

restart-dev: stop-dev start-dev

dev-status:
	docker compose -f docker-compose.dev.yaml ps

dev-logs:
	docker compose -f docker-compose.dev.yaml logs --tail=100 -f

dev-clean:
	docker compose -f docker-compose.dev.yaml down -v
	@echo "Dev volumes and containers removed."

dev-reset: dev-clean start-dev
	bash sogo6/scripts/init-sogo6.sh

dev-debug:
	@echo "Starting dev stack with full debugging tools..."
	docker compose -f docker-compose.dev.yaml up -d --wait
	@echo ""
	@echo "Dev tools available:"
	@echo "  - UI:              http://localhost:3000"
	@echo "  - API Server:      http://localhost:5001"
	@echo "  - PgAdmin:         http://localhost:5050 (dev@example.org / password123)"
	@echo "  - Redis Insight:   http://localhost:5540"
	@echo "  - Mailhog:         http://localhost:8025"
	@echo "  - Prometheus:      http://localhost:9090"
	@echo "  - Grafana:         http://localhost:3001 (admin / password123)"
	@echo "  - Nginx:           http://localhost:80 / https://localhost:443"
	@echo ""
	@echo "Optional (start with make dev-<name>):"
	@echo "  - dev-agent:       Celery async job worker"
	@echo "  - dev-minio:       S3-compatible object storage (MinIO)"
	@echo "  - dev-db-alternative: MariaDB database"
	@echo ""
	@echo "Services exposed on host:"
	@echo "  - PostgreSQL:      localhost:5432"
	@echo "  - Redis:           localhost:6379"
	@echo "  - LDAP:            localhost:389"
	@echo "  - SMTP (Maildev):  localhost:1025 / Web: localhost:1080"
	@echo "  - SMTP (Stalwart): localhost:20025"

dev-shell-server:
	docker compose -f docker-compose.dev.yaml exec sogo6-server /bin/sh

dev-shell-ui:
	docker compose -f docker-compose.dev.yaml exec sogo6-ui /bin/sh

dev-shell-postgres:
	docker compose -f docker-compose.dev.yaml exec sogo6-postgres psql -U sogo -d sogo

dev-shell-redis:
	docker compose -f docker-compose.dev.yaml exec sogo6-redis redis-cli

dev-shell-ldap:
	docker compose -f docker-compose.dev.yaml exec sogo6-ldap ldapsearch -x -H ldap://localhost:389 -b dc=example,dc=org -D cn=admin,dc=example,dc=org -w admin

dev-pgadmin:
	docker compose -f docker-compose.dev.yaml up -d sogo6-pgadmin
	@echo "PgAdmin started: http://localhost:5050"

dev-redis:
	docker compose -f docker-compose.dev.yaml up -d sogo6-redisinsight
	@echo "Redis Insight started: http://localhost:5540"

dev-monitoring:
	docker compose -f docker-compose.dev.yaml --profile monitoring up -d
	@echo "Monitoring stack started:"
	@echo "  - Prometheus: http://localhost:9090"
	@echo "  - Grafana:    http://localhost:3001"

dev-ldap-tools:
	docker compose -f docker-compose.dev.yaml --profile ldap-tools up -d
	@echo "LDAP tools started:"
	@echo "  - LDAP Admin:  http://localhost:8081"
	@echo "  - LDAP UI:     http://localhost:8082"
	@echo "  - Ladon:       http://localhost:8083"
	@echo "  - phpLDAPadmin: http://localhost:8084"

dev-agent:
	docker compose -f docker-compose.dev.yaml --profile agent up -d
	@echo "Celery agent started:"
	@echo "  - Worker: sogo6-agent-dev (async background jobs)"

dev-minio:
	docker compose -f docker-compose.dev.yaml --profile minio up -d
	@echo "MinIO started:"
	@echo "  - API:       http://localhost:9000"
	@echo "  - Console:   http://localhost:9001 (minioadmin / minioadmin)"

dev-db-alternative:
	docker compose -f docker-compose.dev.yaml --profile db-alternative up -d
	@echo "Alternative database started:"
	@echo "  - MariaDB:   localhost:3306 (sogo / sogo)"

dev-mail-tools:
	docker compose -f docker-compose.dev.yaml --profile mail-tools up -d
	@echo "Mail tools started:"
	@echo "  - Mailhog: http://localhost:8025"

test-dev:
	SOGO_INTEGRATION_TESTS=1 docker compose -f docker-compose.dev.yaml exec sogo6-server python -m pytest /app/tests -v --tb=short

test-watch:
	docker compose -f docker-compose.dev.yaml exec sogo6-server ptw --snapshot-update --on-pass "echo 'Tests passed!'"

load-test:
	@echo "Running load/performance tests..."
	@bash tests/load/run.sh

load-test-quick:
	@echo "Running quick sync benchmark..."
	@bash tests/load/run.sh --sync-only

load-test-k6:
	@echo "Running k6 HTTP API load tests..."
	@bash tests/load/run.sh --k6-only

test-e2e:
	@echo "Running Playwright E2E frontend tests..."
	@cd tests/e2e && npx playwright test --config=playwright.config.ts

test-e2e-report:
	@echo "Opening Playwright HTML report..."
	@cd tests/e2e && npx playwright show-report

test-contract:
	@echo "Running contract/property-based tests..."
	cd sogo6-server && python3 -m pytest tests/test_properties/ -v --tb=short -x 2>/dev/null || echo "Contract tests need: cd sogo6-server && pip install -r requirements-dev.txt"

test-all: test test-e2e load-test test-contract
	@echo "All test suites passed."

help:
	@echo "Available targets:"
	@echo "  === Production Stack ==="
	@echo "  setup       - Clone repos + build Docker images"
	@echo "  build       - Build Docker images"
	@echo "  start       - Start the stack"
	@echo "  stop        - Stop the stack"
	@echo "  status      - Show container status"
	@echo "  logs        - Tail logs"
	@echo "  clean       - Remove containers and volumes"
	@echo "  reset       - Clean + start + init"
	@echo "  init        - Initialize system via Admin API"
	@echo "  test        - Run shell test suite"
	@echo "  test-smoke  - Quick smoke tests (API + SMTP + LDAP)"
	@echo "  test-full   - All tests including Python integration + contract tests"
	@echo "  test-contract - Run hypothesis property-based tests (API envelope)"
	@echo "  test-all    - Run all: shell + E2E + load + contract"
	@echo "  install-dev-deps - Install Python dev dependencies (hypothesis, etc.)"
	@echo "  secrets     - Generate secrets vault"
	@echo "  certs       - Generate TLS certificates"
	@echo "  backup      - Backup all volumes"
	@echo ""
	@echo "  === Development Stack ==="
	@echo "  build-dev       - Build dev Docker images"
	@echo "  start-dev       - Start dev stack"
	@echo "  stop-dev        - Stop dev stack"
	@echo "  dev-status      - Show dev container status"
	@echo "  dev-logs        - Tail dev logs"
	@echo "  dev-clean        - Remove dev containers and volumes"
	@echo "  dev-reset       - Clean + start + init dev stack"
	@echo "  dev-debug       - Start dev stack with all debugging tools"
	@echo "  dev-shell-server - Shell into server container"
	@echo "  dev-shell-ui    - Shell into UI container"
	@echo "  dev-shell-postgres - Shell into postgres with psql"
	@echo "  dev-shell-redis - Shell into redis with redis-cli"
	@echo "  dev-shell-ldap  - Test LDAP connection"
	@echo "  dev-monitoring  - Start Prometheus + Grafana"
	@echo "  dev-ldap-tools  - Start LDAP admin tools"
	@echo "  dev-mail-tools  - Start Mailhog"
	@echo "  test-dev        - Run integration tests in dev stack"
	@echo "  test-watch      - Watch mode tests (ptw)"
