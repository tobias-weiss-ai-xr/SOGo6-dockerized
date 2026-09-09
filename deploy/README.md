# GitOps auto-deploy

Each host polls its own repo's `main` every 15 min via cron and redeploys only
when the branch moved. No inbound access needed (works behind VPN/NAT).

Script: `gitops-update.sh` — flock-guarded, skips if local edits would be lost,
`docker compose up -d --build --wait` for health-checked rollout. Log: cron
redirect target.

## Install (contextual-intelligence.org, user `weiss`, repo `SOGo6-dockerized` at ~/sogo6-test)

COMPOSE_FILE must list all three files — the running project uses traefik +
override (per `docker compose ls`); default resolution would miss traefik.

    cd ~/sogo6-test && git pull
    (crontab -l; echo '*/15 * * * * REPO_DIR=$HOME/sogo6-test COMPOSE_FILE=docker-compose.yaml:docker-compose.traefik.yaml:docker-compose.override.yaml $HOME/sogo6-test/deploy/gitops-update.sh >> $HOME/sogo6-test/deploy/gitops.log 2>&1') | crontab -

## Install (vhrz2392, root, repo `sogo6-stalwart-openldap-dockerized` at /opt/sogo-test/sogo6)

Script is a standalone copy (its repo is separate). NOTE: the running project
uses `docker-compose.yaml` + `docker-compose-sogo6.vhrz2392.yaml` (per
`docker compose ls`), NOT the file the ansible playbook's post_tasks mention:

    scp deploy/gitops-update.sh root@vhrz2392:/opt/sogo-test/
    # root crontab on vhrz2392:
    */15 * * * * REPO_DIR=/opt/sogo-test/sogo6 COMPOSE_FILE=docker-compose.yaml:docker-compose-sogo6.vhrz2392.yaml /opt/sogo-test/gitops-update.sh >> /opt/sogo-test/sogo6-gitops.log 2>&1

Note: vhrz2392 is also ansible-managed (ansible-hrz); this cron lives outside
that playbooks by intent (pull-deploy), don't let a playbook "clean" it.

## Manual run / status

    REPO_DIR=... ./gitops-update.sh; echo $?        # 0 = up-to-date or deployed
    tail deploy/gitops.log
