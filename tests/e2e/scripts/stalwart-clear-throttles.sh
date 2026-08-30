#!/bin/sh
# SPDX-FileCopyrightText: 2025 SOGo project contributors
# SPDX-License-Identifier: LGPL-2.1-only
#
# Clear Stalwart's default rate-limit throttles for the LOCAL/CI test stack.
#
# Why: Stalwart seeds "Sender IP throttle" and "Sender address to recipient
# throttle" into its settings store on first boot. Sustained bursts of
# authenticated submissions (which the parallel Playwright suite produces)
# trip them with "452 4.4.5 Rate limit exceeded", and the counter PERSISTS in
# the store across restarts, locking the suite out for a long window.
#
# This script deletes those two settings rows (local test stack only — do NOT
# point it at a production instance), then restarts the container.
#
# Usage:  tests/e2e/scripts/stalwart-clear-throttles.sh [container_name]
set -e

CONTAINER="${1:-sogo6-stalwart}"

VOLUME=$(docker inspect "$CONTAINER" --format \
  '{{range .Mounts}}{{if eq .Destination "/var/lib/stalwart"}}{{.Name}}{{end}}{{end}}')
if [ -z "$VOLUME" ]; then
  echo "error: $CONTAINER has no /var/lib/stalwart volume" >&2
  exit 1
fi

echo "stopping $CONTAINER ..."
docker stop "$CONTAINER" >/dev/null

echo "removing default throttle settings from $VOLUME ..."
docker run --rm -v "$VOLUME":/data --user 0 python:3.12-slim sh -c '
python3 - <<"EOF"
import sqlite3
con = sqlite3.connect("/data/data.db")
rows = con.execute("SELECT k, v FROM s").fetchall()
gone = 0
for k, v in rows:
    if b"Sender IP throttle" in v or b"Sender address to recipient throttle" in v:
        con.execute("DELETE FROM s WHERE k = ?", (k,))
        gone += 1
con.commit()
print(f"removed {gone} throttle settings")
EOF
rm -f /data/data.db-shm /data/data.db-wal
chown 2000:2000 /data/data.db'

echo "starting $CONTAINER ..."
docker start "$CONTAINER" >/dev/null
sleep 5
docker ps --format '{{.Names}} {{.Status}}' | grep "$CONTAINER"
echo "done — SMTP 452 rate limiting is disabled for this test stack."
