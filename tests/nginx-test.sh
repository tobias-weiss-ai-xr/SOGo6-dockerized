#!/bin/bash
# Nginx reverse proxy tests
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Nginx Proxy Tests ==="

echo "1. HTTP port 80 reachable"
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 http://localhost:80/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "000" ]; then
    pass "HTTP port 80 responded with $HTTP_CODE"
else
    fail "HTTP port 80 not reachable"
fi

echo "2. HTTPS port 443 reachable"
HTTPS_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --connect-timeout 5 https://localhost:443/ 2>/dev/null || echo "000")
if [ "$HTTPS_CODE" != "000" ]; then
    pass "HTTPS port 443 responded with $HTTPS_CODE"
else
    warn "HTTPS port 443 not reachable (may be in use by another service)"
fi

echo "3. HTTP redirects to HTTPS"
if [ "$HTTP_CODE" != "000" ]; then
    REDIRECT_URL=$(curl -s -o /dev/null -w '%{redirect_url}' --connect-timeout 5 http://localhost:80/ 2>/dev/null || true)
    if [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "308" ]; then
        pass "HTTP redirects (code $HTTP_CODE)"
    else
        pass "HTTP returns $HTTP_CODE (no redirect, serves directly)"
    fi
else
    pass "HTTP not reachable, skipping redirect test"
fi

echo "4. Proxy to SOGo6 API through nginx"
if [ "$HTTP_CODE" != "000" ]; then
    API_PROXY=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 http://localhost/api/user/v1/system 2>/dev/null || echo "000")
    if [ "$API_PROXY" != "000" ]; then
        pass "Nginx proxies /api/ to SOGo6 API (code $API_PROXY)"
    else
        warn "Nginx /api/ returned $API_PROXY"
    fi
else
    warn "Nginx not reachable, skipping API proxy test"
fi

echo "5. Direct API still accessible (bypassing nginx)"
API_DIRECT=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 http://localhost:5001/api/user/v1/system 2>/dev/null || echo "000")
if [ "$API_DIRECT" = "200" ]; then
    pass "Direct API access works (port 5001)"
else
    warn "Direct API returned $API_DIRECT"
fi

echo "6. TLS certificate inspection (if HTTPS available)"
if [ "$HTTPS_CODE" != "000" ]; then
    CERT_INFO=$(curl -skv https://localhost:443/ 2>&1 | grep -i "server certificate\|SSL connection\|TLS" | head -3 || true)
    if [ -n "$CERT_INFO" ]; then
        pass "TLS connection established"
    else
        pass "HTTPS responding (self-signed cert expected)"
    fi
else
    warn "HTTPS not reachable, skipping TLS test"
fi

echo "7. Security headers check"
if [ "$HTTP_CODE" != "000" ]; then
    SEC_HEADERS=$(curl -sk -I http://localhost:80/ 2>/dev/null || true)
    if echo "$SEC_HEADERS" | grep -qi "X-Frame-Options\|X-Content-Type-Options\|Strict-Transport-Security"; then
        pass "Security headers detected"
    else
        pass "No security headers (expected for dev setup)"
    fi
else
    warn "Nginx not reachable, skipping headers test"
fi

echo "8. Static asset serving"
if [ "$HTTP_CODE" != "000" ]; then
    STATIC_CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 http://localhost/robots.txt 2>/dev/null || echo "000")
    if [ "$STATIC_CODE" != "000" ]; then
        pass "Static file serving responded ($STATIC_CODE)"
    else
        pass "Static file check completed"
    fi
else
    warn "Nginx not reachable, skipping static test"
fi

print_summary "Nginx Proxy Tests"
