# Sven Setup Paths Matrix 2026

This document is the master index for every supported Sven setup path.

Use it to answer one question quickly:

`Which setup path fits this user and this environment?`

---

## Decision Table

| Scenario | Audience | Host model | Runtime model | Primary doc |
|:--|:--|:--|:--|:--|
| Local development | developers | workstation | Docker Compose / PM2 | [deployment-ladder-2026.md](deployment-ladder-2026.md) |
| Quick trial from release assets | GitHub / evaluators | existing Linux or Windows machine | quickstart installer | [quickstart-installers.md](quickstart-installers.md) |
| First real staging | operators | single Linux VM | Docker Compose | [staging-execution-plan-2026.md](staging-execution-plan-2026.md) |
| Staging on bare metal | operators | bare-metal Linux | Docker Compose | [staging-bare-metal-2026.md](staging-bare-metal-2026.md) |
| Staging on small Proxmox + LAN GPU | operators | Proxmox VM + inference LAN VM(s) | Docker Compose | [staging-proxmox-small-host-lan-gpu-2026.md](staging-proxmox-small-host-lan-gpu-2026.md) |
| First real production | operators | single hardened Linux VM | Docker Compose | [production-v1-rollout-plan-2026.md](production-v1-rollout-plan-2026.md) |
| Production scale | platform/ops | Kubernetes on Linux nodes | Kustomize / cluster services | [production-scale-kubernetes-reference-2026.md](production-scale-kubernetes-reference-2026.md) |

---

## By Audience

### GitHub release users

Start with:

- [github-release-install-guide-2026.md](github-release-install-guide-2026.md)
- [quickstart-installers.md](quickstart-installers.md)

These keep hostnames generic and focus on installability.

### Internal operators

Start with:

- [staging-host-bringup-checklist-2026.md](staging-host-bringup-checklist-2026.md)
- [staging-execution-plan-2026.md](staging-execution-plan-2026.md)
- [production-v1-rollout-plan-2026.md](production-v1-rollout-plan-2026.md)

These use real deployment assumptions such as `sven.systems`.

### Platform engineering

Start with:

- [production-scale-cluster-bootstrap-2026.md](production-scale-cluster-bootstrap-2026.md)
- [production-scale-secrets-and-images-2026.md](production-scale-secrets-and-images-2026.md)
- [production-scale-validation-program-2026.md](production-scale-validation-program-2026.md)

---

## By Infrastructure Model

### Workstation / local

- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`
- docs:
  - [README](../../README.md)
  - [release/LOCAL_TESTING_GUIDE.md](../release/LOCAL_TESTING_GUIDE.md)

### Linux VM

- docs:
  - [staging-linux-vm-2026.md](staging-linux-vm-2026.md)
  - [production-v1-linux-vm-2026.md](production-v1-linux-vm-2026.md)

### Proxmox VM with external inference

- docs:
  - [staging-proxmox-small-host-lan-gpu-2026.md](staging-proxmox-small-host-lan-gpu-2026.md)
  - [proxmox-prod.md](proxmox-prod.md)

### Bare metal Linux

- docs:
  - [staging-bare-metal-2026.md](staging-bare-metal-2026.md)

Current scope:

- bare metal is documented for staging in this repo
- production bare-metal is not a separate first-class runbook yet

### Kubernetes

- docs:
  - [production-scale-kubernetes-reference-2026.md](production-scale-kubernetes-reference-2026.md)
  - [production-scale-cluster-bootstrap-2026.md](production-scale-cluster-bootstrap-2026.md)

---

## Domain Rule

Two domain modes are intentionally documented:

### Public GitHub/release examples

Use generic hostnames:

- `example.com`
- `app.example.com`

### Real deployment documentation

Use deployment hostnames:

- `sven.systems`
- `app.sven.systems`
- `admin.sven.systems`
- `staging.sven.systems`
- `admin.staging.sven.systems`

This separation is deliberate and should not be collapsed.

## Scope Notes

- `proxmox-prod.md` is a specialization of the production v1 topology for teams that want VM separation or LAN inference isolation. It is not a replacement for the deployment ladder.
- bare metal is covered for staging today. If a production bare-metal path is needed, it should be documented explicitly rather than inferred.

---

## Coverage Rule

Sven setup documentation is only considered complete if all of the following remain true:

- a GitHub user can identify the simplest install path
- an operator can identify the staging path
- an operator can identify the production v1 path
- a platform engineer can identify the scale path
- hostnames are generic in release docs and real in deployment docs
