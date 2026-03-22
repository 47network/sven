# Sven Staging Host Bring-Up Checklist 2026

This checklist turns the staging Linux VM plan into an operator-ready sequence.

Use it when preparing the first real staging host.

Primary references:

- [staging-linux-vm-2026.md](staging-linux-vm-2026.md)
- [staging-execution-plan-2026.md](staging-execution-plan-2026.md)
- [staging-proxmox-small-host-lan-gpu-2026.md](staging-proxmox-small-host-lan-gpu-2026.md)
- [staging-bare-metal-2026.md](staging-bare-metal-2026.md)

---

## Host Identity

- [ ] Hostname chosen: `sven-staging-01`
- [ ] Static private IP assigned
- [ ] Public DNS planned:
  - [ ] `staging.sven.systems`
  - [ ] `admin.staging.sven.systems`
- [ ] SSH administrative path decided:
  - [ ] VPN only
  - [ ] allowlisted source subnet

Record:

```text
Hostname:
Private IP:
Public IP / LB:
Admin path:
OS version:
```

---

## VM Baseline

- [ ] Ubuntu Server 24.04 LTS or Debian 12 installed
- [ ] 8 vCPU minimum
- [ ] 16 GB RAM minimum
- [ ] 200 GB SSD minimum
- [ ] time sync enabled
- [ ] disk layout reviewed

Verify:

```bash
uname -a
lsblk
free -h
df -h
timedatectl
```

---

## OS Packages

- [ ] package index refreshed
- [ ] base packages installed

Command:

```bash
sudo apt-get update
sudo apt-get install -y \
  ca-certificates curl gnupg lsb-release jq git unzip rsync ufw fail2ban htop nvme-cli
```

Verify:

```bash
git --version
jq --version
ufw status
fail2ban-client status
```

---

## Docker Baseline

- [ ] Docker repo configured
- [ ] Docker engine installed
- [ ] Compose plugin installed
- [ ] Docker service enabled and started
- [ ] admin user added to `docker` group if desired

Verify:

```bash
docker version
docker compose version
systemctl status docker --no-pager
```

---

## Firewall Baseline

- [ ] default deny inbound
- [ ] allow outbound
- [ ] allow `22/tcp` only as intended
- [ ] allow `80/tcp`
- [ ] allow `443/tcp`

Verify:

```bash
sudo ufw status verbose
ss -tulpn
```

---

## Runtime Layout

- [ ] `/srv/sven/staging` created
- [ ] data directories created
- [ ] env directory created
- [ ] backup directory created
- [ ] logs directory created

Command:

```bash
sh scripts/ops/sh/bootstrap-staging-linux-vm.sh
sh scripts/ops/sh/generate-staging-env.sh /srv/sven/staging/env/.env.staging
```

Verify:

```bash
find /srv/sven/staging -maxdepth 2 -type d | sort
```

---

## Repo Placement

- [ ] code checked out under `/srv/sven/staging/app`
- [ ] exact branch/tag recorded
- [ ] remote origin verified

Verify:

```bash
cd /srv/sven/staging/app
git remote -v
git rev-parse HEAD
git status --short
```

Record:

```text
Repo remote:
Branch/tag:
Commit:
```

---

## Environment File

- [ ] `/srv/sven/staging/env/.env.staging` created
- [ ] all placeholder secrets replaced
- [ ] no production secrets reused
- [ ] all storage roots point at `/srv/sven/staging/...`
- [ ] public/admin URLs set to staging domains

Minimum variables to confirm:

- [ ] `DATABASE_URL`
- [ ] `COMMUNITY_DATABASE_URL`
- [ ] `NATS_URL`
- [ ] `COOKIE_SECRET`
- [ ] `SVEN_PUBLIC_BASE_URL`
- [ ] `SVEN_ADMIN_BASE_URL`
- [ ] `SVEN_STORAGE_ROOT`
- [ ] `ARTIFACT_STORAGE_ROOT`
- [ ] `SVEN_NAS_ROOT`

Verify:

```bash
grep -E '^(SVEN_PUBLIC_BASE_URL|SVEN_ADMIN_BASE_URL|SVEN_STORAGE_ROOT|ARTIFACT_STORAGE_ROOT|SVEN_NAS_ROOT)=' /srv/sven/staging/env/.env.staging
grep -E '^(OLLAMA_URL|EMBEDDINGS_URL)=' /srv/sven/staging/env/.env.staging
```

---

## Ingress And TLS

- [ ] ingress choice made:
  - [ ] Nginx
  - [ ] Caddy
- [ ] DNS resolves to the host or LB
- [ ] certificates issued
- [ ] `80 -> 443` redirect enabled

Verify:

```bash
curl -I https://staging.sven.systems/login
curl -I https://admin.staging.sven.systems/login
```

---

## Core Data Services

- [ ] Postgres started
- [ ] NATS started
- [ ] OpenSearch started
- [ ] health/log checks reviewed

Command:

```bash
docker compose \
  --env-file /srv/sven/staging/env/.env.staging \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  -f docker-compose.staging.linux-vm.yml \
  up -d postgres nats opensearch
```

Verify:

```bash
docker compose ps
docker compose logs --tail=100 postgres
docker compose logs --tail=100 nats
docker compose logs --tail=100 opensearch
```

---

## Migrate And Seed

- [ ] dependencies installed
- [ ] gateway built
- [ ] migrations passed
- [ ] seed passed

Verify:

```bash
npm run --workspace services/gateway-api build
npm run --workspace services/gateway-api db:migrate
npm run --workspace services/gateway-api db:seed
```

Record:

```text
Migration status:
Seed status:
```

---

## Sven Services

- [ ] staging stack started
- [ ] gateway `/healthz` responds
- [ ] staging verify script passes

Command:

```bash
sh scripts/ops/sh/staging-host-preflight.sh
sh scripts/ops/sh/staging-linux-vm-up.sh
sh scripts/ops/sh/staging-linux-vm-verify.sh
```

---

## Browser And App Validation

- [ ] public login works
- [ ] admin login works
- [ ] chat roundtrip works
- [ ] skills page works
- [ ] search works
- [ ] community works
- [ ] mobile auth smoke works

---

## Ops Validation

- [ ] backup captured
- [ ] restore rehearsal completed
- [ ] rollback rehearsal completed
- [ ] restart drill completed
- [ ] disk alert threshold reviewed

---

## Acceptance

The host is ready for staging truth only if all sections above are checked and evidence is recorded.
