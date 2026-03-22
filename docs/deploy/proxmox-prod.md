# Linux/Proxmox Production Deployment

This document defines a Proxmox-based specialization of the production v1 topology for Sven.

It is not a separate deployment ladder tier. Use it when production v1 is still the correct operational stage, but you want VM separation or LAN-isolated inference.

Primary ladder references:

- [production-v1-linux-vm-2026.md](production-v1-linux-vm-2026.md)
- [production-v1-rollout-plan-2026.md](production-v1-rollout-plan-2026.md)
- [production-scale-2026.md](production-scale-2026.md)

## 1) VM Split

Use two VMs:

- `sven-core`
  - Runs gateway, runtime, workers, adapters, Postgres, NATS, OpenSearch, monitoring.
  - CPU/RAM prioritized for orchestration and indexing.
- `sven-inference`
  - Runs Ollama/vLLM and optional GPU services.
  - Isolated for model updates and accelerator scheduling.

## 2) NFS Mounts

On each VM:

```bash
sudo apt-get update
sudo apt-get install -y nfs-common
sudo mkdir -p /nas/shared /nas/users /nas/git
```

Mount examples:

```bash
sudo mount -t nfs -o nfsvers=4.1 <NAS_IP>:/volume1/shared /nas/shared
sudo mount -t nfs -o nfsvers=4.1 <NAS_IP>:/volume1/users /nas/users
sudo mount -t nfs -o nfsvers=4.1 <NAS_IP>:/volume1/git /nas/git
```

Persist with `/etc/fstab`:

```fstab
<NAS_IP>:/volume1/shared /nas/shared nfs nfsvers=4.1,_netdev 0 0
<NAS_IP>:/volume1/users  /nas/users  nfs nfsvers=4.1,_netdev 0 0
<NAS_IP>:/volume1/git    /nas/git    nfs nfsvers=4.1,_netdev 0 0
```

## 3) Network and Firewall

Recommended network zones:

- `dmz` (optional): ingress reverse proxy only.
- `core`: `sven-core` private service network.
- `inference`: `sven-inference` private network, reachable only from `sven-core`.

Ingress allowlist:

- `443/tcp` to reverse proxy (public).
- Optional `22/tcp` from admin subnet only.

Internal allowlist (core <-> inference):

- Inference API port(s) (e.g. `11434`).
- Metrics ports if scraped internally.

Deny all other inbound by default.

## 4) Compose Deployment Order

On `sven-core`:

```bash
docker compose pull
docker compose up -d postgres nats opensearch
docker compose up -d gateway-api agent-runtime skill-runner notification-service rag-indexer workflow-executor
docker compose --profile adapters up -d
```

On `sven-inference`, run inference stack and expose only to `sven-core`.

## 5) Public Domain Ingress (Nginx)

For the chosen public split:

- One-liners: `example.com`
- App/UI/API: `app.example.com`

Follow:

- `docs/deploy/nginx-47matrix-domains.md`
- `docs/deploy/ingress-topologies.md`
- `config/nginx/sven-47matrix.conf`
- `docs/deploy/edge-nginx-and-traefik-options.md`

## 6) Boot Auto-Start (systemd)

To ensure the installer and API endpoints come back after host reboot, install the systemd compose bootstrap unit:

```bash
sh scripts/ops/sh/install-systemd-compose-core.sh /opt/sven/app
```

Or via dispatcher:

```bash
sh scripts/ops/sh/ops.sh ingress install-systemd-core /opt/sven/app
```

This enables `sven-compose-core.service` from:

- `config/systemd/sven-compose-core.service`

The service reasserts:

- `postgres`
- `nats`
- `gateway-api`
- `quickstart-static`

Verification:

```bash
systemctl status sven-compose-core.service --no-pager
curl -I https://example.com/install.sh
curl -I https://app.example.com/healthz
```

