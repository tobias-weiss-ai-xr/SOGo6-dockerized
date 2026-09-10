#!/bin/bash
# lib/common.sh — shared colors + logging for repo scripts.
# (The original moved to the SOGo6-testsuite repo; this is the minimal
# subset the scripts in THIS repo rely on.)
set -euo pipefail

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

log_info()    { echo -e "${GREEN}[INFO]${NC}${BOLD}" "$*" "${NC}" >&2; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}${BOLD}" "$*" "${NC}" >&2; }
log_error()   { echo -e "${RED}[ERROR]${NC}${BOLD}" "$*" "${NC}" >&2; }
log_step()    { echo -e "\n${CYAN}═══════════════════════════════════════════${NC}" >&2; echo -e "${CYAN}  $*${NC}" >&2; echo -e "${CYAN}═══════════════════════════════════════════${NC}" >&2; }
log_success() { echo -e "${GREEN}  ✓${NC}${BOLD} $*${NC}" >&2; }
log_failure() { echo -e "${RED}  ✗${NC}${BOLD} $*${NC}" >&2; }
fail()        { echo -e "${RED}  [FAIL]${NC} $*"; }
pass()        { echo -e "${GREEN}  [PASS]${NC} $*"; }
