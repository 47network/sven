# Sven Staging On Proxmox With LAN GPU Inference 2026

This is the recommended staging plan if your Proxmox host is relatively small and you want GPU inference on separate LAN VM(s) or node(s).

This keeps Sven core services stable and lets you scale inference independently.

---

## Recommended Topology

Use:

- one Proxmox VM for Sven core staging
- one or more LAN-reachable inference VM(s) for GPU workloads

Reference shape:

```text
Public DNS / TLS
  |
  v
staging.sven.systems
admin.staging.sven.systems
  |
  v
Proxmox host
  |
  +--> VM: sven-staging-01
  |      - gateway-api
  |      - agent-runtime
  |      - admin-ui
  |      - canvas-ui
  |      - postgres
  |      - nats
  |      - opensearch
  |      - observability
  |
  +--> LAN --> VM/node: sven-inference-01
  |             - ollama / vllm
  |             - GPU attached or passed through
  |
  +--> LAN --> VM/node: sven-inference-02 (optional)
                - second inference endpoint for failover or model split
```

---

## Why This Topology

This is the correct fit when:

- Proxmox compute is enough for core app and storage, but not ideal for heavy GPU inference
- inference models need their own maintenance lifecycle
- you want the staging core node to stay responsive during model pulls and GPU churn

Avoid putting GPU-heavy inference on the same small Proxmox staging VM unless the host has clear headroom.

---

## VM Split

### `sven-staging-01`

Runs:

- gateway-api
- agent-runtime
- admin-ui
- canvas-ui
- postgres
- nats
- opensearch
- searxng
- observability

Suggested minimum:

- 8 vCPU
- 16 GB RAM
- 200 GB SSD

### `sven-inference-01`

Runs:

- ollama or vLLM
- model cache
- optional embedding endpoint if split from chat inference

Suggested minimum:

- GPU-capable host or VM
- RAM according to model footprint
- fast SSD for model cache

---

## Network Contract

Rules:

- only `sven-staging-01` is internet-facing
- inference nodes are reachable only from the staging VM or admin subnet
- inference endpoints are not public

Recommended addressing:

- `sven-staging-01.lan`
- `sven-inference-01.lan`
- `sven-inference-02.lan`

If you have multiple inference nodes, prefer a stable internal VIP or reverse proxy:

- `http://ollama-gateway.lan:11434`

That keeps Sven env files stable while inference nodes change behind it.

---

## Env Model

For this topology, set:

```env
SVEN_PUBLIC_BASE_URL=https://staging.sven.systems
SVEN_ADMIN_BASE_URL=https://admin.staging.sven.systems
OLLAMA_URL=http://sven-inference-01.lan:11434
EMBEDDINGS_URL=http://sven-inference-01.lan:11434
```

If using an internal load-balanced inference endpoint:

```env
OLLAMA_URL=http://ollama-gateway.lan:11434
EMBEDDINGS_URL=http://ollama-gateway.lan:11434
```

---

## GPU Routing Guidance

Recommended:

- keep chat inference and embeddings on the same endpoint for first staging pass
- split embeddings later only if measurement justifies it

If you add a second inference node:

- dedicate one node to chat generation
- dedicate one node to embeddings or heavy background jobs

Do not add this complexity before the single inference path is proven.

---

## Storage Guidance

Core staging VM:

- `/srv/sven/staging/...` for app state

Inference VM(s):

- dedicated model cache path
- optional NFS mount only if you have good reasons

Do not let inference cache compete with Postgres/OpenSearch disks on a constrained host.

---

## Promotion Rule

This topology is accepted only when:

- staging VM is stable
- inference node is reachable over LAN
- chat roundtrip uses the LAN inference endpoint successfully
- inference outage behavior is understood and documented

---

## Related

- [staging-linux-vm-2026.md](staging-linux-vm-2026.md)
- [staging-execution-plan-2026.md](staging-execution-plan-2026.md)
- [staging-host-bringup-checklist-2026.md](staging-host-bringup-checklist-2026.md)
