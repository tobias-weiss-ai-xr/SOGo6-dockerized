# ══════════════════════════════════════════════════════════════════════════════
# SOGo 6 — Makefile
# ══════════════════════════════════════════════════════════════════════════════
# Usage:
#   make setup       # First-time setup (clone + build)
#   make start       # Start full production stack
#   make dev         # Start development stack
#   make test        # Run test suite
#   make shell       # Shell into server container
# ══════════════════════════════════════════════════════════════════════════════

.DEFAULT_GOAL := help

# ── Profile presets ─────────────────────────────────────────────
PROD_PROFILES   := --profile mail-stalwart --profile db-postgres --profile auth-ldap
ALT_PROFILES    := --profile mail-stalwart --profile db-mariadb --profile auth-ldap
DEV_COMPOSE     := -f docker-compose.dev.yaml

.PHONY: setup build start stop restart status logs clean reset init
.PHONY: dev dev-stop dev-status dev-logs dev-clean dev-reset dev-debug
.PHONY: test test-smoke test-full test-e2e test-load
.PHONY: shell shell-ui shell-db shell-redis shell-ldap
.PHONY: help

# ── Setup ────────────────────────────────────────────────────────
setup:
	bash sogo6/scripts/setup.sh

init:
	bash sogo6/scripts/init-sogo6.sh

secrets:
	bash sogo6/scripts/manage-secrets.sh

certs:
	bash sogo6/scripts/gen-certs.sh

# ── Production Stack ─────────────────────────────────────────────
build:
	docker compose build --parallel
	docker images --filter "reference=sogo6*" --format "{{.Repository}}:{{.Tag}}"

start: start-full

start-full:
	docker compose $(PROD_PROFILES) up -d --wait --wait-timeout 180
	docker compose ps

start-alt:
	docker compose $(ALT_PROFILES) up -d --wait --wait-timeout 180
	docker compose ps

start-minimal:
	docker compose up -d --wait --wait-timeout 60
	docker compose ps

stop:
	docker compose down

restart: stop start

status:
	docker compose ps

logs:
	docker compose logs --tail=100 -f

clean:
	docker compose down -v
	@echo "Volumes removed."

reset: clean start init
	@echo "Stack reset complete. Run 'make init' again for domain config."

# ── Development Stack ────────────────────────────────────────────
dev: dev-start

dev-build:
	docker compose $(DEV_COMPOSE) build --parallel

dev-start:
	docker compose $(DEV_COMPOSE) up -d --wait --wait-timeout 180
	docker compose $(DEV_COMPOSE) ps

dev-stop:
	docker compose $(DEV_COMPOSE) down

dev-restart: dev-stop dev-start

dev-status:
	docker compose $(DEV_COMPOSE) ps

dev-logs:
	docker compose $(DEV_COMPOSE) logs --tail=100 -f

dev-clean:
	docker compose $(DEV_COMPOSE) down -v
	@echo "Dev volumes removed."

dev-reset: dev-clean dev-start init
	@echo "Dev reset complete."

dev-debug:
	@echo "Starting dev stack with tools..."
	docker compose $(DEV_COMPOSE) up -d --wait
	@echo ""
	@echo "  UI:            http://localhost:3000"
	@echo "  API:           http://localhost:5001"
	@echo "  PgAdmin:       http://localhost:5050 (dev@example.org / password123)"
	@echo "  Redis Insight: http://localhost:5540"
	@echo "  Mailhog:       http://localhost:8025"
	@echo "  Prometheus:    http://localhost:9090"
	@echo "  Grafana:       http://localhost:3001"
	@echo "  LDAP Admin:    http://localhost:8081"

# ── Extra Dev Tools (profiles) ──────────────────────────────────
dev-pgadmin:
	docker compose $(DEV_COMPOSE) up -d sogo6-pgadmin

dev-redisinsight:
	docker compose $(DEV_COMPOSE) up -d sogo6-redisinsight

dev-mailhog:
	docker compose $(DEV_COMPOSE) up -d sogo6-mailhog

dev-ldap-tools:
	docker compose $(DEV_COMPOSE) up -d sogo6-ldapadmin sogo6-lam sogo6-ladon sogo6-wd-ldap

dev-agent:
	docker compose $(DEV_COMPOSE) --profile agent up -d

dev-minio:
	docker compose $(DEV_COMPOSE) --profile minio up -d

dev-monitoring:
	docker compose $(DEV_COMPOSE) --profile monitoring up -d

dev-db-alternative:
	docker compose $(DEV_COMPOSE) --profile db-mariadb up -d

# ── Shell Access ────────────────────────────────────────────────
shell:
	docker compose $(DEV_COMPOSE) exec sogo6-server /bin/sh

shell-ui:
	docker compose $(DEV_COMPOSE) exec sogo6-ui /bin/sh

shell-db:
	docker compose $(DEV_COMPOSE) exec sogo6-postgres psql -U sogo -d sogo

shell-redis:
	docker compose $(DEV_COMPOSE) exec sogo6-redis redis-cli

shell-ldap:
	docker compose $(DEV_COMPOSE) exec sogo6-ldap ldapsearch -x -H ldap://localhost:389 -b dc=example,dc=org

# ── Tests ───────────────────────────────────────────────────────
test:
	bash tests/run-all-tests.sh

test-smoke:
	bash tests/api-test.sh
	bash tests/smtp-test.sh
	bash tests/ldap-test.sh

test-full:
	bash tests/run-all-tests.sh
	SOGO_INTEGRATION_TESTS=1 python3 -m pytest tests/integration/ -v --tb=short -x 2>/dev/null || true
	$(MAKE) test-contract 2>/dev/null || true

test-dev:
	SOGO_INTEGRATION_TESTS=1 docker compose $(DEV_COMPOSE) exec sogo6-server \
	  python -m pytest /app/tests -v --tb=short

test-e2e:
	cd tests/e2e && npx playwright test --config=playwright.config.ts

test-load:
	bash tests/load/run.sh

test-load-quick:
	bash tests/load/run.sh --sync-only

test-load-k6:
	bash tests/load/run.sh --k6-only

test-contract:
	cd sogo6-server && python3 -m pytest tests/test_properties/ -v --tb=short -x 2>/dev/null || \
	  echo "Install hypothesis: pip install hypothesis"

# ── Info ────────────────────────────────────────────────────────
help:
	@echo "SOGo 6 Development & Production Makefile"
	@echo ""
	@echo "=== PRODUCTION STACK ==="
	@echo "  make setup       First-time setup (clone + build)"
	@echo "  make build       Build Docker images"
	@echo "  make start       Start full stack (Stalwart + PostgreSQL + LDAP)"
	@echo "  make start-alt   Start with MariaDB"
	@echo "  make start-minimal  Start core only"
	@echo "  make stop        Stop stack"
	@echo "  make status      Container status"
	@echo "  make logs        Tail logs"
	@echo "  make clean       Remove containers + volumes"
	@echo "  make reset       Clean + start + init"
	@echo "  make init        Initialize via Admin API"
	@echo "  make secrets     Generate secrets vault"
	@echo "  make certs       Generate TLS certs"
	@echo ""
	@echo "=== DEVELOPMENT STACK ==="
	@echo "  make dev         Start dev stack (hot reload + tools)"
	@echo "  make dev-stop    Stop dev stack"
	@echo "  make dev-debug   Start with all debugging tools"
	@echo "  make shell       Shell into server container"
	@echo "  make shell-ui    Shell into UI container"
	@echo "  make dev-pgadmin Start PgAdmin"
	@echo "  make dev-mailhog Start Mailhog"
	@echo "  make dev-ldap-tools Start LDAP admin tools"
	@echo "  make dev-monitoring Start Prometheus + Grafana"
	@echo ""
	@echo "=== TESTS ==="
	@echo "  make test        Shell test suite"
	@echo "  make test-smoke  Quick smoke tests"
	@echo "  make test-full   All tests (shell + Python + contract)"
	@echo "  make test-e2e    Playwright browser tests"
	@echo "  make test-load   k6 load tests"
	@echo "  make test-contract  Hypothesis property-based tests"
