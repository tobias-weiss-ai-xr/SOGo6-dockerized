#!/bin/bash
# OpenSpec Validation Script
# Validates all OpenSpec specifications across root, server, and UI repositories

set -e

echo "=========================================="
echo "  OpenSpec Validation Script"
echo "  SOGo6 Stalwart OpenLDAP Dockerized"
echo "=========================================="
echo

ERRORS=0
WARNINGS=0
TOTAL_CHECKS=0

# Function to validate a directory
validate_specs() {
    local dir=$1
    local name=$2
    
    echo "Validating ${name}..."
    echo "  Directory: ${dir}/.openspec/"
    
    if [ ! -d "$dir/.openspec" ]; then
        echo "  ERROR: .openspec/ directory does not exist"
        ERRORS=$((ERRORS + 1))
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        echo
        return 1
    fi
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo "  PASS: .openspec/ directory exists"
    
    # Check for project.spec.md
    if [ ! -f "$dir/.openspec/project.spec.md" ]; then
        echo "  ERROR: project.spec.md missing"
        ERRORS=$((ERRORS + 1))
    else
        LINES=$(wc -l < "$dir/.openspec/project.spec.md")
        echo "  PASS: project.spec.md (${LINES} lines)"
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    # Check for specs directory
    if [ ! -d "$dir/.openspec/specs" ]; then
        echo "  WARNING: specs/ directory missing"
        WARNINGS=$((WARNINGS + 1))
    else
        echo "  PASS: specs/ directory exists"
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    # Count and validate spec files
    SPEC_COUNT=$(find "$dir/.openspec/specs" -name "*.spec.md" | wc -l | tr -d ' ')
    if [ "$SPEC_COUNT" -gt 0 ]; then
        echo "  PASS: Found ${SPEC_COUNT} specification files"
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    else
        echo "  WARNING: No specification files found in specs/"
        WARNINGS=$((WARNINGS + 1))
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    fi
    
    # Count change files
    CHANGE_COUNT=$(find "$dir/.openspec/changes" -name "*.change.md" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$CHANGE_COUNT" -gt 0 ]; then
        echo "  PASS: Found ${CHANGE_COUNT} change files"
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    else
        echo "  WARNING: No change files found in changes/"
        WARNINGS=$((WARNINGS + 1))
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    fi
    
    # Check for .gitignore
    if [ -f "$dir/.openspec/.gitignore" ]; then
        echo "  PASS: .gitignore exists"
    else
        echo "  WARNING: .gitignore missing"
        WARNINGS=$((WARNINGS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    # Try to validate with OpenSpec CLI if available
    if which openspec > /dev/null 2>&1; then
        echo "  Checking OpenSpec CLI compatibility..."
        cd "$dir" > /dev/null 2>&1
        if openspec list --specs 2>&1 | head -1 | grep -qi "error\|unknown\|no items"; then
            echo "    WARNING: OpenSpec CLI: Unable to list specs (may need configuration)"
            WARNINGS=$((WARNINGS + 1))
        else
            echo "    PASS: OpenSpec CLI: Specs listable"
        fi
        cd - > /dev/null 2>&1
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    else
        echo "  WARNING: OpenSpec CLI not installed, skipping CLI validation"
        WARNINGS=$((WARNINGS + 1))
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    fi
    
    echo
}

echo "Checking File Sizes..."
echo

LARGE_FILES=$(find .openspec/ sogo6-server/.openspec/ sogo6-ui/.openspec/ -name "*.md" -type f -size +500k 2>/dev/null)
if [ -z "$LARGE_FILES" ]; then
    echo "  PASS: No files exceed 500KB"
else
    echo "  WARNING: Large files found (>500KB):"
    echo "$LARGE_FILES" | while read file; do
        SIZE=$(du -h "$file" | cut -f1)
        echo "    - $file ($SIZE)"
        WARNINGS=$((WARNINGS + 1))
    done
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo
echo "Checking Line Counts..."
echo

VERY_LONG_FILES=$(find .openspec/ sogo6-server/.openspec/ sogo6-ui/.openspec/ -name "*.md" -type f -exec wc -l {} \; 2>/dev/null | awk '$1 > 2000 {print $2}')
if [ -z "$VERY_LONG_FILES" ]; then
    echo "  PASS: No files exceed 2000 lines"
else
    echo "  WARNING: Very long files found (>2000 lines):"
    echo "$VERY_LONG_FILES" | while read file; do
        LINES=$(wc -l < "$file" 2>/dev/null)
        echo "    - $file ($LINES lines)"
        WARNINGS=$((WARNINGS + 1))
    done
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo
echo "=========================================="
echo "  Repository Validation"
echo "=========================================="
echo

# Validate root repo
validate_specs "." "Root Repository"

# Validate sogo6-server
if [ -d "sogo6-server/.openspec" ]; then
    validate_specs "sogo6-server" "SOGo6 Server Submodule"
else
    echo "ERROR: SOGo6 Server: .openspec/ directory not found"
    ERRORS=$((ERRORS + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo
fi

# Validate sogo6-ui (if exists)
if [ -d "sogo6-ui/.openspec" ]; then
    validate_specs "sogo6-ui" "SOGo6 UI Submodule"
else
    echo "WARNING: SOGo6 UI: .openspec/ directory not found (submodule may not be checked out)"
    WARNINGS=$((WARNINGS + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo
fi

echo "=========================================="
echo "  Summary"
echo "=========================================="
echo
echo "  Total Checks:    ${TOTAL_CHECKS}"
echo "  Passed:          $((TOTAL_CHECKS - ERRORS - WARNINGS))"
echo "  Warnings:        ${WARNINGS}"
echo "  Errors:          ${ERRORS}"
echo

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo "  SUCCESS: All validations passed!"
        exit 0
    else
        echo "  WARNING: Validation passed with warnings"
        exit 0
    fi
else
    echo "  ERROR: Validation failed with ${ERRORS} error(s)"
    exit 1
fi
