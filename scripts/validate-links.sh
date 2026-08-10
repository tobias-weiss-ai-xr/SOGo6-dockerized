#!/bin/bash
# OpenSpec Link Validation Script
# Validates that all internal markdown links point to existing files

echo "=========================================="
echo "  OpenSpec Link Validation Script"
echo "  SOGo6 Stalwart OpenLDAP Dockerized"
echo "=========================================="
echo

ERRORS=0
TOTAL_LINKS=0
VALID_LINKS=0
LINK_LOG="" # Store results for output

echo "Scanning for markdown links..."
echo

# Find all markdown files in .openspec directories
MD_FILES=$(find .openspec/ sogo6-server/.openspec/ sogo6-ui/.openspec/ -name "*.md" -type f 2>/dev/null)

if [ -z "$MD_FILES" ]; then
    echo "ERROR: No markdown files found in .openspec/ directories"
    exit 1
fi

echo "  Found $(echo "$MD_FILES" | wc -l) markdown files"
echo

# Function to extract and validate links from a file
validate_file_links() {
    local file=$1
    local basedir=$(dirname "$file")
    
    echo "  Checking: $file"
    
    # Extract all markdown links: [text](url) or [text](url "title")
    grep -o '\[[^]]*\]([^)]*)' "$file" 2>/dev/null | while read -r match; do
        # Extract the URL part (between parentheses)
        url=$(echo "$match" | sed 's/.*(//;s/).*//')
        
        # Skip empty URLs
        if [ -z "$url" ]; then
            continue
        fi
        
        TOTAL_LINKS=$((TOTAL_LINKS + 1))
        
        # Skip URL fragments (anchor links)
        if [[ "$url" == \#* ]]; then
            echo "    PASS: Anchor link: $url"
            VALID_LINKS=$((VALID_LINKS + 1))
            continue
        fi
        
        # Skip external URLs (http://, https://, mailto:, etc.)
        if [[ "$url" =~ ^(https?://|http://|mailto:|ftp://|www\.) ]]; then
            echo "    PASS: External link: $url"
            VALID_LINKS=$((VALID_LINKS + 1))
            continue
        fi
        
        # Handle relative paths
        local target="$url"
        
        # If no extension, try .md
        if [[ "$url" != *.* ]]; then
            if [ -e "${basedir}/${url}.md" ]; then
                echo "    PASS: Relative link: $url -> ${url}.md"
                VALID_LINKS=$((VALID_LINKS + 1))
                continue
            elif [ -e "${basedir}/${url}" ]; then
                echo "    PASS: Relative link: $url"
                VALID_LINKS=$((VALID_LINKS + 1))
                continue
            fi
        fi
        
        # Check if file exists as-is
        if [ -e "${basedir}/${url}" ]; then
            echo "    PASS: Valid link: $url"
            VALID_LINKS=$((VALID_LINKS + 1))
            continue
        fi
        
        # Check in parent .openspec directory
        local openspec_basedir=$(echo "$basedir" | sed 's|/.openspec.*|/.openspec|')
        if [ -e "${openspec_basedir}/${url}" ]; then
            echo "    PASS: Valid link (in .openspec): $url"
            VALID_LINKS=$((VALID_LINKS + 1))
            continue
        fi
        
        # Check in sibling directories
        if [[ "$url" == specs/* ]]; then
            local spec_dir=$(echo "$basedir" | sed 's|/specs.*|/specs|')
            if [ -e "${spec_dir}/${url}" ]; then
                echo "    PASS: Valid link (in specs): $url"
                VALID_LINKS=$((VALID_LINKS + 1))
                continue
            fi
        fi
        
        # Check in changes directory
        if [[ "$url" == changes/* ]]; then
            local changes_dir=$(echo "$basedir" | sed 's|/changes.*|/changes|')
            if [ -e "${changes_dir}/${url}" ]; then
                echo "    PASS: Valid link (in changes): $url"
                VALID_LINKS=$((VALID_LINKS + 1))
                continue
            fi
        fi
        
        # If we get here, the link is broken
        echo "    ERROR: BROKEN LINK: $url (in $file)"
        ERRORS=$((ERRORS + 1))
        
    done
}

# Process each markdown file
for file in $MD_FILES; do
    validate_file_links "$file"
    echo
done

echo "=========================================="
echo "  Link Validation Summary"
echo "=========================================="
echo
echo "  Total links checked:  ${TOTAL_LINKS}"
echo "  Valid links:        ${VALID_LINKS}"
echo "  Broken links:       ${ERRORS}"
echo

if [ $ERRORS -eq 0 ]; then
    echo "  SUCCESS: All links are valid!"
    exit 0
else
    echo "  ERROR: $ERRORS broken link(s) found"
    exit 1
fi
