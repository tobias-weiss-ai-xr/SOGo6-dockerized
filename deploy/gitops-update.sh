#!/usr/bin/env bash
# GitOps pull-deploy: if origin/$BRANCH moved ahead of HEAD, hard-reset to it and
# recreate changed containers. Runs from cron; safe to re-run manually.
# ponytail: no auto-rollback — on failed health the new containers stay up for
# inspection (git reflog has the old SHA); add auto-rollback if paged at 3am.
set -euo pipefail
exec 9>/tmp/sogo6-gitops.lock
flock -n 9 || exit 0
cd "${REPO_DIR:-$(dirname "$0")/..}"
BRANCH="${BRANCH:-main}"

if [ -z "${COMPOSE_FILE:-}" ] && [ ! -f docker-compose.yml ] && [ ! -f docker-compose.yaml ]; then
  echo "$(date -Is) ERROR: no compose file found in $PWD"
  exit 1
fi

git fetch origin "$BRANCH" --quiet
before=$(git rev-parse --short HEAD)
after=$(git rev-parse --short FETCH_HEAD)
if [ "$before" = "$after" ]; then
  exit 0
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "$(date -Is) SKIP: local edits to tracked files in $PWD would be destroyed"
  exit 1
fi

echo "$(date -Is) deploying $before -> $after ($(git log -1 --format=%s FETCH_HEAD))"
git reset --hard "$after"
docker compose up -d --build --wait --wait-timeout 300
echo "$(date -Is) OK: $(docker compose ps --format '{{.Name}}={{.Health}}' | tr '\n' ' ')"
