#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# SOGo 6 — Shared Shell Library
# Source this file in any script: source "$(dirname "$0")/../lib/common.sh"
# ══════════════════════════════════════════════════════════════════════════════

# ── Strict mode ─────────────────────────────────────────────────────────────
# Call this at the top of any script: set_strict_mode
set_strict_mode() {
    set -euo pipefail
}

# ── Colors (no-op if stderr not a terminal) ─────────────────────────────────
if [[ -t 2 ]]; then
    readonly NC='\033[0m'
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly YELLOW='\033[1;33m'
    readonly CYAN='\033[0;36m'
    readonly BOLD='\033[1m'
else
    readonly NC='' RED='' GREEN='' YELLOW='' CYAN='' BOLD=''
fi

# ── Logging ─────────────────────────────────────────────────────────────────
log_info()  { echo -e "${GREEN}[INFO]${NC}${BOLD}" "$*" "${NC}" >&2; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}${BOLD}" "$*" "${NC}" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC}${BOLD}" "$*" "${NC}" >&2; }
log_step()  { echo -e "\n${CYAN}═══════════════════════════════════════════${NC}" >&2; echo -e "${CYAN}  $*${NC}" >&2; echo -e "${CYAN}═══════════════════════════════════════════${NC}" >&2; }
log_success() { echo -e "${GREEN}  ✓${NC}${BOLD} $*${NC}" >&2; }
log_failure() { echo -e "${RED}  ✗${NC}${BOLD} $*${NC}" >&2; }

# Test pass/fail counters (used by test scripts)
fail()   { echo -e "${RED}  [FAIL]${NC} $*"; }
pass()   { echo -e "${GREEN}  [PASS]${NC} $*"; }

# ── Error handling ─────────────────────────────────────────────────────────
# Usage: trap err_handler ERR
err_handler() {
    local last_cmd="$BASH_COMMAND"
    local last_line="${BASH_LINENO[0]}"
    log_error "Command failed at line ${last_line}: ${last_cmd}"
    exit 1
}

# ── Utility functions ───────────────────────────────────────────────────────

# Check if a command exists
has_cmd() {
    command -v "$1" &>/dev/null
}

# Check required commands, fail if any missing
require_cmd() {
    local missing=0
    for cmd in "$@"; do
        if ! has_cmd "$cmd"; then
            log_error "Missing required command: ${cmd}"
            missing=1
        fi
    done
    if [[ $missing -eq 1 ]]; then
        exit 1
    fi
}

# Confirm action (y/n), defaults to yes
confirm() {
    local prompt="${1:-Continue?}"
    local default="${2:-y}"
    local yn
    read -r -p "$prompt [${default}/n] " yn
    yn="${yn:-$default}"
    [[ "$yn" =~ ^[Yy] ]]
}

# Wait for service to respond (any HTTP status)
wait_for_service() {
    local url="$1"
    local name="$2"
    local timeout="${3:-60}"
    log_info "Waiting for ${name} at ${url} (${timeout}s)..."
    for i in $(seq 1 "$timeout"); do
        local code
        code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        if [ "$code" != "000" ]; then
            log_success "${name} responding after ${i}s (HTTP ${code})"
            return 0
        fi
        sleep 1
    done
    log_error "${name} failed to start after ${timeout}s"
    return 1
}

# Source .env file if present
load_env() {
    local dir="${1:-.}"
    if [[ -f "${dir}/.env" ]]; then
        set -a
        source "${dir}/.env" 2>/dev/null || true
        set +a
    fi
}

# Get script directory (resolves symlinks)
script_dir() {
    cd "$(dirname "$(readlink -f "${BASH_SOURCE[1]:-$0}")")" && pwd
}

# Check if we're inside a Docker container
is_docker() {
    [[ -f /.dockerenv ]]
}

# Generate a random string
rand_str() {
    openssl rand -base64 "${1:-18}" | tr '+/' '_-'
}

# Print a header banner
print_banner() {
    echo ""
    echo "============================================================"
    echo "  $*"
    echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo "============================================================"
    echo ""
}
