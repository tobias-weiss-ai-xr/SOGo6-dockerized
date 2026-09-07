#!/bin/bash
# Wrapper script to run SOGo6 E2E tests with Redis rate limit cleared

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Step 1: Clear Redis rate limit counters
echo "Clearing Redis rate limit counters..."
docker exec $(docker ps -q --filter name=redis | head -1) redis-cli FLUSHALL 2>/dev/null || true
sleep 2

# Step 2: Kill any existing Playwright/Chromium processes
pkill -9 -f chromium 2>/dev/null || true
pkill -9 -f playwright 2>/dev/null || true
sleep 2

# Step 3: Run tests
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npx playwright test --reporter=list --timeout=90000

echo ""
echo "Test run complete!"
