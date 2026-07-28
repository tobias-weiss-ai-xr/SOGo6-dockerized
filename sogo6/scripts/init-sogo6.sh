#!/bin/bash
# SOGo 6 Initialization Script
# Automates system configuration via Admin API
# Usage: ./init-sogo6.sh [options]
#
# Options:
#   -s, --server URL    SOGo server URL (default: http://localhost:5001)
#   -a, --admin PASS    Admin password (default: from env SOGO_ADMIN_PASSWORD or 'admin')
#   -d, --domain DOM    Domain name (default: from env SOGO_DOMAIN or 'example.org')
#   -f, --force          Force re-configuration (skip idempotency checks)
#   --skip-domain        Skip domain creation (domain-default only)
#   -h, --help           Show this help message

set -euo pipefail

# Auto-detect server URL
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qE 'sogo6-server(-dev)?'; then
    DEFAULT_SERVER="http://localhost:5001"
else
    DEFAULT_SERVER="http://sogo6-server:5000"
fi

# Parse arguments
SERVER_URL="${SOGO_SERVER_URL:-$DEFAULT_SERVER}"
ADMIN_PASSWORD="${SOGO_ADMIN_PASSWORD:-admin}"
DOMAIN="${SOGO_DOMAIN:-example.org}"
FORCE=false
SKIP_DOMAIN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -s|--server)
            SERVER_URL="$2"
            shift 2
            ;;
        -a|--admin)
            ADMIN_PASSWORD="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        --skip-domain)
            SKIP_DOMAIN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -s, --server URL    SOGo server URL (default: http://localhost:5001)"
            echo "  -a, --admin PASS    Admin password (default: from env SOGO_ADMIN_PASSWORD or 'admin')"
            echo "  -d, --domain DOM    Domain name (default: from env SOGO_DOMAIN or 'example.org')"
            echo "  -f, --force          Force re-configuration (skip idempotency checks)"
            echo "  --skip-domain        Skip domain creation (domain-default only)"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "=== SOGo 6 Initialization ==="
echo "Server: $SERVER_URL"
echo "Domain: $DOMAIN"
echo "Force: $FORCE"
echo "Skip domain: $SKIP_DOMAIN"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_success() {
    echo -e "${GREEN}[OK]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_info() {
    echo "[INFO] $*"
}

# Convert a domain name (e.g. "example.org") to LDAP DC format (e.g. "dc=example,dc=org")
domain_to_dc() {
    local domain="$1"
    local IFS='.'
    local result=""
    for part in $domain; do
        if [ -z "$result" ]; then
            result="dc=$part"
        else
            result="$result,dc=$part"
        fi
    done
    echo "$result"
}

api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local token="${4:-}"
    local max_retries="${5:-3}"
    local retry_delay="${6:-2}"

    local headers=(-s -H "Content-Type: application/json" -H "Accept: application/json")
    if [[ -n "$token" ]]; then
        headers+=(-H "Authorization: Bearer $token")
    fi

     local attempt=1
     local response=""
     local curl_args=(-s -k --connect-timeout 5 --max-time 10)
     while [[ $attempt -le $max_retries ]]; do
         if [[ -n "$data" ]]; then
             response=$(curl "${curl_args[@]}" -X "$method" "${SERVER_URL}${endpoint}" "${headers[@]}" -d "$data" 2>&1 || true)
         else
             response=$(curl "${curl_args[@]}" -X "$method" "${SERVER_URL}${endpoint}" "${headers[@]}" 2>&1 || true)
         fi

        if echo "$response" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
            break
        fi

        attempt=$((attempt + 1))
        if [[ $attempt -le $max_retries ]]; then
            log_warning "API call failed (attempt $attempt/$max_retries), retrying in ${retry_delay}s..."
            sleep "$retry_delay"
        fi
    done

    echo "$response"
}

extract_error_code() {
    local response="$1"
    echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error_code',''))" 2>/dev/null || echo ""
}

extract_jwt() {
    local response="$1"
    echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('jwt_token',''))" 2>/dev/null || echo ""
}

wait_for_dependencies() {
    log_info "Checking dependencies..."

    log_info "  Waiting for PostgreSQL..."
    for i in {1..30}; do
        local pg_container=$(docker ps --format '{{.Names}}' | grep -E '^sogo6-postgres' | head -1)
    if [ -n "$pg_container" ] && docker exec "$pg_container" pg_isready -U sogo 2>/dev/null; then
            log_success "PostgreSQL is ready"
            break
        fi
        sleep 2
        if [[ $i -eq 30 ]]; then
            log_error "PostgreSQL not responding after 60 seconds"
            return 1
        fi
    done

    log_info "  Waiting for LDAP..."
    for i in {1..30}; do
        local ldap_container=$(docker ps --format '{{.Names}}' | grep -E '^sogo6-ldap' | head -1)
    if [ -n "$ldap_container" ] && docker exec "$ldap_container" ldapsearch -x -H ldap://localhost:389 -b dc=example,dc=org -D cn=admin,dc=example,dc=org -w admin -s base 2>/dev/null | grep -q "dc=example"; then
            log_success "LDAP is ready"
            break
        fi
        sleep 2
        if [[ $i -eq 30 ]]; then
            log_error "LDAP not responding after 60 seconds"
            return 1
        fi
    done

    log_info "  Waiting for Stalwart..."
    for i in {1..30}; do
        if timeout 2 bash -c 'echo > /dev/tcp/localhost/20993' 2>/dev/null || \
           docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -E 'sogo6-stalwart.*healthy' | grep -q .; then
            log_success "Stalwart is ready"
            break
        fi
        sleep 2
        if [[ $i -eq 30 ]]; then
            log_warning "Stalwart health check timed out, continuing..."
            break
        fi
    done

     log_info "  Waiting for SOGo server..."
     for i in {1..30}; do
         if curl -sk --connect-timeout 2 --max-time 3 "${SERVER_URL}/api/user/v1/system" > /dev/null 2>&1; then
             log_success "SOGo server is ready"
             break
         fi
         sleep 2
         if [[ $i -eq 30 ]]; then
             log_error "SOGo server not responding after 60 seconds"
             return 1
         fi
     done

    return 0
}

check_already_initialized() {
    if $FORCE; then
        return 1
    fi

    log_info "Checking if already initialized..."

    local response
    response=$(api_call "GET" "/api/admin/v1/config/domain-default" "" "" 1)
    local error_code
    error_code=$(extract_error_code "$response")

    if [[ "$error_code" == "S000000" ]]; then
        local settings_status
        settings_status=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); settings=d.get('data',{}); print('YES' if (settings.get('SOGO_D_MAIL_SERVER_TYPE') or settings.get('SOGO_D_IMAP_SERVER')) else 'NO')" 2>/dev/null || echo "NO")

        if [[ "$settings_status" == "YES" ]]; then
            log_success "Already initialized. Use -f/--force to re-configure."
            return 0
        fi
    fi

    return 1
}

admin_login() {
    local max_attempts=5
    local attempt=1
    local response
    local jwt_token=""

    while [[ $attempt -le $max_attempts ]]; do
        response=$(api_call "POST" "/api/admin/v1/auth/login" "{\"username\":\"admin\",\"password\":\"$ADMIN_PASSWORD\"}" "" 1)
        local error_code
        error_code=$(extract_error_code "$response")

        if [[ "$error_code" == "S000000" ]]; then
            jwt_token=$(extract_jwt "$response")
            if [[ -n "$jwt_token" ]]; then
                echo "$jwt_token"
                return 0
            fi
        fi

        attempt=$((attempt + 1))
        if [[ $attempt -le $max_attempts ]]; then
            log_warning "Login failed (attempt $attempt/$max_attempts), retrying..."
            sleep 3
        fi
    done

    log_error "Admin login failed after $max_attempts attempts"
    echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin))" 2>/dev/null || echo "$response"
    return 1
}

configure_system_settings() {
    local jwt_token="$1"

    # Defaults for DB connection (can be overridden via env)
    SOGO_PG_USER="${SOGO_PG_USER:-sogo}"
    SOGO_PG_DATABASE="${SOGO_PG_DATABASE:-sogo}"
    SOGO_P_TABLE_SETTINGS="${SOGO_P_TABLE_SETTINGS:-sogo6_sogo_settings}"
    SOGO_P_TABLE_RULES="${SOGO_P_TABLE_RULES:-sogo6_sogo_settings_rules}"
    LOG_FILE="${LOG_FILE:-/dev/null}"

    # Run DB migration: add settings_theme column if missing
    log_info "Running DB migrations..."
    docker compose exec -T sogo6-postgres psql -U "${SOGO_PG_USER}" -d "${SOGO_PG_DATABASE}" -c "
      DO \$\$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='${SOGO_P_TABLE_SETTINGS}' AND column_name='settings_theme'
        ) THEN
          ALTER TABLE ${SOGO_P_TABLE_SETTINGS} ADD COLUMN settings_theme JSONB DEFAULT '{}'::jsonb;
        END IF;
      END
      \$\$;
    " 2>&1 | tee -a "${LOG_FILE}"
    
    # Run DB migration: add rule_description column if missing
    docker compose exec -T sogo6-postgres psql -U "${SOGO_PG_USER}" -d "${SOGO_PG_DATABASE}" -c "
      DO \$\$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='${SOGO_P_TABLE_RULES}' AND column_name='rule_description'
        ) THEN
          ALTER TABLE ${SOGO_P_TABLE_RULES} ADD COLUMN rule_description TEXT DEFAULT '';
        END IF;
      END
      \$\$;
    " 2>&1 | tee -a "${LOG_FILE}"
    log_info "Configuring system settings..."

    local system_data='{
      "SOGO_S_DO_DOMAIN": true,
      "SOGO_S_KNOWN_DOMAIN": ["'"$DOMAIN"'"]
    }'

    local response
    response=$(api_call "PATCH" "/api/admin/v1/config/system" "{\"settings\": ${system_data}}" "$jwt_token" 3)
    local error_code
    error_code=$(extract_error_code "$response")

    if [[ "$error_code" == "S000000" ]]; then
        log_success "System settings configured"
    else
        log_warning "System settings may already be configured"
    fi
}

configure_domain_default() {
    local jwt_token="$1"

    log_info "Configuring domain-default settings..."

    local ldap_dc="$(domain_to_dc "$DOMAIN")"
    local domain_default_data='{
      "settings": {
        "AUTH_SETTINGS": {
          "SOGO_D_AUTH_TYPE": "plain",
          "SOGO_D_PWD_CHANGE_ENABLED": true,
          "SOGO_D_PWD_RECOVERY": false,
          "SOGO_D_LOGIN_MFA": false
        },
        "USER_SOURCE": {
          "ldap_main": {
            "US_UID": "ldap_main",
            "US_NAME": "LDAP Users",
            "US_TYPE": "ldap",
            "US_LDAP_HOSTNAME": "sogo6-ldap",
            "US_LDAP_PORT": 389,
            "US_LDAP_BIND_DN": "cn=admin,'"$ldap_dc"'",
            "US_LDAP_BIND_DN_PWD": "admin",
            "US_LDAP_BASE_DN": "ou=users,'"$ldap_dc"'",
            "US_LDAP_UID": "uid",
            "US_LDAP_CN": "cn",
            "US_LDAP_ID": "uid",
            "US_LDAP_SCOPE": "SUB",
            "US_LDAP_QUERY_TIMEOUT": 0,
            "US_LDAP_BIND_AS_USER": false,
            "US_LDAP_ATTR_FIELD": ["*"],
            "US_LDAP_GROUP_CLASS": ["group","groupOfNames","groupOfUniqueNames","posixGroup"],
            "US_CAN_AUTH": true,
            "US_PWD_POLICY": false,
            "US_PWD_LEN_MIN": 3,
            "US_PWD_LEN_MAX": 0,
            "US_MAIL": ["mail"],
            "US_KIND": "description",
            "US_IS_ADDRESSBOOK": true,
            "US_AUTO_SEARCH": false,
            "US_AUTO_QUERY_LIMIT": 0,
            "US_HAS_RESOURCE": true,
            "US_RESOURCE_MULTIBOOKING": "departmentNumber"
          }
        },
        "USER_MODULE_SETTINGS": {
          "SOGO_D_MODULE_ACCESS": ["mail","calendar","contact"],
          "SOGO_D_MAPI_ACCESS": false,
          "SOGO_D_EAS_ACCESS": false,
          "SOGO_D_AUTOCOMPLETION_MIN_LEN": 2,
          "SOGO_D_API_MAX_REQUEST": 0,
          "SOGO_D_API_MAX_REQUEST_INTERVAL": 30,
          "SOGO_D_API_MAX_REQUEST_BLOCK_INTERVAL": 300,
          "SOGO_D_IDENTITIES_ENABLED": true,
          "SOGO_D_IDENTITIES_CUSTOM_FROM_ENABLED": true,
          "SOGO_D_IDENTITIES_CUSTOM_NAME_ENABLED": true,
          "SOGO_D_IDENTITIES_CUSTOM_REPLY_TO_ENABLED": true,
          "SOGO_D_ALLOW_EXT_MAIL_ACCOUNT": true,
          "SOGO_D_SIGNATURE_SIZE_LIMIT": 200,
          "SOGO_D_ALLOW_EXT_AVATAR": true,
          "SOGO_D_MAIL_REFRESH_INTERVAL_ALLOWED": [0,1,2,5,10,20,30,60]
        },
        "MAIL_SETTINGS": {
          "SOGO_D_MAIL_SERVER_TYPE": "imap",
          "SOGO_D_IMAP_SERVER": "sogo6-stalwart",
          "SOGO_D_IMAP_PORT": 20993,
          "SOGO_D_IMAP_ENCRYPTION": "SSL/TLS",
          "SOGO_D_IMAP_AUTH_MECH": "login",
          "SOGO_D_SOFT_EMAIL_QUOTA": 10000,
          "SOGO_D_MAIL_PURGE_ALLOW": true,
          "SOGO_D_MAIL_PURGE_MIN_DATE": 0,
          "SOGO_D_MAIL_DRAFT_AUTOSAVE": 5,
          "SOGO_D_MAIL_FILTERING_ENABLED": true,
          "SOGO_D_MAIL_FILTERING_TYPE": "sieve",
          "SOGO_D_SIEVE_SERVER": "sogo6-stalwart",
          "SOGO_D_SIEVE_PORT": 24190,
          "SOGO_D_SIEVE_ENCRYPTION": "SSL/TLS",
          "SOGO_D_SIEVE_AUTH_MECH": "plain",
          "SOGO_D_MAIL_OUTGOING_TYPE": "smtp",
          "SOGO_D_SMTP_SERVER": "sogo6-stalwart",
          "SOGO_D_SMTP_PORT": 20587,
          "SOGO_D_SMTP_ENCRYPTION": "SSL/TLS",
          "SOGO_D_SMTP_AUTH_MECH": "plain"
        }
      }
    }'

    local response
    response=$(api_call "PATCH" "/api/admin/v1/config/domain-default" "$domain_default_data" "$jwt_token" 3)
    local error_code
    error_code=$(extract_error_code "$response")

    if [[ "$error_code" == "S000000" ]]; then
        log_success "Domain-default settings configured"
    else
        log_warning "Domain-default settings may already be configured"
    fi
}

create_domain() {
    local jwt_token="$1"

    if $SKIP_DOMAIN; then
        log_info "Skipping domain creation (--skip-domain flag)"
        return 0
    fi

    log_info "Creating domain: $DOMAIN..."

    local ldap_dc="$(domain_to_dc "$DOMAIN")"
    local settings_json
    settings_json=$(echo '{
      "domain_description": "Default domain for SOGo 6 evaluation",
      "domain_info": {"mail_server": "internal", "user_source": "ldap"},
      "settings": {
        "AUTH_SETTINGS": {
          "SOGO_D_AUTH_TYPE": "plain",
          "SOGO_D_PWD_CHANGE_ENABLED": true,
          "SOGO_D_PWD_RECOVERY": false,
          "SOGO_D_LOGIN_MFA": false
        },
        "USER_SOURCE": {
          "ldap_main": {
            "US_UID": "ldap_main",
            "US_NAME": "LDAP Users",
            "US_TYPE": "ldap",
            "US_LDAP_HOSTNAME": "sogo6-ldap",
            "US_LDAP_PORT": 389,
            "US_LDAP_BIND_DN": "cn=admin,'"$ldap_dc"'",
            "US_LDAP_BIND_DN_PWD": "admin",
            "US_LDAP_BASE_DN": "ou=users,'"$ldap_dc"'",
            "US_LDAP_UID": "uid",
            "US_CAN_AUTH": true,
            "US_MAIL": ["mail"],
            "US_IS_ADDRESSBOOK": true,
            "US_HAS_RESOURCE": true
          }
        },
        "USER_MODULE_SETTINGS": {
          "SOGO_D_MODULE_ACCESS": ["mail","calendar","contact"]
        },
        "MAIL_SETTINGS": {
          "SOGO_D_MAIL_SERVER_TYPE": "imap",
          "SOGO_D_IMAP_SERVER": "sogo6-stalwart",
          "SOGO_D_IMAP_PORT": 20993,
          "SOGO_D_IMAP_ENCRYPTION": "SSL/TLS",
          "SOGO_D_SIEVE_SERVER": "sogo6-stalwart",
          "SOGO_D_SIEVE_PORT": 24190,
          "SOGO_D_SIEVE_ENCRYPTION": "SSL/TLS",
          "SOGO_D_SMTP_SERVER": "sogo6-stalwart",
          "SOGO_D_SMTP_PORT": 20587,
          "SOGO_D_SMTP_ENCRYPTION": "SSL/TLS"
        }
      }
    }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d))")

    local response
    response=$(api_call "POST" "/api/admin/v1/config/domains" "$settings_json" "$jwt_token" 3)
    local error_code
    error_code=$(extract_error_code "$response")

    if [[ "$error_code" == "S000000" ]]; then
        log_success "Domain $DOMAIN created successfully"
    elif [[ "$error_code" == "S000303" ]]; then
        log_success "Domain $DOMAIN already exists"
    else
        log_warning "Domain creation issue: $response"
    fi
}

verify_system() {
    log_info "Verifying system state..."

    local response
    response=$(api_call "GET" "/api/user/v1/system" "" "" 3)
    local system_state
    system_state=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('system',{}).get('sogo_state','unknown'))" 2>/dev/null || echo "unknown")

    if [[ "$system_state" != "" && "$system_state" != "unknown" ]]; then
        log_success "System state: $system_state"
    else
        log_warning "Could not verify system state"
    fi
}

main() {
    if ! wait_for_dependencies; then
        log_error "Dependency check failed"
        exit 1
    fi

    echo ""

    if check_already_initialized; then
        echo ""
        log_info "Initialization already complete. Skipping."
        verify_system
        echo ""
        print_summary
        exit 0
    fi

    if ! command -v python3 &>/dev/null; then
        log_error "python3 is required but not found"
        exit 1
    fi

    if ! command -v curl &>/dev/null; then
        log_error "curl is required but not found"
        exit 1
    fi

    log_info "Logging in as admin..."
    local jwt_token
    if ! jwt_token=$(admin_login); then
        exit 1
    fi
    log_success "Admin login successful"

    echo ""

    configure_system_settings "$jwt_token"

    echo ""

    configure_domain_default "$jwt_token"

    echo ""

    create_domain "$jwt_token" "$DOMAIN"

    echo ""

    verify_system

    echo ""
    print_summary
}

print_summary() {
    echo "=========================================="
    echo "  SOGo 6 Initialization Complete"
    echo "=========================================="
    echo ""
    echo "Server:     ${SERVER_URL}"
    echo "Domain:     ${DOMAIN}"
    echo ""
    echo "UI:         ${SERVER_URL//:5001/:3000}"
    echo "Admin API:  ${SERVER_URL}"
    echo ""
    echo "Mail Services:"
    echo "  IMAP:      sogo6-stalwart:20993 (TLS)"
    echo "  SMTP:      sogo6-stalwart:20587 (TLS)"
    echo "  Sieve:     sogo6-stalwart:24190 (TLS)"
    echo ""
    echo "LDAP Services:"
    echo "  Host:      sogo6-ldap:389"
    echo "  Base DN:   dc=${DOMAIN//./,dc=}"
    echo ""
    echo "Test users: testuser@${DOMAIN}, testadmin@${DOMAIN}, testuser2@${DOMAIN}"
    echo "Password:   See init.ldif and README.md"
    echo ""
}

main "$@"
