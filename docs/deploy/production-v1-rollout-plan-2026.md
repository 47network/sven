# Sven Production v1 Rollout Plan 2026

This document defines the first real production rollout after Linux staging has passed.

---

## Preconditions

Do not start production v1 rollout until:

- Linux staging has passed
- backup/restore rehearsal passed
- rollback rehearsal passed
- current release QA is green against staging
- release candidate is pinned to an exact commit/tag

---

## Production v1 Host

Use one hardened Linux VM.

Recommended:

- hostname: `sven-prod-01`
- OS: Ubuntu Server 24.04 LTS
- 12-16 vCPU
- 32 GB RAM
- 500 GB NVMe minimum
- separate backup target

---

## Production Path Layout

```text
/srv/sven/prod/
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

Required runtime env:

- `SVEN_STORAGE_ROOT=/srv/sven/prod/data/artifacts`
- `ARTIFACT_STORAGE_ROOT=/srv/sven/prod/data/artifacts`
- `SVEN_NAS_ROOT=/srv/sven/prod/data/nas`

Executable assets for this tier:

- `config/env/.env.production.linux-vm.example`
- `docker-compose.production.linux-vm.yml`
- `scripts/ops/sh/bootstrap-production-linux-vm.sh`
- `scripts/ops/sh/production-linux-vm-up.sh`
- `scripts/ops/sh/production-linux-vm-verify.sh`

---

## Rollout Order

### 1. Pre-deploy snapshot

Take:

- Postgres backup
- OpenSearch snapshot if used for critical retrieval state
- env secret snapshot reference
- previous release image/tag reference

### 2. Deploy infrastructure layer

Bring up:

- Postgres
- NATS
- OpenSearch
- ingress

### 3. Run migrations

Run migrations before opening traffic to the new app version.

### 4. Start application services

Bring up:

- gateway-api
- agent-runtime
- admin-ui
- canvas-ui

Recommended production bootstrap order:

```bash
sh scripts/ops/sh/bootstrap-production-linux-vm.sh
cp config/env/.env.production.linux-vm.example /srv/sven/prod/env/.env.production
# edit /srv/sven/prod/env/.env.production

docker compose \
  --env-file /srv/sven/prod/env/.env.production \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  -f docker-compose.production.linux-vm.yml \
  up -d postgres nats opensearch

npm install
npm run --workspace services/gateway-api build
npm run --workspace services/gateway-api db:migrate
npm run --workspace services/gateway-api db:seed

sh scripts/ops/sh/production-linux-vm-up.sh
sh scripts/ops/sh/production-linux-vm-verify.sh
```

### 5. Post-deploy smoke

Must pass:

- `/healthz`
- login
- chat roundtrip
- artifact preview/download
- admin setup/deployment pages

### 6. Controlled canary window

Observe:

- error rates
- latency
- memory growth
- DB health
- queue health

### 7. Release closeout

Publish evidence only after rollout is stable.

---

## Production v1 Hard Requirements

### Security

- strong unique secrets
- TLS certificates
- inbound firewall policy
- no public DB/NATS/OpenSearch
- SSH restricted

### Durability

- scheduled backups
- off-host backup copy
- restore instructions current

### Monitoring

- service uptime checks
- CPU/memory/disk alerting
- gateway error alerting
- backup failure alerts

### Operability

- restart procedure
- rollback command path
- release owner identified

---

## Validation Matrix

| Area | Required |
|:--|:--|
| Public web | login, skills, search, community, chat |
| Admin | setup, integrations, deployment, devices |
| Registry | install, quarantine, promote |
| Artifacts | metadata, preview, download |
| Community | request, approval, reputation |
| Mobile | auth against production host minimum |
| Ops | backup, restore, rollback |

---

## Production v1 Exit Criteria

Production v1 is considered established when:

- rollout completed without rollback
- post-deploy smoke passed
- first observation window passed
- evidence and runbooks are current

---

## Next Step

Only after production v1 is stable should you move to:

- [production-scale-2026.md](production-scale-2026.md)
