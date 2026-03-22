# Sven Deployment Ladder 2026

This document defines the recommended deployment path for Sven from pre-production through scaled production.

The key rule is simple:

- `Docker` is the packaging/runtime layer.
- `Linux VM or Linux nodes` are the infrastructure layer.
- `Orchestration` is the scaling/operability layer.

Sven should not be treated as a Windows desktop app plus Docker when the goal is real staging or production. The recommended path is Linux-hosted infrastructure with containers on top.

---

## Decision

| Stage | Recommended host model | Runtime model | Why |
|:--|:--|:--|:--|
| Local dev | Developer machine | Docker Compose / PM2 | Fast iteration |
| Staging | Single Linux VM | Docker Compose | Production-like validation with reduced scale |
| Production v1 | Single hardened Linux VM | Docker Compose + managed ops controls | Lowest-complexity real production |
| Production scale | Multiple Linux VMs / nodes | Kubernetes or Nomad | HA, rolling deploys, autoscaling, cleaner recovery |

---

## What Docker Is And Is Not

Docker is recommended, but only as one layer of the stack.

Docker is good for:

- deterministic packaging
- dependency isolation
- consistent CI/CD artifacts
- simple rollouts and rollbacks

Docker is not enough by itself for:

- host hardening
- backup strategy
- multi-node failover
- ingress and TLS policy
- storage durability
- observability at scale

For Sven, production means:

1. Linux host or Linux node pool
2. container runtime
3. ingress and TLS
4. persistent storage
5. backups
6. metrics, logs, traces, alerts
7. rollout and rollback procedure

---

## Recommended Sequence

### Stage 1: Staging

Use a single Linux VM with Docker Compose.

Purpose:

- prove installability on the real target OS
- run migration rehearsals
- run browser and mobile QA against a production-like host
- validate backups, restore, rollbacks, and secrets injection

Document:

- [staging-linux-vm-2026.md](staging-linux-vm-2026.md)
- [staging-execution-plan-2026.md](staging-execution-plan-2026.md)

### Stage 2: Production v1

Use a single hardened Linux VM with Docker Compose, reverse proxy, volumes, backups, and monitoring.

Purpose:

- first real deployment for users
- lowest operational complexity that still counts as proper production
- clean base for release and controlled incident response

Document:

- [production-v1-linux-vm-2026.md](production-v1-linux-vm-2026.md)
- [production-v1-rollout-plan-2026.md](production-v1-rollout-plan-2026.md)

### Stage 3: Production Scale

Use multiple Linux nodes with Kubernetes or Nomad.

Purpose:

- high availability
- controlled horizontal growth
- rolling upgrades
- service isolation and better recovery posture

Document:

- [production-scale-2026.md](production-scale-2026.md)
- [production-scale-validation-program-2026.md](production-scale-validation-program-2026.md)

---

## Stage Exit Criteria

| From | To | Exit criteria |
|:--|:--|:--|
| local dev | staging | install succeeds on Linux VM; migrations and seed complete; ingress works; baseline smoke tests pass |
| staging | production v1 | release gates pass; restore rehearsal passes; soak and browser QA pass; secrets and backups are production-shaped |
| production v1 | production scale | real usage justifies added ops complexity; SLOs need HA or horizontal scaling; on-call and observability are mature enough |

---

## Default Recommendation For Sven Right Now

The next real deployment path should be:

1. build and validate `staging` on a dedicated Linux VM
2. run real user and operator tests there
3. promote to `production v1` on a hardened Linux VM
4. only then design and validate `production scale`

This is the correct order because production-scale architecture is more expensive to debug if the single-node production contract is still moving.

Bare metal note:

- this repo documents bare metal for staging
- it does not yet define a separate production bare-metal baseline
- production should currently follow the Linux VM tiers unless a dedicated bare-metal production runbook is added

---

## What To Avoid

- Windows desktop as long-term production host
- Docker without host hardening and backup policy
- production data on ad-hoc local paths without volume ownership rules
- introducing Kubernetes before single-node production is proven stable
- sharing staging and production secrets or databases

---

## Related Documents

- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [proxmox-prod.md](proxmox-prod.md)
- [ingress-topologies.md](ingress-topologies.md)
- [edge-nginx-and-traefik-options.md](edge-nginx-and-traefik-options.md)
- [backup-and-restore-guide-2026.md](../ops/backup-and-restore-guide-2026.md)
- [release-rollback-runbook-2026.md](../ops/release-rollback-runbook-2026.md)
