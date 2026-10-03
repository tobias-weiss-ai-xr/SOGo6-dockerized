# GitOps auto-deploy

Each host polls its own repo's `main` every 15 min via cron and redeploys only
when the branch moved. No inbound access needed (works behind VPN/NAT).

Script: `gitops-update.sh` — flock-guarded, skips if local edits would be lost,
pre-pulls base images (BuildKit can't use the daemon proxy on HRZ hosts),
`docker compose up -d --build --wait` for health-checked rollout.
Log: cron redirect target.

## Install (42.20, user `weiss`, repo at `~/sogo6-test`)

COMPOSE_FILE must list all three files — the running project uses traefik +
override (per `docker compose ls`); default resolution would miss traefik.

    cd ~/sogo6-test && git pull
    (crontab -l; echo '*/15 * * * * REPO_DIR=$HOME/sogo6-test COMPOSE_FILE=docker-compose.yaml:docker-compose.traefik.yaml:docker-compose.override.yaml $HOME/sogo6-test/deploy/gitops-update.sh >> $HOME/sogo6-test/deploy/gitops.log 2>&1') | crontab -

42.20 has direct internet + `gh auth git-credential` (logged in as
tobias-weiss-ai-xr). No proxy or manual credentials needed.

## Install (vhrz2392, root, repo at `/opt/sogo-test/sogo6`)

vhrz2392 is behind the HRZ proxy and has NO direct internet. Two extra steps:

1. **Git proxy + credentials** (repo is private — needs a PAT):
   - `git config --global http.proxy http://137.248.1.2:3128`
   - `git config --global credential.helper store`
   - `echo 'https://x-access-token:<TOKEN>@github.com' > /root/.git-credentials`
   - `chmod 600 /root/.git-credentials`
   - Token: `gh auth token` on 42.20 (same GitHub account)

2. **Docker proxy** (for `docker pull` of external images like redis/stalwart):
   - Already in `/etc/systemd/system/docker.service.d/*.conf`
     (`HTTP_PROXY=http://www-proxy3.uni-marburg.de:3128`)
   - BuildKit does NOT inherit this — base images are pre-pulled by
     `gitops-update.sh` via `docker pull` (daemon proxy) before `compose build`.

Cron (managed by ansible-hrz `roles/sogo6`):

    */15 * * * * REPO_DIR=/opt/sogo-test/sogo6 COMPOSE_FILE=docker-compose.yaml:docker-compose-sogo6.vhrz2392.yaml /opt/sogo-test/sogo6/deploy/gitops-update.sh >> /opt/sogo-test/sogo6-gitops.log 2>&1

The `docker-compose-sogo6.vhrz2392.yaml` override lives on the host (untracked,
not in the repo) — it pins port 9443 and the external API URL.

## Manual run / status

    REPO_DIR=... ./gitops-update.sh; echo $?        # 0 = up-to-date or deployed
    tail deploy/gitops.log
