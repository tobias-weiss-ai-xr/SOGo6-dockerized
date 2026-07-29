#!/bin/bash
# Remote Deployment Script for mariadb-e2e MariaDB E2E Test
# Deploys and runs tests on remote host via SSH

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load shared library
source "${PROJECT_ROOT}/lib/common.sh"

REMOTE_HOST="${REMOTE_HOST:-localhost}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/mariadb-e2e}"

# ── Configuration ───────────────────────────────────────────────
# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            REMOTE_HOST="$2"
            shift 2
            ;;
        --user)
            REMOTE_USER="$2"
            shift 2
            ;;
        --dir)
            REMOTE_DIR="$2"
            shift 2
            ;;
        --skip-upload)
            SKIP_UPLOAD=true
            shift
            ;;
        --skip-deploy)
            SKIP_DEPLOY=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Deploy MariaDB E2E test suite to remote host via SSH"
            echo ""
            echo "Options:"
            echo "  --host HOST       Remote host (default: mariadb-e2e)"
            echo "  --user USER       Remote user (default: root)"
            echo "  --dir DIR         Remote directory (default: /opt/mariadb-e2e)"
            echo "  --skip-upload     Skip file upload (assume files already on remote)"
            echo "  --skip-deploy     Skip deployment (just run tests)"
            echo "  --help            Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  REMOTE_HOST       Remote host"
            echo "  REMOTE_USER       Remote user"
            echo "  REMOTE_DIR        Remote directory"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage"
            exit 1
            ;;
    esac
done

# ── Functions ───────────────────────────────────────────────────
check_ssh() {
    log_info "Testing SSH connection to ${REMOTE_USER}@${REMOTE_HOST}..."
    if ssh -o ConnectTimeout=5 -o BatchMode=yes ${REMOTE_USER}@${REMOTE_HOST} "echo 'SSH OK'" >/dev/null 2>&1; then
        log_info "✓ SSH connection successful"
        return 0
    else
        log_error "✗ SSH connection failed"
        log_error "  Please check:"
        log_error "  1. Host is reachable: ping ${REMOTE_HOST}"
        log_error "  2. SSH key is configured: ssh ${REMOTE_USER}@${REMOTE_HOST}"
        log_error "  3. Or use password auth: sshpass -p 'password' $0 --host ${REMOTE_HOST}"
        return 1
    fi
}

upload_files() {
    log_info "Uploading files to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}..."
    
    # Create remote directory
    ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${REMOTE_DIR}"
    
    # Upload deploy files
    tar -czf - -C "$SCRIPT_DIR" \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='.env' \
        . | ssh ${REMOTE_USER}@${REMOTE_HOST} "tar -xzf - -C ${REMOTE_DIR}"
    
    # Upload submodule source code for building
    log_info "Uploading sogo6-server source code..."
    tar -czf - -C "$PROJECT_ROOT/sogo6-server" \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='.git' \
        --exclude='.venv' \
        . | ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${REMOTE_DIR}/sogo6-server && tar -xzf - -C ${REMOTE_DIR}/sogo6-server"
    
    log_info "Uploading sogo6-ui source code..."
    tar -czf - -C "$PROJECT_ROOT/sogo6-ui" \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='.next' \
        . | ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${REMOTE_DIR}/sogo6-ui && tar -xzf - -C ${REMOTE_DIR}/sogo6-ui"
    
    log_info "✓ Files uploaded successfully"
}

deploy() {
    log_info "Deploying on ${REMOTE_HOST}..."
    
    ssh ${REMOTE_USER}@${REMOTE_HOST} "
        cd ${REMOTE_DIR}
        chmod +x deploy.sh run-e2e-tests.sh
        
        # Stop any existing containers
        docker compose down -v 2>/dev/null || true
        
        # Start services
        echo 'Starting Docker services...'
        docker compose up -d --wait --wait-timeout 120
        
        # Show status
        echo ''
        echo 'Service status:'
        docker compose ps
        
        echo ''
        echo 'Recent logs:'
        docker compose logs --tail=10
        
        echo ''
        echo '✓ Deployment complete!'
    "
}

run_tests() {
    log_info "Running E2E tests on ${REMOTE_HOST}..."
    
    ssh ${REMOTE_USER}@${REMOTE_HOST} "
        cd ${REMOTE_DIR}
        chmod +x run-e2e-tests.sh
        ./run-e2e-tests.sh
    "
}

# ── Main ────────────────────────────────────────────────────────
main() {
    echo "============================================================"
    echo "  Remote Deployment - MariaDB E2E Test"
    echo "============================================================"
    echo "  Remote Host:  ${REMOTE_USER}@${REMOTE_HOST}"
    echo "  Remote Dir:   ${REMOTE_DIR}"
    echo "============================================================"
    echo ""
    
    # Check SSH
    check_ssh || exit 1
    
    # Upload files (unless skipped)
    if [[ "${SKIP_UPLOAD:-false}" != "true" ]]; then
        upload_files
    else
        log_warn "Skipping file upload (--skip-upload)"
    fi
    
    # Deploy (unless skipped)
    if [[ "${SKIP_DEPLOY:-false}" != "true" ]]; then
        deploy
    else
        log_warn "Skipping deployment (--skip-deploy)"
    fi
    
    # Run tests
    echo ""
    echo "============================================================"
    echo "  Running E2E Tests"
    echo "============================================================"
    echo ""
    
    run_tests
}

main "$@"
