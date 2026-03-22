# Sven Staging On Bare Metal 2026

This is the recommended staging plan if you want one physical Linux host to carry the full staging environment directly.

Use this when:

- you do not want the Proxmox layer for staging
- you have a single strong Linux host available
- you want fewer virtualization variables during first real deployment proof

---

## Recommended Topology

```text
Public DNS / TLS
  |
  v
staging.sven.systems
admin.staging.sven.systems
  |
  v
Bare-metal Linux host
  - gateway-api
  - agent-runtime
  - admin-ui
  - canvas-ui
  - postgres
  - nats
  - opensearch
  - optional local ollama
  - observability
```

---

## Why This Topology

This is the cleanest first Linux proof if:

- you want fewer moving parts
- the host has enough CPU/RAM/SSD for all staging services
- GPU is local to the same host or inference needs are modest

It reduces network and virtualization complexity at the cost of weaker isolation.

---

## Recommended Host

Minimum:

- 8 vCPU equivalent
- 16 GB RAM
- 200 GB SSD

Preferred if local inference is on the same machine:

- 12+ vCPU
- 32 GB RAM
- fast NVMe
- optional local GPU

---

## Env Model

If inference is local to the same host:

```env
OLLAMA_URL=http://ollama:11434
EMBEDDINGS_URL=http://ollama:11434
```

If the bare-metal host still uses a separate LAN inference machine:

```env
OLLAMA_URL=http://sven-inference-01.lan:11434
EMBEDDINGS_URL=http://sven-inference-01.lan:11434
```

---

## When Bare Metal Is Better

Prefer bare metal staging over Proxmox when:

- you want the shortest path to first real Linux proof
- disk IO on the physical host is materially better
- you want to eliminate VM sizing mistakes during first rollout

Prefer Proxmox when:

- you need better host consolidation
- you want snapshot workflows at the hypervisor layer
- you already run the environment as VM-managed infrastructure

---

## Operational Rule

Do not combine bare-metal staging with ad-hoc directories or user home paths.

Still use:

- `/srv/sven/staging`
- explicit env files
- explicit backup paths
- explicit ingress/TLS setup

Bare metal is not an excuse to relax the deployment contract.

---

## Promotion Rule

Bare-metal staging is accepted only when:

- it follows the same checklist as the Linux VM plan
- browser and mobile proofs are green
- restore and rollback are proven

---

## Related

- [staging-linux-vm-2026.md](staging-linux-vm-2026.md)
- [staging-execution-plan-2026.md](staging-execution-plan-2026.md)
- [staging-host-bringup-checklist-2026.md](staging-host-bringup-checklist-2026.md)
