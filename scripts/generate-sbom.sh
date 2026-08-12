#!/bin/bash
# generate-sbom.sh — Generate CycloneDX SBOMs for the SOGo6 stack (CRA Art. 13)
#
# Uses Trivy to produce SBOMs for:
#   - the repository (fs)
#   - the server image (image)
#   - the UI image (image)
#
# Requires: trivy (https://aquasecurity.github.io/trivy) and docker.
# Output: sbom/ directory with CycloneDX JSON files.

set -euo pipefail

OUT_DIR="sbom"
mkdir -p "$OUT_DIR"
echo "→ Generating SBOMs into $OUT_DIR/"

# 1. Repository filesystem SBOM (parent repo: infra + tests)
echo "  • repo (filesystem)..."
trivy fs --format cyclonedx --output "$OUT_DIR/sbom-repo.cdx.json" . || \
    echo "  ⚠ repo SBOM failed (continuing)"

# 2. Server image SBOM
if docker image inspect sogo6-server:latest >/dev/null 2>&1; then
    echo "  • sogo6-server image..."
    trivy image --format cyclonedx --output "$OUT_DIR/sbom-server.cdx.json" sogo6-server:latest || \
        echo "  ⚠ server SBOM failed (continuing)"
fi

# 3. UI image SBOM
if docker image inspect sogo6-ui:latest >/dev/null 2>&1; then
    echo "  • sogo6-ui image..."
    trivy image --format cyclonedx --output "$OUT_DIR/sbom-ui.cdx.json" sogo6-ui:latest || \
        echo "  ⚠ UI SBOM failed (continuing)"
fi

echo "✓ SBOMs written to $OUT_DIR/:"
ls -la "$OUT_DIR/"
