# Sven Staging On A Linux VM 2026

This document defines the exact staging target for Sven.

The goal of staging is not convenience. The goal is to prove the production-shaped deployment on Linux before real production cutover.

---

## Scope

Staging must validate:

- Linux-hosted runtime
- container deployment contract
- ingress and TLS
- migrations and seed
- browser and mobile client access
- backup and restore flow
- rollback flow
- release evidence collection

Staging should mirror production services with reduced scale, not reduced topology.

---

## Recommended Host

| Item | Recommendation |
|:--|:--|
| Hypervisor | Proxmox, VMware, cloud VM, or bare Linux host |
| Guest OS | Ubuntu Server 24.04 LTS or Debian 12 |
| CPU | 8 vCPU minimum |
| RAM | 16 GB minimum |
| Disk | 200 GB SSD minimum |
| Network | Static private IP + public ingress through reverse proxy or firewall NAT |

---

## Runtime Shape

Use one Linux VM with:

- Docker Engine
- Docker Compose plugin
- Nginx or Caddy
- systemd for host services
- persistent volumes on dedicated directories

Recommended service shape:

| Layer | Services |
|:--|:--|
| Edge | Nginx or Caddy, TLS, rate limiting |
| Core app | gateway-api, agent-runtime, admin-ui, canvas-ui |
| Data | Postgres, NATS, OpenSearch |
| Optional AI infra | LiteLLM, Ollama, SearXNG |
| Observability | Prometheus, Loki, Grafana, alerting target |

---

## Storage Layout

Use explicit Linux host paths:

```text
/srv/sven/staging/
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

Rules:

- no production data on staging
- no host-user home directory dependency
- no Windows path assumptions
- artifacts and backups must be on mounted persistent storage

---

## Secrets Model

Staging secrets must be separate from production.

Required secret groups:

- database credentials
- cookie/session secret
- admin bootstrap secret
- JWT/OIDC secrets
- provider keys
- push keys
- storage keys

Preferred injection order:

1. secret manager or encrypted env files
2. systemd/docker environment injection
3. never commit runtime secrets into repo

---

## Networking

Recommended staging DNS:

- `staging.sven.systems`
- `admin.staging.sven.systems`

Ports:

- public `443`
- redirect `80 -> 443`
- no direct public exposure for Postgres/NATS/OpenSearch

Rules:

- only edge proxy is internet-facing
- service-to-service traffic stays on internal Docker network
- firewall only allows required inbound ports

---

## Staging Validation Gates

Before staging is accepted:

1. host hardening baseline applied
2. compose stack starts clean on Linux
3. migrations pass
4. seed baseline passes
5. health checks pass
6. admin and canvas public URLs work
7. mobile app points to staging and can authenticate
8. backup capture works
9. restore into a throwaway environment works
10. rollback rehearsal works

---

## Mandatory Test Pack

Run these on staging:

- browser end-user batches
- browser operator batches
- deep canvas browser scenarios
- mobile auth and chat smoke
- registry install/promote path
- artifact preview/download path
- community request/approval path
- device pairing/control path
- backup/restore drill
- rollback drill

Release evidence should point to staging, not localhost.

---

## Promotion Rule

Do not promote staging to production v1 until:

- staging is stable for the planned validation window
- browser and mobile proofs are green
- backup/restore proof is current
- release gates pass

---

## Anti-Patterns

- using a Windows host for staging truth
- sharing the same database instance with production
- using localhost-only URLs in evidence
- skipping restore rehearsal because backup exists

---

## Related

- [deployment-ladder-2026.md](deployment-ladder-2026.md)
- [production-v1-linux-vm-2026.md](production-v1-linux-vm-2026.md)
- [backup-and-restore-guide-2026.md](../ops/backup-and-restore-guide-2026.md)
- [release-rollback-runbook-2026.md](../ops/release-rollback-runbook-2026.md)
