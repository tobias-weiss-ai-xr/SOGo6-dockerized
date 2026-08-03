#!/bin/bash
# OpenSpec Validation Script
# Validates all specification files across the project

set -e

echo "=========================================="
echo "  OpenSpec Validation Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
TOTAL_ERRORS=0
TOTAL_WARNINGS=0

echo "📁 Finding all spec files..."
echo ""

# Get all markdown files
SPEC_FILES=$(find .openspec/ sogo6-server/.openspec/ sogo6-ui/.openspec/ -type f -name "*.md" 2>/dev/null)
CHANGE_FILES=$(find .openspec/ sogo6-server/.openspec/ sogo6-ui/.openspec/ -type f -name "*.change.md" 2>/dev/null)
SPEC_MD_FILES=$(find .openspec/ sogo6-server/.openspec/ sogo6-ui/.openspec/ -type f -name "*.spec.md" 2>/dev/null)

echo "📊 File counts:"
echo "  - Total .md files: $(echo "$SPEC_FILES" | wc -l)"
echo "  - .spec.md files: $(echo "$SPEC_MD_FILES" | wc -l)"
echo "  - .change.md files: $(echo "$CHANGE_FILES" | wc -l)"
echo ""

# ==========================================
# 1. OpenSpec Validation
# ==========================================
echo "=========================================="
echo "🔍 Step 1: OpenSpec Structure Validation"
echo "=========================================="
echo ""

for repo in .openspec sogo6-server/.openspec sogo6-ui/.openspec; do
    echo "📂 Validating $repo..."
    
    if [ -d "$repo" ]; then
        # Check for required structure
        if [ -f "$repo/project.spec.md" ]; then
            echo "  ✅ project.spec.md exists"
        else
            echo "  ❌ project.spec.md missing"
            ((TOTAL_ERRORS++)) || true
        fi
        
        if [ -d "$repo/specs" ]; then
            echo "  ✅ specs/ directory exists"
        else
            echo "  ❌ specs/ directory missing"
            ((TOTAL_ERRORS++)) || true
        fi
        
        if [ -d "$repo/changes" ]; then
            echo "  ✅ changes/ directory exists"
        else
            echo "  ❌ changes/ directory missing"
            ((TOTAL_WARNINGS++)) || true
        fi
        
        if [ -f "$repo/.gitignore" ]; then
            echo "  ✅ .gitignore exists"
        else
            echo "  ❌ .gitignore missing"
            ((TOTAL_WARNINGS++)) || true
        fi
    else
        echo "  ⚠️  Directory not found"
        ((TOTAL_ERRORS++)) || true
    fi
    
    echo ""
done

# ==========================================
# 2. Markdown Link Checking
# ==========================================
echo "=========================================="
echo "🔗 Step 2: Internal Link Validation"
echo "=========================================="
echo ""

# Create a simple link checker script
echo "🔍 Checking for broken internal links..."

# Find all links in spec files and check if they exist
LINK_ERRORS=0

for file in $(find .openspec/ sogo6-server/.openspec/ sogo6-ui/.openspec/ -type f -name "*.md" 2>/dev/null); do
    # Extract relative links (not http:// or https://)
    LINKS=$(grep -oE '\([^)]+\)' "$file" 2>/dev/null | grep -v '^http' | grep -v '^#' | sort -u || true)
    
    for link in $LINKS; do
        # Clean the link
        CLEAN_LINK=$(echo "$link" | sed 's/[()]//g' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
        
        # Skip empty links
        if [ -z "$CLEAN_LINK" ]; then
            continue
        fi
        
        # Get directory of current file
        FILE_DIR=$(dirname "$file")
        
        # Check if link exists
        if [ -f "$FILE_DIR/$CLEAN_LINK" ] || [ -f "$CLEAN_LINK" ]; then
            : # Link exists, do nothing
        else
            # Check if it's just a filename without directory
            if [ -f "$CLEAN_LINK" ]; then
                : # Link exists
            else
                echo "  ⚠️  Possible broken link in $file: $CLEAN_LINK"
                ((LINK_ERRORS++)) || true
            fi
        fi
    done
done

if [ $LINK_ERRORS -eq 0 ]; then
    echo "  ✅ No obvious broken links found"
else
    echo "  ⚠️  Found $LINK_ERRORS potential broken links (manual review recommended)"
    ((TOTAL_WARNINGS+=LINK_ERRORS)) || true
fi

echo ""

# ==========================================
# 3. Markdown Linting
# ==========================================
echo "=========================================="
echo "📝 Step 3: Markdown Linting"
echo "=========================================="
echo ""

LINT_OUTPUT=$(markdownlint .openspec/**/*.md sogo6-server/.openspec/**/*.md sogo6-ui/.openspec/**/*.md 2>&1 || true)

if [ -z "$LINT_OUTPUT" ]; then
    echo "  ✅ All Markdown files pass linting"
else
    echo "  ⚠️  Markdown linting issues found:"
    echo "$LINT_OUTPUT" | head -20
    echo "  ... (showing first 20 issues)"
    
    # Count issues
    LINT_COUNT=$(echo "$LINT_OUTPUT" | wc -l)
    ((TOTAL_WARNINGS+=LINT_COUNT)) || true
fi

echo ""

# ==========================================
# 4. Spelling Check
# ==========================================
echo "=========================================="
echo "📖 Step 4: Spelling Check"
echo "=========================================="
echo ""

SPELL_OUTPUT=$(codespell .openspec/ sogo6-server/.openspec/ sogo6-ui/.openspec/ 2>&1 || true)

if [ -z "$SPELL_OUTPUT" ]; then
    echo "  ✅ No spelling errors found"
else
    echo "  ⚠️  Spelling issues found:"
    echo "$SPELL_OUTPUT" | head -20
    echo "  ... (showing first 20 issues)"
    
    # Count issues
    SPELL_COUNT=$(echo "$SPELL_OUTPUT" | wc -l)
    ((TOTAL_WARNINGS+=SPELL_COUNT)) || true
fi

echo ""

# ==========================================
# 5. File Structure Verification
# ==========================================
echo "=========================================="
echo "📂 Step 5: File Structure Verification"
echo "=========================================="
echo ""

echo "📊 File inventory:"
echo ""

for repo in .openspec sogo6-server/.openspec sogo6-ui/.openspec; do
    echo "  $repo/:"
    if [ -d "$repo" ]; then
        echo "    - project.spec.md: $(test -f "$repo/project.spec.md" && echo '✅' || echo '❌')"
        echo "    - specs/: $(test -d "$repo/specs" && echo '✅' || echo '❌')"
        echo "    - changes/: $(test -d "$repo/changes" && echo '✅' || echo '❌')"
        echo "    - .gitignore: $(test -f "$repo/.gitignore" && echo '✅' || echo '❌')"
        
        SPEC_COUNT=$(find "$repo/specs" -name "*.spec.md" 2>/dev/null | wc -l)
        CHANGE_COUNT=$(find "$repo/changes" -name "*.change.md" 2>/dev/null | wc -l)
        echo "    - .spec.md files: $SPEC_COUNT"
        echo "    - .change.md files: $CHANGE_COUNT"
    else
        echo "    ❌ Directory not found"
        ((TOTAL_ERRORS++)) || true
    fi
    echo ""
done

# ==========================================
# 6. Summary
# ==========================================
echo "=========================================="
echo "📊 Validation Summary"
echo "=========================================="
echo ""

echo "Results:"
echo "  Errors:   $TOTAL_ERRORS"
echo "  Warnings: $TOTAL_WARNINGS"
echo ""

if [ $TOTAL_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Validation PASSED${NC}"
    echo ""
    echo "All OpenSpec files are properly structured and ready for use."
else
    echo -e "${RED}❌ Validation FAILED${NC}"
    echo ""
    echo "Please fix the errors before proceeding."
fi

echo ""
echo "=========================================="
echo "  Validation Complete"
echo "=========================================="

# Exit with error code if there were errors
if [ $TOTAL_ERRORS -gt 0 ]; then
    exit 1
fi
