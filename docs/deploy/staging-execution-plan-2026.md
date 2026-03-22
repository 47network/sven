# Sven Staging Execution Plan 2026

This is the exact execution plan for bringing Sven onto a real Linux staging VM.

Use this document when you are ready to stop validating on the Windows host and start validating on the real target platform.

Operator checklist companion:

- [staging-host-bringup-checklist-2026.md](staging-host-bringup-checklist-2026.md)
- [staging-proxmox-small-host-lan-gpu-2026.md](staging-proxmox-small-host-lan-gpu-2026.md)
- [staging-bare-metal-2026.md](staging-bare-metal-2026.md)

---

## Target

Provision one dedicated Linux VM and deploy Sven there with the same service shape intended for production v1, at reduced scale.

Recommended target:

- OS: Ubuntu Server 24.04 LTS
- Hostname: `sven-staging-01`
- Public URL:
  - `staging.sven.systems`
  - optional `admin.staging.sven.systems`

---

## Deliverables

At the end of this plan, staging must have:

- Linux host baseline complete
- Docker + Compose installed
- Sven deployed under `/srv/sven/staging`
- TLS ingress live
- migrations and seed complete
- public browser access working
- real QA/evidence runs against staging host

---

## Phase 0: Provision The VM

### VM spec

| Item | Value |
|:--|:--|
| vCPU | 8 |
| RAM | 16 GB |
| Disk | 200 GB SSD |
| OS disk | 60 GB minimum |
| Data disk | remaining capacity preferred |

### Base packages

Run on the new host:

```bash
sudo apt-get update
sudo apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  jq \
  git \
  unzip \
  rsync \
  ufw \
  fail2ban \
  htop \
  nvme-cli
```

### Docker install

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

### Firewall baseline

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

If SSH should not be public, restrict `22/tcp` to your admin subnet or VPN only.

---

## Phase 1: Prepare Runtime Layout

Create the runtime directories:

```bash
sh scripts/ops/sh/bootstrap-staging-linux-vm.sh
sh scripts/ops/sh/generate-staging-env.sh /srv/sven/staging/env/.env.staging
```

Expected layout:

```text
/srv/sven/staging/
  app/
  compose/
  env/
  data/
    postgres/
    nats/
    opensearch/
    artifacts/
  backups/
  logs/
```

---

## Phase 2: Place Sven Code

Recommended checkout:

```bash
cd /srv/sven/staging/app
git clone https://github.com/47network/thesven.git .
git checkout main
```

If using a release tag, check out the exact release commit instead of `main`.

---

## Phase 3: Configure Environment

Create a staging env file:

```bash
sh scripts/ops/sh/generate-staging-env.sh /srv/sven/staging/env/.env.staging
```

Minimum staging values:

- `DATABASE_URL`
- `COMMUNITY_DATABASE_URL`
- `NATS_URL`
- `COOKIE_SECRET`
- `SEARXNG_URL`
- `SVEN_STORAGE_ROOT`
- `ARTIFACT_STORAGE_ROOT`
- `SVEN_NAS_ROOT`
- `OPENAI_API_KEY` or equivalent provider secret if cloud-backed models are used

Recommended staging path values:

```env
SVEN_STORAGE_ROOT=/srv/sven/staging/data/artifacts
ARTIFACT_STORAGE_ROOT=/srv/sven/staging/data/artifacts
SVEN_NAS_ROOT=/srv/sven/staging/data/nas
```

Do not reuse production secrets.

If you are using the Proxmox small-host + LAN GPU topology, override inference before generation:

```bash
export OLLAMA_URL=http://sven-inference-01.lan:11434
export EMBEDDINGS_URL=http://sven-inference-01.lan:11434
sh scripts/ops/sh/generate-staging-env.sh /srv/sven/staging/env/.env.staging
```

---

## Phase 4: Ingress And TLS

Use either Nginx or Caddy on the Linux host.

Recommended Nginx split:

- public UI -> canvas UI / gateway routes
- admin UI -> admin routes or separate subdomain

TLS requirements:

- valid public certificate
- `80 -> 443` redirect
- HSTS only after hostname validation is stable

Reference docs:

- [ingress-topologies.md](ingress-topologies.md)
- [edge-nginx-and-traefik-options.md](edge-nginx-and-traefik-options.md)
- [caddy-ingress.md](caddy-ingress.md)

---

## Phase 5: Start Core Services

From `/srv/sven/staging/app`:

```bash
docker compose \
  --env-file /srv/sven/staging/env/.env.staging \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  -f docker-compose.staging.linux-vm.yml \
  up -d postgres nats opensearch
```

Wait for health:

```bash
docker compose ps
docker compose logs --tail=100 postgres
docker compose logs --tail=100 nats
docker compose logs --tail=100 opensearch
```

---

## Phase 6: Migrate And Seed

From `/srv/sven/staging/app`:

```bash
npm install
npm run --workspace services/gateway-api build
npm run --workspace services/gateway-api db:migrate
npm run --workspace services/gateway-api db:seed
```

Staging is not valid until seed baseline succeeds.

---

## Phase 7: Start Sven Services

```bash
sh scripts/ops/sh/staging-linux-vm-up.sh
```

Verify:

```bash
sh scripts/ops/sh/staging-host-preflight.sh
sh scripts/ops/sh/staging-linux-vm-verify.sh
curl -fsS http://127.0.0.1:3000/healthz
```

---

## Phase 8: Host-Level Verification

Run the following checks on the Linux host:

```bash
curl -I https://staging.sven.systems/login
curl -I https://staging.sven.systems/skills
curl -I https://staging.sven.systems/search
curl -I https://staging.sven.systems/community
```

If admin is split:

```bash
curl -I https://admin.staging.sven.systems/login
```

---

## Phase 9: Application Validation

These must be re-run against staging URLs, not localhost:

1. browser login flow
2. canvas chat roundtrip
3. skill install
4. artifact preview/download
5. approvals page
6. community request/approval
7. admin setup/integrations/deployment/device flows
8. mobile auth smoke against staging base URL

---

## Phase 10: Ops Validation

Staging is not complete until these are done:

1. backup capture
2. restore into throwaway environment
3. rollback rehearsal
4. service restart drill
5. disk-space alert drill

---

## Acceptance

Staging is accepted only if all of the following are true:

- Linux deployment works without Windows path assumptions
- staging URL is usable by real browser clients
- release QA passes against staging
- restore works
- rollback works

---

## Exact Output Artifacts To Produce

- staging deployment record
- staging URL verification evidence
- staging migration verification evidence
- browser QA proof against staging host
- backup/restore proof
- rollback proof

---

## Next Step After This

If staging passes, move to:

- [production-v1-rollout-plan-2026.md](production-v1-rollout-plan-2026.md)
