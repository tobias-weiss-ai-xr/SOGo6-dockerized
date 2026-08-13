#!/bin/bash
# typecheck-gate.sh — TypeScript regression gate for sogo6-ui
#
# Runs `tsc --noEmit` and compares the error count against a baseline.
#   - FAILS if the count is HIGHER than the baseline (new errors introduced)
#   - PASSES with a warning if equal (pre-existing debt, unchanged)
#   - PASSES if lower (progress — update the baseline)
#
# Baseline lives in scripts/tsc-error-baseline.txt (the count only).
# After fixing errors, update the baseline:  bash scripts/typecheck-gate.sh --update
#
# Usage:
#   bash scripts/typecheck-gate.sh [--update] [--verbose]

set -uo pipefail

UI_DIR="sogo6-ui"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASELINE_FILE="$SCRIPT_DIR/tsc-error-baseline.txt"

UPDATE_MODE=0
VERBOSE=0
for arg in "$@"; do
  case "$arg" in
    --update) UPDATE_MODE=1 ;;
    --verbose) VERBOSE=1 ;;
  esac
done

if [ ! -f "$BASELINE_FILE" ]; then
  echo "::error::Baseline file missing: $BASELINE_FILE (run with --update first)"
  exit 1
fi
BASELINE=$(cat "$BASELINE_FILE" | tr -d '[:space:]')
if ! [[ "$BASELINE" =~ ^[0-9]+$ ]]; then
  echo "::error::Baseline is not a number: '$BASELINE'"
  exit 1
fi

echo "→ Running tsc --noEmit (baseline: $BASELINE errors)..."
cd "$SCRIPT_DIR/.." || exit 1
cd "$UI_DIR" || exit 1

OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT=$?
COUNT=$(echo "$OUTPUT" | grep -c "error TS" || true)

if [ $TSC_EXIT -ne 0 ] && [ "$COUNT" -eq 0 ]; then
  echo "::error::tsc exited $TSC_EXIT but no 'error TS' lines found — non-type failure"
  echo "$OUTPUT" | tail -20
  exit 1
fi

echo "→ tsc reported $COUNT errors (baseline: $BASELINE)"

if [ "$COUNT" -gt "$BASELINE" ]; then
  NEW=$((COUNT - BASELINE))
  echo "::error::$NEW NEW TypeScript errors introduced (was $BASELINE, now $COUNT). Fix them before merging."
  if [ "$VERBOSE" = "1" ]; then
    echo "$OUTPUT" | grep "error TS" | head -30
  else
    echo "→ Run 'bash scripts/typecheck-gate.sh --verbose' locally to see the new errors."
    echo "→ New error locations:"
    echo "$OUTPUT" | grep "error TS" | cut -d'(' -f1 | sort | uniq -c | sort -rn | head -15
  fi
  exit 1
elif [ "$COUNT" -eq "$BASELINE" ]; then
  if [ "$UPDATE_MODE" = "1" ]; then
    echo "$COUNT" > "$BASELINE_FILE"
    echo "→ Baseline unchanged ($COUNT)."
  else
    echo "::warning::TypeScript error count unchanged at $COUNT — pre-existing debt, not blocking."
  fi
  exit 0
else
  FIXED=$((BASELINE - COUNT))
  echo "::notice::$FIXED TypeScript errors fixed since baseline ($BASELINE → $COUNT)!"
  if [ "$UPDATE_MODE" = "1" ]; then
    echo "$COUNT" > "$BASELINE_FILE"
    echo "→ Baseline updated to $COUNT."
  else
    echo "→ Update the baseline with: bash scripts/typecheck-gate.sh --update"
  fi
  exit 0
fi
