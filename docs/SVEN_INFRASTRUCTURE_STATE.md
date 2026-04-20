# Sven Infrastructure State

> Central reference for all 47Network infrastructure — VMs, networks, platforms,
> services, domains, and deployment topology. Maintained in `thesven` as the
> canonical archive so that Sven can track everything across all repos.

Last updated: 2025-07-17

---

## Table of Contents

1. [Network Topology](#1-network-topology)
2. [Sven Platform VMs](#2-sven-platform-vms)
3. [47Dynamics Platform VMs](#3-47dynamics-platform-vms)
4. [External / Relay Nodes](#4-external--relay-nodes)
5. [Domains & URLs](#5-domains--urls)
6. [Service Inventory — Sven Platform](#6-service-inventory--sven-platform)
7. [Service Inventory — 47Dynamics](#7-service-inventory--47dynamics)
8. [Service Inventory — AIStudio (VM17)](#8-service-inventory--aistudio-vm17)
9. [AI Model Router & GPU Allocation](#9-ai-model-router--gpu-allocation)
10. [Forgejo (VM21 / ferron)](#10-forgejo-vm21--ferron)
11. [Git Repositories](#11-git-repositories)
12. [Docker Networks](#12-docker-networks)
13. [Deployment Configurations](#13-deployment-configurations)
14. [SSH Keys & Access](#14-ssh-keys--access)
15. [Key Config Paths](#15-key-config-paths)
16. [TLS & Certificate Management](#16-tls--certificate-management)

---

## 1. Network Topology

| Network                    | Subnet             | Purpose                                  |
|----------------------------|---------------------|------------------------------------------|
| Sven WireGuard mesh        | `10.47.47.0/24`     | Sven platform inter-VM communication     |
| 47Dynamics WireGuard overlay | `10.47.0.0/24`    | 47Dynamics inter-VM communication        |
| 47Dynamics Internal LAN    | `10.74.74.0/24`     | Internal VM LAN (Proxmox)                |
| Physical LAN               | `192.168.10.0/24`   | Physical home/office LAN                 |

---

## 2. Sven Platform VMs

WireGuard mesh: `10.47.47.0/24`

| VM   | WireGuard IP    | Hostname         | Role                        | Key Services                                                                 |
|------|-----------------|------------------|-----------------------------|------------------------------------------------------------------------------|
| VM1  | `10.47.47.5`    | *(edge)*         | Edge proxy, TLS termination | Nginx (:44747), ACME (:9147), 47Dynamics stream                             |
| VM4  | `10.47.47.8`    | `sven-platform`  | Core Sven platform          | gateway-api:3000, admin-ui:3100, canvas-ui:3200, PG:5432, NATS:4222, nginx:8088 |
| VM5  | `10.47.47.9`    | `sven-ai`        | AI inference (primary)      | llama-server:8080 (RX 9070XT + 6750XT), LiteLLM:4000, voice services        |
| VM6  | `10.47.47.10`   | `sven-data`      | Data & observability        | OpenSearch:9200, Prometheus:9090, Grafana:9091, OTEL:4317/4318, Loki         |
| VM7  | `10.47.47.11`   | `sven-adapters`  | Messaging adapters          | 21 channel adapters, Cloudflared                                             |
| VM12 | `10.47.47.12`   | —                | Chat                        | Rocket.Chat (`talk.sven.systems`)                                            |
| VM13 | `10.47.47.13`   | `kaldorei`       | Fallback inference          | Ollama:11434 (RTX 3060)                                                      |
| VM14 | `10.47.47.14`   | `daedalus`       | 47Network website           | Static site (`sven.the47network.com`)                                        |
| VM17 | `10.47.47.17`   | —                | AIStudio / Sven Studio      | Caddy + API:8000 + Web:3000 (`studio.sven.systems`)                          |
| VM18 | `10.47.47.18`   | —                | Bootstrap target            | *(bootstrap-vms target)*                                                     |
| VM19 | `10.47.47.19`   | —                | Bootstrap target            | *(bootstrap-vms target)*                                                     |
| VM21 | `10.47.47.21`   | `ferron`         | Forgejo Git hosting         | Forgejo 9.0.3, PG 16, Runner v6.3.1 (`git.sven.systems`)                    |

---

## 3. 47Dynamics Platform VMs

WireGuard: `10.47.0.0/24` · Internal LAN: `10.74.74.0/24`

| VM   | VMID | Hostname    | WireGuard IP  | Internal IP    | Role                                 |
|------|------|-------------|---------------|----------------|--------------------------------------|
| VM1  | 200  | `vanta`     | `10.47.0.3`   | `10.74.74.5`   | Core platform + API gateway          |
| VM2  | 201  | `theralon`  | `10.47.0.4`   | `10.74.74.6`   | Data stores + observability          |
| VM3  | 202  | `dionysus`  | `10.47.0.5`   | `10.74.74.7`   | Frontend + AI (2× RTX 3060)         |

### VM1 — vanta (Core)

Keycloak:8080, api-go:4000 (HTTP) / 4002 (gRPC), ingest-go:4100,
PostgreSQL:5432, Redis:6379, Redpanda:9092, Vault:8200, Nginx:80/443

### VM2 — theralon (Data + Observability)

Prometheus:9090, Grafana:3100, Tempo:3200, OTEL Collector:4317,
ClickHouse:8123/9000, OpenSearch:9200, MinIO:9100

### VM3 — dionysus (Frontend + AI)

Next.js web:3000, FastAPI AI:4010, ChromaDB, Ollama (2× RTX 3060)

---

## 4. External / Relay Nodes

| Node           | IP                           | Role                          |
|----------------|------------------------------|-------------------------------|
| Caelith Relay  | `10.47.0.1` / `82.137.24.36`| Internet-facing WireGuard relay |
| Developer PC   | `10.47.0.2` / `192.168.10.79`| Development workstation       |
| Proxmox node   | `192.168.10.74`              | Hypervisor (SSH: root)        |
| LAN Gateway    | `192.168.10.1`               | DNS, domain: `ursu.cloud`     |

---

## 5. Domains & URLs

| Domain                          | Purpose                       | Backend                                     |
|---------------------------------|-------------------------------|----------------------------------------------|
| `sven.systems`                  | Landing page, installers      | Static host                                  |
| `app.sven.systems`              | Runtime: canvas, admin, API   | gateway-api via VM1 edge (:44747)            |
| `studio.sven.systems`           | Sven Studio IDE               | VM17 (Caddy → API:8000 + Web:3000)          |
| `market.sven.systems`           | Marketplace storefront        | Fastify:9478 + Next.js:3310                  |
| `eidolon.sven.systems`          | 3D agent city                 | Fastify:9479 + Next.js:3311                  |
| `talk.sven.systems`             | Rocket.Chat                   | VM12                                         |
| `git.sven.systems`              | Forgejo Git hosting           | VM21 (ferron) via VM1 edge                   |
| `*.from.sven.systems`           | Agent business spaces         | Wildcard                                     |
| `admin.sven.systems`            | Admin alias                   | → `app.sven.systems/admin47`                |
| `staging.sven.systems`          | Staging environment           | *(planned)*                                  |
| `sven.the47network.com`         | Marketing site                | VM14 (daedalus)                              |
| `the47network.com`              | 47Network main website        | VM14                                         |
| `dynamics.the47network.com`     | 47Dynamics main entry         | `82.137.24.36`                               |
| `app.dynamics.the47network.com` | 47Dynamics web frontend       | `82.137.24.36`                               |
| `api.dynamics.the47network.com` | 47Dynamics public API         | `82.137.24.36`                               |
| `auth.dynamics.the47network.com`| 47Dynamics Keycloak           | `82.137.24.36`                               |

TLS: all public traffic via Let's Encrypt + certbot. Sven edge on non-standard port **44747**, ACME on **9147**.

---

## 6. Service Inventory — Sven Platform

### Core Services (VM4)

| Service         | Port  | Protocol       |
|-----------------|-------|----------------|
| gateway-api     | 3000  | REST + WSS     |
| admin-ui        | 3100  | HTTP           |
| canvas-ui       | 3200  | HTTP           |
| PostgreSQL      | 5432  | TCP            |
| NATS JetStream  | 4222  | TCP            |
| NATS Monitor    | 8222  | HTTP           |
| nginx (internal)| 8088  | HTTP           |

### AI & Voice (VM5)

| Service         | Port  | Notes                        |
|-----------------|-------|------------------------------|
| llama-server    | 8080  | OpenAI-compat, RX 9070XT + 6750XT |
| LiteLLM         | 4000  | Multi-model router           |
| faster-whisper  | 8100  | STT                          |
| piper           | 8200  | TTS                          |
| wake-word       | 8300  | Wake word detection          |

### Data & Observability (VM6)

| Service         | Port       |
|-----------------|------------|
| OpenSearch      | 9200       |
| Prometheus      | 9090       |
| Grafana         | 9091       |
| OTEL Collector  | 4317/4318  |
| Loki            | —          |

### Adapters (VM7)

21 messaging channel adapters + Cloudflared tunnel.

### Specialty Services

| Service            | Description                                      |
|--------------------|--------------------------------------------------|
| agent-runtime      | LLM orchestration, tool dispatch                 |
| skill-runner       | Sandboxed tool execution (gVisor)                |
| workflow-executor  | Cron + one-shot scheduler                        |
| registry-worker    | Skill marketplace ingestion                      |
| notification-service | Push (FCM/APNs), email, in-app                 |
| rag-indexer        | Vector indexing (BM25 + pgvector)                |
| rag-git-ingestor   | Git repo ingestion                               |
| rag-nas-ingestor   | NAS/filesystem ingestion                         |
| rag-notes-ingestor | Notes app ingestion                              |
| searxng            | Private web search (:8080)                       |
| egress-proxy       | Outbound allowlist (Squid, :3128)                |
| sven-marketplace   | Marketplace API (:9478)                          |
| marketplace-ui     | Marketplace storefront (:3310)                   |
| sven-eidolon       | Agent city API + SSE (:9479)                     |
| eidolon-ui         | 3D city visualization (:3311)                    |

### Fallback Inference (VM13 / kaldorei)

Ollama:11434 on RTX 3060. Models: Qwen 2.5 7B, DeepSeek R1 7B, Llama 3.2 3B, Nomic Embed Text.

---

## 7. Service Inventory — 47Dynamics

### VM1 — vanta (Core)

| Service    | Port              |
|------------|-------------------|
| Keycloak   | 8080              |
| api-go     | 4000 (HTTP), 4002 (gRPC) |
| ingest-go  | 4100              |
| PostgreSQL | 5432              |
| Redis      | 6379              |
| Redpanda   | 9092              |
| Vault      | 8200              |
| Nginx      | 80/443            |

### VM2 — theralon (Data + Observability)

| Service        | Port       |
|----------------|------------|
| Prometheus     | 9090       |
| Grafana        | 3100       |
| Tempo          | 3200       |
| OTEL Collector | 4317       |
| ClickHouse     | 8123/9000  |
| OpenSearch     | 9200       |
| MinIO          | 9100       |

### VM3 — dionysus (Frontend + AI)

| Service     | Port  |
|-------------|-------|
| Next.js web | 3000  |
| FastAPI AI  | 4010  |
| ChromaDB    | —     |
| Ollama      | — (2× RTX 3060) |

---

## 8. Service Inventory — AIStudio (VM17)

| Service                | Port  | Description              |
|------------------------|-------|--------------------------|
| aistudio-api (uvicorn) | 8000  | FastAPI backend          |
| aistudio-worker        | —     | Async job processor      |
| aistudio-web (Next.js) | 3000  | Frontend                 |
| Caddy                  | 80/443| Reverse proxy            |
| PostgreSQL             | 5432  | Database (`aiteam`)      |

Deployed via `deploy-aistudio-vm17.sh`. systemd services: `aistudio-api`, `aistudio-worker`, `aistudio-web`.

---

## 9. AI Model Router & GPU Allocation

### LiteLLM Model Aliases (VM5)

| Alias        | Primary Model            | Fallback Chain                          |
|--------------|--------------------------|------------------------------------------|
| `coding`     | `copilot-claude-opus-4`  | `gemini-2.5-pro` → `gpt-4.1`           |
| `coding-fast`| `copilot-o3-mini`        | `gemini-2.5-flash` → `gpt-4o-mini`     |
| `reasoning`  | `copilot-o3-mini`        | `gemini-2.5-pro`                         |

### Local GPU Models

| VM   | GPU              | Models                                                  |
|------|------------------|---------------------------------------------------------|
| VM5  | RX 9070XT + 6750XT | Qwen 2.5 Coder 32B (via llama-server)                 |
| VM13 | RTX 3060          | Qwen 2.5 7B, DeepSeek R1 7B, Llama 3.2 3B, Nomic Embed Text |
| VM3 (Dynamics) | 2× RTX 3060 | Ollama (dynamics-specific models)               |

---

## 10. Forgejo (VM21 / ferron)

- **Web UI**: `https://chalybs.sven.systems/` (legacy name, use `git.sven.systems` for git ops)
- **Git clone/push**: `https://git.sven.systems/`
- **SSH**: port 2222
- **Version**: Forgejo 9.0.3
- **Database**: PostgreSQL 16 (low-memory tuned)
- **Runner**: Forgejo Runner v6.3.1 (host execution)
- **Backups**: Daily cron — Forgejo dump + pg_dumpall (14-day retention at `/var/backups/`)
- **Hardening**: COOKIE_SECURE, MIN_PASSWORD_LENGTH=12, DISABLE_REGISTRATION, ENABLE_SWAGGER=false

---

## 11. Git Repositories

All repos mirrored between GitHub (`github.com/47network`) and Forgejo (`git.sven.systems/47network`).

| Repo        | Local Path                                                | GitHub Repo           | Forgejo Repo           | Default Branch | Remotes                  |
|-------------|-----------------------------------------------------------|-----------------------|------------------------|----------------|--------------------------|
| thesven     | `E:\47Network-Dev\thesven`                                | 47network/thesven     | 47network/thesven      | `argentum`     | origin=forgejo, github   |
| 47Dynamics  | `E:\47Network-Dev\47Solutions\Software\47Dynamics`        | 47network/47dynamics  | 47network/dynamics     | `main`         | origin=forgejo, github   |
| AIStudio    | `E:\47Network-Dev\47Solutions\Software\AIStudio`          | 47network/svenstudio  | 47network/svenstudio   | —              | origin=forgejo, github   |
| 47Plate     | `E:\47Network-Dev\47Solutions\Mobile Apps\47Plate`        | 47network/47plate     | 47network/plate        | `main`         | origin=github, forgejo   |

Convention: `origin` = Forgejo (`git.sven.systems`), `github` = GitHub — except 47Plate which is reversed.

---

## 12. Docker Networks

### Sven Platform

| Network          | Purpose                                               |
|------------------|-------------------------------------------------------|
| `sven-core`      | postgres, nats, gateway-api, ollama, litellm, agent-runtime |
| `sven-tools`     | egress-proxy, nats, searxng, internal-nginx           |
| `sven-rag`       | opensearch, rag-indexer, rag-*-ingestor               |
| `sven-monitoring`| otel-collector, prometheus, grafana, loki, promtail   |

### Compose Profiles

`dev`, `staging`, `production` — with overrides: `docker-compose.{dev,staging,production}.yml`

---

## 13. Deployment Configurations

### Sven Platform

- **Process management**: PM2 (bare-metal/VM), systemd (`sven-compose-core.service`)
- **Production path**: `/srv/sven/prod/` → `app/`, `compose/`, `env/`, `data/`, `backups/`, `logs/`
- **Canary strategy**: 5% → 25% → 100% (gated)
- **Planned K8s**: Forgejo (`deploy/forgejo/`), Harbor (`deploy/harbor/`), ArgoCD (`deploy/argo-cd/`)

### AIStudio (VM17)

- Deployed via `deploy-aistudio-vm17.sh` (tar.gz extraction)
- Caddy reverse proxy for `studio.sven.systems`
- CORS: `https://studio.sven.systems,http://localhost:3000`

### Edge Proxy (VM1 / 10.47.47.5)

- Nginx stream + HTTP blocks
- TLS termination on port 44747
- `nginx-sven-domains.conf`: routes per-domain to backend VMs
- Also serves 47Dynamics domains
- Certbot webroot at `/var/www/certbot`

---

## 14. SSH Keys & Access

| Purpose     | Key Path                                                              |
|-------------|-----------------------------------------------------------------------|
| Sven        | `F:\47\47Network\Development\Info\k47-info\id_ed25519_sven`           |
| 47Dynamics  | `F:\47\47Network\Development\Info\k47-info\id_ed25519_47dynamics_original` |
| Proxmox     | SSH as root @ `192.168.10.74`                                         |

---

## 15. Key Config Paths

| Config                  | Path                                                    |
|-------------------------|---------------------------------------------------------|
| Sven runtime config     | `~/.sven/sven.json` or `$SVEN_CONFIG`                   |
| AIStudio secrets        | `/srv/aistudio/.runtime-secrets`                        |
| Sven production env     | `/srv/sven/prod/env/.env.production`                    |
| Caddy                   | `/etc/caddy/Caddyfile`                                  |
| Nginx (Sven domains)    | `/etc/nginx/conf.d/sven-domains.conf`                   |
| Nginx (multi-VM)        | `/srv/sven/prod/src/deploy/multi-vm/nginx/nginx.multi-vm.conf` |
| Bootstrap scripts       | `E:\47Network-Dev\47Solutions\Software\AIStudio\sven\vm-bootstrap\` |
| Certbot webroot         | `/var/www/certbot`                                      |

---

## 16. TLS & Certificate Management

- All public domains via **Let's Encrypt + certbot**
- Sven public traffic on non-standard port **44747**
- ACME challenge on port **9147**
- Certbot managed domains: `sven.systems`, `app.sven.systems`, `sven.the47network.com`, `studio.sven.systems`
- Caddy handles auto-TLS for `studio.sven.systems` on VM17
