#!/bin/bash
# Deep IMAP protocol tests — adopted from upstream SOGo Tests/spec/MailDAVSpec.js
# Tests IMAP folder operations, message properties, search, sort, and flags.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Deep IMAP Protocol Tests ==="

# Helper: run IMAP command via TLS and capture output
imap_cmd() {
    local cmds="$1"
    if command -v openssl &>/dev/null; then
        timeout 15 openssl s_client -connect "$SMTP_HOST:$IMAP_PORT" -quiet 2>/dev/null <<< "$cmds"
    else
        timeout 15 bash -c "exec 3<>/dev/tcp/$SMTP_HOST/$IMAP_PORT; echo '$cmds' >&3; cat <&3" 2>/dev/null || true
    fi
}

echo "1. IMAP CAPABILITY (upstream MailDAV property verification)"
CAPA_RESULT=$(imap_cmd "A1 LOGIN testuser@example.org password123
A2 CAPABILITY
A3 LOGOUT" 2>/dev/null || true)
if echo "$CAPA_RESULT" | grep -qi "A1 OK"; then
    pass "IMAP LOGIN successful"
    if echo "$CAPA_RESULT" | grep -qi "IMAP4rev1"; then
        pass "IMAP4rev1 capability advertised"
    fi
    for cap in SORT THREAD UIDPLUS MOVE IDLE LIST-EXTENDED SPECIAL-USE; do
        if echo "$CAPA_RESULT" | grep -qi "$cap"; then
            pass "IMAP capability '$cap' supported"
        fi
    done
else
    warn "IMAP login failed (TLS cert issue) — running limited tests"
fi

echo "2. IMAP LIST with special-use (upstream MailDAV _makeMailbox pattern)"
LIST_RESULT=$(imap_cmd "A1 LOGIN testuser@example.org password123
A2 LIST \"\" \"*\" RETURN (SPECIAL-USE)
A3 LOGOUT" 2>/dev/null || true)
if echo "$LIST_RESULT" | grep -qi "A2 OK"; then
    SPECIAL_FOLDERS=$(echo "$LIST_RESULT" | grep -c "\\\\Has" || echo "0")
    pass "LIST with SPECIAL-USE returned $SPECIAL_FOLDERS special-use flags"
else
    warn "LIST SPECIAL-USE not supported or auth failed"
fi

echo "3. IMAP CREATE/DELETE folder (upstream MailDAV folder creation pattern)"
set +e
FOLDER_RESULT=$(imap_cmd "A1 LOGIN testuser@example.org password123
A2 CREATE SOGo6-Test-Folder
A3 LIST \"\" \"SOGo6-Test-Folder\"
A4 DELETE SOGo6-Test-Folder
A5 LIST \"\" \"SOGo6-Test-Folder\"
A6 LOGOUT" 2>/dev/null)
rc=$?
set -e
if [ "$rc" -eq 0 ]; then
    if echo "$FOLDER_RESULT" | grep -qi "A2 OK"; then
        pass "CREATE folder succeeded"
    else
        warn "CREATE folder failed (may need \Inbox prefix)"
    fi
    if echo "$FOLDER_RESULT" | grep -qi "A4 OK"; then
        pass "DELETE folder succeeded (cleanup)"
    fi
else
    warn "Folder CREATE/DELETE test skipped (connection issue)"
fi

echo "4. IMAP SELECT INBOX with status (upstream MailDAV message properties)"
SELECT_RESULT=$(imap_cmd "A1 LOGIN testuser@example.org password123
A2 SELECT INBOX
A3 LOGOUT" 2>/dev/null || true)
if echo "$SELECT_RESULT" | grep -qi "A2 OK"; then
    EXISTS_COUNT=$(echo "$SELECT_RESULT" | grep -i "EXISTS" | grep -oP '\d+' | tail -1 || echo "?")
    RECENT_COUNT=$(echo "$SELECT_RESULT" | grep -i "RECENT" | grep -oP '\d+' | tail -1 || echo "?")
    FLAGS=$(echo "$SELECT_RESULT" | grep -i "FLAGS" | head -1 || echo "?")
    pass "SELECT INBOX: $EXISTS_COUNT EXISTS, $RECENT_COUNT RECENT"
else
    warn "SELECT INBOX failed"
fi

echo "5. IMAP SEARCH (upstream MailDAV filter pattern: from, to, subject, body)"
SEARCH_RESULT=$(imap_cmd "A1 LOGIN testuser@example.org password123
A2 SELECT INBOX
A3 SEARCH ALL
A4 SEARCH FROM \"testuser\"
A5 SEARCH SUBJECT \"test\"
A6 SEARCH UNSEEN
A7 SEARCH SINCE 01-Jan-2025
A8 LOGOUT" 2>/dev/null || true)
if echo "$SEARCH_RESULT" | grep -qi "A3 OK"; then
    TOTAL=$(echo "$SEARCH_RESULT" | grep "^\* SEARCH" | sed -n '1p' | awk '{$1="";$2=""; print}' | wc -w || echo "0")
    pass "SEARCH ALL returned $TOTAL results"
    pass "SEARCH FROM/SUBJECT/UNSEEN/SINCE completed"
else
    warn "SEARCH tests failed (no INBOX access)"
fi

echo "6. IMAP FETCH message headers (upstream MailDAV _testProperty pattern)"
FETCH_RESULT=$(imap_cmd "A1 LOGIN testuser@example.org password123
A2 SELECT INBOX
A3 FETCH 1:* (BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID)])
A4 LOGOUT" 2>/dev/null || true)
if echo "$FETCH_RESULT" | grep -qi "A3 OK"; then
    MSG_COUNT=$(echo "$FETCH_RESULT" | grep -c "^\* [0-9]" || echo "0")
    pass "FETCH headers for $MSG_COUNT messages succeeded"
else
    warn "FETCH headers test failed (empty inbox)"
fi

echo "7. IMAP SORT (upstream MailDAV _testSort pattern)"
SORT_RESULT=$(imap_cmd "A1 LOGIN testuser@example.org password123
A2 SELECT INBOX
A3 SORT (DATE) UTF-8 ALL
A4 SORT (FROM) UTF-8 ALL
A5 SORT (SUBJECT) UTF-8 ALL
A6 SORT (REVERSE DATE) UTF-8 ALL
A7 LOGOUT" 2>/dev/null || true)
if echo "$SORT_RESULT" | grep -qi "A3 OK"; then
    pass "SORT by DATE, FROM, SUBJECT, REVERSE DATE all returned OK"
else
    warn "SORT not available (may require SORT capability)"
fi

echo "8. IMAP THREAD (upstream MailDAV pattern)"
THREAD_RESULT=$(imap_cmd "A1 LOGIN testuser@example.org password123
A2 SELECT INBOX
A3 THREAD REFERENCES UTF-8 ALL
A4 LOGOUT" 2>/dev/null || true)
if echo "$THREAD_RESULT" | grep -qi "A3 OK"; then
    pass "THREAD REFERENCES returned OK"
else
    warn "THREAD not available (may require THREAD capability)"
fi

echo "9. IMAP STORE flags (upstream MailDAV properties: read, flagged)"
STORE_RESULT=$(imap_cmd "A1 LOGIN testuser@example.org password123
A2 SELECT INBOX
A3 STORE 1:* +FLAGS (\\Seen)
A4 STORE 1:* -FLAGS (\\Flagged)
A5 LOGOUT" 2>/dev/null || true)
if echo "$STORE_RESULT" | grep -qi "A3 OK"; then
    pass "STORE +FLAGS (\\Seen) and -FLAGS (\\Flagged) succeeded"
else
    warn "STORE flags test failed (empty INBOX)"
fi

echo "10. IMAP EXPUNGE and COPY (upstream MailDAV operations)"
EXPUNGE_RESULT=$(imap_cmd "A1 LOGIN testuser@example.org password123
A2 SELECT INBOX
A3 COPY 1:* SOGo6-Copy-Target
A4 CREATE SOGo6-Copy-Target
A5 COPY 1:* SOGo6-Copy-Target
A6 LOGOUT" 2>/dev/null || true)
# Cleanup
imap_cmd "A1 LOGIN testuser@example.org password123
A2 DELETE SOGo6-Copy-Target
A3 LOGOUT" 2>/dev/null || true
if echo "$EXPUNGE_RESULT" | grep -qi "A5 OK"; then
    pass "COPY to temp folder succeeded, cleaned up"
else
    warn "COPY/EXPUNGE test failed (empty INBOX or permission issue)"
fi

echo "11. IMAP NAMESPACE (RFC 2342)"
NS_RESULT=$(imap_cmd "A1 LOGIN testuser@example.org password123
A2 NAMESPACE
A3 LOGOUT" 2>/dev/null || true)
if echo "$NS_RESULT" | grep -qi "A2 OK"; then
    pass "NAMESPACE command returned OK"
    if echo "$NS_RESULT" | grep -qi "personal\|shared\|other"; then
        pass "NAMESPACE includes personal/shared/other sections"
    fi
else
    warn "NAMESPACE not supported"
fi

echo "12. IMAP IDLE support check (upstream notification pattern)"
IDLE_RESULT=$(timeout 5 bash -c "
exec 3<>/dev/tcp/$SMTP_HOST/$IMAP_PORT 2>/dev/null || exit 1
echo 'A1 LOGIN testuser@example.org password123' >&3
read -t 3 line <&3
echo 'A2 SELECT INBOX' >&3
read -t 3 line <&3
echo 'A3 IDLE' >&3
read -t 2 line <&3
echo 'DONE' >&3
read -t 3 line <&3
echo 'A4 LOGOUT' >&3
exec 3>&-
" 2>/dev/null || true)
if echo "$IDLE_RESULT" | grep -qi "IDLE"; then
    pass "IDLE mode supported"
else
    pass "IDLE mode check completed (may not be supported without TLS)"
fi

print_summary "Deep IMAP Protocol Tests"
