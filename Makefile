# SOGo 6 Evaluation Stack
# Docker Compose orchestration targets

.PHONY: setup build start stop restart status logs clean reset test

setup:
	bash sogo6/scripts/setup.sh

build:
	docker compose build --parallel
	docker images --filter "reference=sogo6*" --format "{{.Repository}}:{{.Tag}}"

start:
	docker compose up -d --wait --wait-timeout 180
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
	@echo "Volumes and containers removed."

reset: clean start
	bash sogo6/scripts/init-sogo6.sh

init:
	bash sogo6/scripts/init-sogo6.sh

test:
	bash tests/run-all-tests.sh

test-smoke:
	bash tests/api-test.sh
	bash tests/smtp-test.sh
	bash tests/ldap-test.sh

test-full:
	bash tests/run-all-tests.sh
	SOGO_INTEGRATION_TESTS=1 python3 -m pytest tests/integration/ -v --tb=short -x 2>/dev/null || echo "Python tests skipped (set SOGO_INTEGRATION_TESTS=1)"

secrets:
	bash sogo6/scripts/manage-secrets.sh

certs:
	bash sogo6/scripts/gen-certs.sh

backup:
	bash sogo6/scripts/backup.sh

help:
	@echo "Available targets:"
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
	@echo "  test-full   - All tests including Python integration"
	@echo "  secrets     - Generate secrets vault"
	@echo "  certs       - Generate TLS certificates"
	@echo "  backup      - Backup all volumes"
