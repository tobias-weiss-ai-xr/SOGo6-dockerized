#!/bin/bash
# Generate self-signed TLS certificates for SOGo 6 evaluation
# Usage: bash sogo6/scripts/gen-certs.sh [output-dir]
# Example: bash sogo6/scripts/gen-certs.sh sogo6/nginx/certs

set -euo pipefail

OUTPUT_DIR="${1:-$(dirname "$0")/../nginx/certs}"
mkdir -p "$OUTPUT_DIR"

CERT_FILE="$OUTPUT_DIR/sogo6.crt"
KEY_FILE="$OUTPUT_DIR/sogo6.key"

# Only generate if cert doesn't exist
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  echo "Certificates already exist at $OUTPUT_DIR"
  exit 0
fi

echo "Generating self-signed certificates in $OUTPUT_DIR ..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -subj "/C=DE/ST=Hessen/L=Marburg/O=SOGo6-Eval/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 644 "$CERT_FILE"
chmod 600 "$KEY_FILE"

echo "Done:"
echo "  Cert: $CERT_FILE"
echo "  Key:  $KEY_FILE"
