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

git -c submodule.recurse=false fetch origin "$BRANCH" --quiet
before=$(git rev-parse --short HEAD)
after=$(git rev-parse --short FETCH_HEAD)
if [ "$before" = "$after" ]; then
  exit 0
fi

# never clobber hand-edits: parent tracked files AND submodule content
# (checked only when a deploy would actually happen — no log noise otherwise)
if [ -n "$(git status --porcelain --untracked-files=no --ignore-submodules=all)" ]; then
  echo "$(date -Is) SKIP: local edits to tracked files in $PWD would be destroyed"
  exit 1
fi
for sub in $(git submodule status --recursive | awk '$1 !~ /^[-U]/ {print $2}'); do
  if [ -n "$(git -C "$sub" status --porcelain --untracked-files=no)" ]; then
    echo "$(date -Is) SKIP: submodule $sub has local edits — reconcile first"
    exit 1
  fi
done

echo "$(date -Is) deploying $before -> $after ($(git log -1 --format=%s FETCH_HEAD))"
git reset --hard "$after"
git submodule update --init --recursive
# Pull external images (e.g. ghcr stalwart-rewrite) so image-based services
# update too; build-based services are skipped, failures are logged and non-fatal.
docker compose pull --ignore-buildable || echo "WARN: image pull failed, using local images"

# Pre-pull base images for BuildKit (docker compose build --build uses buildx
# which does NOT inherit the docker daemon's proxy; on hosts behind a proxy
# like vhrz2392 it times out reaching auth.docker.io). The daemon CAN pull
# (systemd HTTP_PROXY), so we pre-pull here — fast no-op if already cached.
# ponytail: grep FROM from Dockerfiles instead of a hardcoded list — stays
# correct when base images change.
grep -rh '^FROM ' sogo6-server/deploy/local/Dockerfile.local \
  sogo6-ui/Dockerfile.prod sogo6/ldap/Dockerfile 2>/dev/null \
  | awk '{print $2}' | sed 's/ AS .*//' | sort -u \
  | while read -r img; do docker pull "$img" 2>/dev/null || true; done

docker compose up -d --build --wait --wait-timeout 300
echo "$(date -Is) OK: $(docker compose ps --format '{{.Name}}={{.Health}}' | tr '\n' ' ')"
