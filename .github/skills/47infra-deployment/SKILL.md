# 47 Infrastructure & Deployment Reference

> Complete infrastructure, network, and deployment knowledge for Sven and 47Network.
> Covers: VM topology & IPs, WireGuard mesh, LAN, domains, 47Dynamics bridge, model
> router, full service registry, Docker Compose, nginx, TLS, secrets, PM2, systemd,
> Kubernetes, observability, mobile config, security threat model.

---

## WireGuard Mesh Network

**Subnet:** `10.47.47.0/24`
**Trusted proxy range:** `10.47.47.0/24`, `127.0.0.1`

| VM   | Hostname        | WireGuard IP  | Role                                             | Hardware                                            |
|:-----|:----------------|:--------------|:-------------------------------------------------|:----------------------------------------------------|
| VM1  | —               | `10.47.47.5`  | Edge proxy / TLS termination                     | —                                                   |
| VM4  | sven-platform   | `10.47.47.8`  | Core platform (gateway, agent-runtime, PG, NATS, nginx) | 12–16 cores, 16–32 GB RAM, 200–500 GB NVMe        |
| VM5  | sven-ai (VM9)   | `10.47.47.9`  | Primary AI inference (llama-server, LiteLLM, voice) | 12–16 cores, 32–64 GB RAM, **RX 9070 XT (16 GiB) + RX 6750 XT (12 GiB)** |
| VM6  | sven-data       | `10.47.47.10` | OpenSearch, RAG, SearXNG, OTEL, Prometheus, Grafana, Loki | 12–16 cores, 16–32 GB RAM, 500 GB–1 TB NVMe |
| VM7  | sven-adapters   | `10.47.47.11` | 20+ channel adapters, Cloudflared                | 8 cores, 16 GB RAM, 50–100 GB SSD                  |
| VM12 | —               | `10.47.47.12` | Rocket.Chat (`talk.sven.systems`)                | —                                                   |
| VM13 | kaldorei        | `10.47.47.13` | GPU fallback — Ollama fast inference             | 8 cores, 32 GB RAM, **NVIDIA RTX 3060 (12 GiB)**  |
| VM14 | daedalus        | `10.47.47.14` | 47network website (`the47network.com`, `plate.the47network.com`) | —                                |

### Multi-VM Compose Files

| VM   | Compose File                              |
|:-----|:------------------------------------------|
| VM4  | `docker-compose.yml`                      |
| VM5  | `docker-compose.vm5-ai.yml`              |
| VM6  | `docker-compose.vm6-data.yml`            |
| VM7  | `docker-compose.vm7-adapters.yml`        |
| VM13 | `docker-compose.yml` (VM13 profile)       |

### VM Env File Location
```
/srv/sven/prod/src/deploy/multi-vm/.env
```

### Metrics Token (separate file)
```
VM6: /srv/sven/prod/src/deploy/multi-vm/secrets/metrics-token
```

### VM SSH Hostnames (for scripts)
`sven-platform`, `sven-ai`, `sven-data`, `sven-adapters`

---

## LAN / Physical Network

| Asset              | IP / Address         | Notes                          |
|:-------------------|:---------------------|:-------------------------------|
| LAN gateway/DNS    | `192.168.10.1`       | Domain: `ursu.cloud`           |
| Wi-Fi SSID         | `XLVII`              | 5 GHz, Wi-Fi 5                 |
| Dev machine        | `192.168.10.79`      | Gateway API on `:3000`         |
| Android test device| `192.168.10.121`     | —                              |
| Proxmox node       | `192.168.10.74`      | SSH user: `root`               |
| Docker host ingress| `192.168.7.59:8088`  | sven-internal-nginx            |

---

## Public Domains & DNS

| Domain                           | Purpose                                           |
|:---------------------------------|:--------------------------------------------------|
| `sven.systems`                   | Static: landing page, suite, installer scripts    |
| `app.sven.systems`               | Runtime: canvas, community, docs, admin, API      |
| `admin.sven.systems`             | Optional redirect → `app.sven.systems/admin47`    |
| `talk.sven.systems`              | Rocket.Chat (VM12, proxied by VM4 edge nginx)     |
| `sven.47matrix.online`           | Static installer host (transitional)              |
| `sven.glyph.47matrix.online`     | Runtime host (transitional)                       |
| `the47network.com`               | 47Network website (VM14)                          |
| `plate.the47network.com`         | Plate subdomain (VM14, port 8080)                 |

**Contact emails:** `support@the47network.com`, `privacy@the47network.com`, `security@the47network.com`

### TLS Port
All HTTPS traffic on port **44747** (non-standard — used to avoid conflicts).
ACME challenge port: **9147** (local certbot proxy).

### DNS Records Needed
```
A    sven.systems        -> <PUBLIC_EDGE_IP>
A    app.sven.systems    -> <PUBLIC_EDGE_IP>
A    talk.sven.systems   -> <PUBLIC_EDGE_IP>
AAAA sven.systems        -> <PUBLIC_EDGE_IPV6>  (optional)
AAAA app.sven.systems    -> <PUBLIC_EDGE_IPV6>  (optional)
```

---

## Service Ports (Internal)

| Service              | Port  | Listener         |
|:---------------------|:------|:-----------------|
| gateway-api          | 3000  | `127.0.0.1`     |
| admin-ui             | 3100  | `127.0.0.1`     |
| canvas-ui            | 3200  | `127.0.0.1`     |
| postgres             | 5432  | `127.0.0.1`     |
| NATS client          | 4222  | `127.0.0.1`     |
| NATS monitor         | 8222  | `127.0.0.1`     |
| Ollama               | 11434 | `127.0.0.1`     |
| LiteLLM              | 4000  | `0.0.0.0`       |
| OpenSearch           | 9200  | `127.0.0.1`     |
| Prometheus           | 9090  | `0.0.0.0`       |
| Grafana              | 9091  | `0.0.0.0` (→3000 internal) |
| OTEL gRPC            | 4317  | `0.0.0.0`       |
| OTEL HTTP            | 4318  | `0.0.0.0`       |
| Sven internal nginx  | 8088  | `0.0.0.0`       |
| compute-mesh         | 9470  | `0.0.0.0`       |
| model-router         | 9471  | `0.0.0.0`       |
| security-toolkit     | 9472  | `0.0.0.0`       |
| document-intel       | 9473  | `0.0.0.0`       |
| marketing-intel      | 9474  | `0.0.0.0`       |
| proactive-notifier   | 9475  | `0.0.0.0`       |
| quantum-sim          | 9476  | `0.0.0.0`       |
| piper (TTS)          | 4200  | `0.0.0.0`       |
| wake-word            | 4400  | `0.0.0.0`       |
| openwakeword         | 4410  | `0.0.0.0`       |

---

## 47Dynamics Bridge Integration

### Overview
47Dynamics operates as org `47dynamics-legacy` on TheSven, communicating over mTLS-authenticated gRPC.

### gRPC Contract
**File:** `contracts/grpc/sven-bridge/v1/sven_bridge.proto`
- **Package:** `fortyseven.sven.bridge.v1`
- **Go package:** `github.com/47network/47dynamics/api-go/internal/svenbridge/pb`
- **Transport:** mTLS gRPC over HTTP/2
- **Auth:** Keycloak service-account `client_credentials` + per-call `tenant_id` header

**RPCs:**
| RPC                  | Description                                         |
|:---------------------|:----------------------------------------------------|
| `CopilotAsk`         | RAG-augmented Q&A (replaces Python AI `POST /copilot/ask`) |
| `CopilotAskStream`   | Streaming token delivery                            |
| `SubmitAction`        | AI action for human-in-the-loop approval            |
| `GetActionStatus`     | Check action status (pending/approved/rejected/executed/expired) |
| `EdgeSummarize`       | CPU-quantized edge summarization                    |
| `IndexDomainKnowledge`| Index 47D domain data into RAG pipeline             |
| `RunbookSuggest`      | RAG-powered runbook recommendations                 |
| `HealthCheck`         | Backend health probe                                |

**Key Messages:**
- `TenantContext` (tenant_id, correlation_id)
- `OperationalContext` (device/alert/ticket summaries)
- `RiskLevel` enum (low/medium/high/critical)
- `KnowledgeType` enum (device_doc, patch_catalog, kb_article, security_advisory, runbook, ticket_history, monitoring_data)
- `ServiceHealth` enum (healthy/degraded/unhealthy)

### Database Bootstrap Migration
**File:** `services/gateway-api/migrations/20260319120000_47dynamics_legacy_tenant_bootstrap.sql`

Creates:
1. **Org:** `47dynamics-legacy-org` (slug: `47dynamics-legacy`)
2. **Service user:** `47dynamics-svc` (role: admin, A2A API key, never interactive login)
3. **Agent:** `47dynamics-copilot` — "47Dynamics RMM Copilot" (model: auto, profile: performance)
   - Capabilities: `rag_search`, `runbook_lookup`, `device_context`, `alert_context`, `action_proposal`
   - RAG collections: `device_docs`, `patch_catalog`, `kb_articles`, `security_advisories`, `runbooks`, `ticket_history`, `monitoring_data`
4. **HQ chat:** `47dynamics-hq` (type: hq, org-scoped)
5. **Routing rule:** all messages on channel `47dynamics` → copilot agent
6. **Settings:** tenant enabled, rate limit 120rpm/60s, isolation `strict`

### Admin API Routes
```
GET    /v1/admin/integrations/47dynamics/tenant-mappings
POST   /v1/admin/integrations/47dynamics/tenant-mappings
GET    /v1/admin/integrations/47dynamics/tenant-mappings/:id
PUT    /v1/admin/integrations/47dynamics/tenant-mappings/:id
DELETE /v1/admin/integrations/47dynamics/tenant-mappings/:id
GET    /v1/admin/integrations/47dynamics/tenant-mappings/:id/health
```

### Bridge Environment Variables
- `SVEN_BRIDGE_SERVICE_TOKEN` — authenticates bridge ↔ gateway (rotate every 180 days)
- `BRIDGE_REQUIRE_TENANT_MAPPING` — enforce tenant mapping before requests pass

### Bridge CI Workflow
**File:** `.github/workflows/bridge-runtime-tests.yml`
- Triggers: push/PR touching `services/bridge-47dynamics/**`
- Provisional gate pass if package.json doesn't exist yet
- Artifacts: coverage + `docs/release/status/bridge-*-latest.json`

### Bridge Service
**Path:** `services/bridge-47dynamics/` — directory exists (source not yet initialized)

---

## Model Router / AI Inference Registry

**File:** `packages/model-router/src/registry/index.ts`

### Locally Deployed Models

| Model ID              | Name                | Host           | Endpoint                       | GPU                          | Runtime      | Notes                    |
|:----------------------|:--------------------|:---------------|:-------------------------------|:-----------------------------|:-------------|:-------------------------|
| `qwen2.5-coder-32b`  | Qwen 2.5 Coder 32B | vm5-sven-ai    | `http://10.47.47.9:8080/v1`   | RX 9070 XT + RX 6750 XT     | llama-server | Q4_K_M, tensor-split 57/43 |
| `qwen2.5-7b`         | Qwen 2.5 7B        | vm13-kaldorei  | `http://10.47.47.13:11434`    | RTX 3060                     | ollama       | —                        |
| `deepseek-r1-7b`     | DeepSeek R1 7B      | vm13-kaldorei  | `http://10.47.47.13:11434`    | RTX 3060                     | ollama       | —                        |
| `llama3.2-3b`        | Llama 3.2 3B        | vm13-kaldorei  | `http://10.47.47.13:11434`    | RTX 3060                     | ollama       | —                        |
| `nomic-embed-text`   | Nomic Embed Text    | vm13-kaldorei  | `http://10.47.47.13:11434`    | RTX 3060                     | ollama       | fp16, dim=768            |

### LiteLLM Routing Aliases (production)
| Alias          | Primary Model               | Fallbacks                                |
|:---------------|:----------------------------|:-----------------------------------------|
| `coding`       | `copilot-claude-opus-4`     | `gemini-2.5-pro` → `gpt-4.1`            |
| `coding-fast`  | `copilot-o3-mini`           | `gemini-2.5-flash` → `gpt-4o-mini`      |
| `reasoning`    | `copilot-o3-mini`           | `gemini-2.5-pro`                         |

### Agent Model Environment Variables
```env
SVEN_AGENT_DEFAULT_MODEL=gpt-4o
SVEN_AGENT_CODING_MODEL=coding
SVEN_AGENT_FAST_MODEL=coding-fast
```

---

## Full Service Registry (48 services)

### Core Platform
`gateway-api`, `agent-runtime`, `skill-runner`, `registry-worker`, `notification-service`, `workflow-executor`, `bridge-47dynamics`, `sven-mirror-agent`

### AI / Voice / ML
`litellm`, `model-router`, `faster-whisper`, `piper`, `wake-word`, `openwakeword-detector`

### RAG Pipeline
`rag-indexer`, `rag-nas-ingestor`, `rag-git-ingestor`, `rag-notes-ingestor`

### Intelligence Modules
`compute-mesh`, `security-toolkit`, `document-intel`, `marketing-intel`, `proactive-notifier`, `quantum-sim`

### Infrastructure
`egress-proxy`, `searxng`, `sven-internal-nginx`

### Channel Adapters (21)
| Adapter                    | Port | Profile(s)                    |
|:---------------------------|:-----|:------------------------------|
| `adapter-discord`          | —    | `adapters`, `discord`         |
| `adapter-slack`            | —    | `adapters`, `slack`           |
| `adapter-telegram`         | —    | `adapters`, `telegram`        |
| `adapter-matrix`           | —    | `adapters`, `matrix`          |
| `adapter-zalo`             | 8484 | `adapters`, `zalo`            |
| `adapter-zalo-personal`    | 8485 | `adapters`, `zalo-personal`   |
| `adapter-teams`            | 3978 | `adapters`, `teams`           |
| `adapter-google-chat`      | 8080 | `adapters`, `google-chat`     |
| `adapter-feishu`           | 8489 | `adapters`, `feishu`          |
| `adapter-mattermost`       | 8491 | `adapters`, `mattermost`      |
| `adapter-voice-call`       | 8490 | `adapters`, `voice-call`      |
| `adapter-line`             | 8488 | `adapters`, `line`            |
| `adapter-whatsapp`         | 8443 | `adapters`, `whatsapp`        |
| `adapter-whatsapp-personal`| 8444 | `adapters`, `whatsapp-personal`|
| `adapter-signal`           | —    | `adapters`, `signal`          |
| `adapter-imessage`         | —    | `adapters`, `imessage`        |
| `adapter-webchat`          | 3100 | `adapters`, `webchat`         |
| `adapter-irc`              | 8496 | `adapters`, `irc`             |
| `adapter-nostr`            | 8492 | `adapters`, `nostr`           |
| `adapter-tlon`             | 8493 | `adapters`, `tlon`            |
| `adapter-twitch`           | 8494 | `adapters`, `twitch`          |
| `adapter-nextcloud-talk`   | 8495 | `adapters`, `nextcloud-talk`  |

### Apps
`admin-ui`, `canvas-ui`, `companion-desktop-tauri`, `companion-user-flutter`

---

## Nginx Proxy Architecture

### Topology Options

1. **Standalone Nginx** — Sven host terminates TLS directly
   - Config: `config/nginx/sven-47matrix.conf`

2. **External Nginx + Internal Sven Nginx** — external proxy/LB forwards to internal
   - External: `config/nginx/extnginx-sven-installers.conf`, `extnginx-sven-app.conf`
   - Internal: `config/nginx/sven-internal-ingress.conf`
   - Rate limits: `config/nginx/extnginx-rate-limit-policy.conf`
   - Dockerized internal: `config/nginx/sven-internal-ingress.docker.conf` (`:8088`)

3. **Caddy** — `config/caddy/Sven.Caddyfile`
4. **Traefik** — `config/traefik/sven-dynamic.yml`

### Key Nginx Config Patterns

**Upstreams:**
```nginx
upstream sven_gateway_api { server 127.0.0.1:3000; keepalive 32; }
upstream sven_admin_ui    { server 127.0.0.1:3100; keepalive 16; }
upstream sven_canvas_ui   { server 127.0.0.1:3200; keepalive 16; }
```

**Route Ownership (runtime host):**
```
/v1/*       → gateway-api (API + WebSocket upgrade)
/healthz    → gateway-api
/readyz     → gateway-api
/admin47    → admin-ui (optional IP allowlist)
/webchat/*  → webchat widget proxy (long timeout 3600s)
/canvas     → 301 redirect to /
/           → canvas-ui (default root)
```

**Route Ownership (static host):**
```
/             → landing page (index.html)
/suite        → suite SPA
/install.sh   → text/plain installer
/install.ps1  → text/plain installer
/install.cmd  → text/plain installer
```

**Security Headers (external nginx):**
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Resource-Policy "same-site" always;
```

**SSE / Streaming endpoints** need:
```nginx
proxy_buffering off;
proxy_cache off;
proxy_send_timeout 3600s;
proxy_read_timeout 3600s;
```

### Rate Limiting (nginx http{} context)
```nginx
limit_req_zone  $binary_remote_addr zone=sven_global_per_ip:10m rate=30r/s;
limit_req_zone  $binary_remote_addr zone=sven_auth_per_ip:10m   rate=10r/m;
limit_conn_zone $binary_remote_addr zone=sven_conn_per_ip:10m;
```
Usage: `limit_conn sven_conn_per_ip 30;` and `limit_req zone=sven_global_per_ip burst=120 nodelay;`

### Admin Access Lockdown
File: `/etc/nginx/conf.d/sven-admin47-access/allowlist.conf`
```nginx
allow 127.0.0.1;
allow ::1;
# allow <TRUSTED_IP>;
# allow <VPN_CIDR>;
deny all;
```

### SSL/TLS
- Protocol: `TLSv1.2 TLSv1.3` only
- Ciphers: ECDHE-ECDSA/RSA with AES-GCM
- Cert paths:
  - Certbot: `/etc/letsencrypt/live/<domain>/fullchain.pem` + `privkey.pem`
  - ACME (acme.sh P256): `/etc/nginx/ssl/<domain>_P256/fullchain.cer` + `private.key`
- ACME challenge proxy: `http://127.0.0.1:9147` for `.well-known/acme-challenge/`

### Install Certbot
```bash
sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sven.systems -d app.sven.systems
```

### Install Nginx Config
```bash
sudo cp config/nginx/sven-47matrix.conf /etc/nginx/sites-available/sven.conf
sudo ln -s /etc/nginx/sites-available/sven.conf /etc/nginx/sites-enabled/sven.conf
sudo nginx -t && sudo systemctl reload nginx
```

---

## Docker Compose

### Core Stack
```bash
# Start core services
docker compose up -d postgres nats gateway-api sven-internal-nginx

# Start full stack
docker compose up -d

# Production overlay
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d

# With monitoring logs (Loki + Promtail)
docker compose --profile monitoring-logs up -d
```

### Service Images (pinned by SHA256)
- postgres: `pgvector/pgvector` (with WAL archiving enabled)
- nats: `nats` (JetStream enabled, store dir `/data`)
- ollama: `ollama/ollama` (GPU: nvidia driver, count 1)
- opensearch: `opensearchproject/opensearch` (single-node, JAVA_OPTS -Xms512m -Xmx512m)
- litellm: `ghcr.io/berriai/litellm`
- otel-collector: `otel/opentelemetry-collector-contrib`
- prometheus: `prom/prometheus` (7d retention)
- grafana: `grafana/grafana`
- nginx: `nginx` (internal ingress)
- searxng: `searxng/searxng`
- egress-proxy: `ubuntu/squid`

### Production Resource Limits
| Service              | CPU   | Memory |
|:---------------------|:------|:-------|
| postgres             | 2.00  | 2G     |
| gateway-api          | 1.50  | 1G     |
| agent-runtime        | 1.00  | 768M   |
| skill-runner         | 1.50  | 1G     |
| ollama               | 4.00  | 8G     |
| opensearch           | 2.00  | 2G     |
| prometheus           | 1.50  | 1G     |
| grafana              | 1.00  | 768M   |
| otel-collector       | 1.00  | 768M   |
| nats                 | 1.00  | 768M   |
| notification-service | 1.00  | 768M   |
| piper (TTS)          | 1.50  | 1G     |
| rag-indexer          | 1.50  | 1G     |
| egress-proxy         | 0.50  | 256M   |

### Docker Networks
- `core` — postgres, nats, gateway-api, ollama, litellm, agent-runtime
- `tools` — egress-proxy, nats, searxng, internal-nginx
- `rag` — opensearch, rag services
- `monitoring` — otel-collector, prometheus, grafana, loki, promtail

### Volumes
- `pgdata` — PostgreSQL data
- `pgwalarchive` — WAL archive
- `natsdata` — NATS JetStream
- `ollama` — Ollama models
- `osdata` — OpenSearch
- `prometheus-data` — Prometheus TSDB
- `grafana-data` — Grafana state
- `searxng-data` — SearXNG
- `loki-data` — Loki (optional)
- `tunnel-data` — Cloudflare tunnel state
- `zalo-personal-data` — Zalo sessions
- `whatsapp-personal-sessions` — WhatsApp sessions
- `browser-profile` — Browser state
- `gitdata` — Git data
- `mirror-agent-data` — Mirror agent state
- `loki-archive` — Loki cold archive

### Compose Overlay Files
| File                                  | Purpose                                    |
|:--------------------------------------|:-------------------------------------------|
| `docker-compose.yml`                  | Base (all services)                        |
| `docker-compose.production.yml`       | Production resource limits, read_only, tmpfs |
| `docker-compose.staging.yml`          | Staging: smaller OpenSearch JVM, 2d retention |
| `docker-compose.dev.yml`              | Dev: NODE_ENV=development, Tailscale off   |
| `docker-compose.profiles.yml`         | Profile assignments (dev/staging/production) |
| `docker-compose.47dynamics-bridge.yml`| 47Dynamics bridge service                  |
| `docker-compose.sso-idp.yml`          | SSO/IDP services (not yet created)         |

### Special Docker Compose Profiles
| Service            | Profile          | Notes                              |
|:-------------------|:-----------------|:-----------------------------------|
| cloudflared        | `tunnel`         | Cloudflare tunnel to nginx:80      |
| sven-mirror-agent  | `mirror`         | Smart mirror / kiosk / sensor hub  |
| quickstart-static  | `legacy-ingress` | Legacy nginx on port 18088         |
| litellm            | `litellm`        | LiteLLM proxy                      |
| loki               | `monitoring-logs`| Log aggregation                    |
| promtail           | `monitoring-logs`| Log shipping                       |
| loki-cold-archive  | `monitoring-logs`| Tar.gz archival, 90d retention     |

### Multi-VM Test Compose
**File:** `deploy/multi-vm/docker-compose.vm-agents-test.yml`
- Isolated test env: `postgres-test:15432`, `nats-test:14222`, `gateway-api-test:13100`
- Network: `sven-agents-test`

---

## Network Topology

### NATS URLs by Context
| Context        | URL                                |
|:---------------|:-----------------------------------|
| Docker Compose | `nats://nats:4222`                 |
| PM2 local dev  | `nats://127.0.0.1:59530`          |
| CI workflows   | `nats://localhost:4222`            |
| Multi-VM mesh  | `nats://10.47.47.4:4222`          |

### Tunnel Providers
- **Cloudflare Tunnel:** `cloudflared` container (profile: `tunnel`), tunnels `sven-internal-nginx:80`
- **Tailscale:** `GATEWAY_TAILSCALE_MODE` (`off`|`serve`|`funnel`), auth bootstrap: `/v1/auth/tailscale/bootstrap`
- **WireGuard:** `10.47.47.0/24` mesh connecting all VMs

### Rate Limits (application level)
| Scope          | Limit             |
|:---------------|:------------------|
| Global API     | 200 req/min       |
| Login          | 10/min            |
| Bootstrap      | 3/min             |
| TOTP           | 5/min             |
| Brute-force    | 5 attempts → 15min lockout |

---

## PM2 (Non-Docker Deployment)

Config: `config/pm2/ecosystem.config.cjs`

### Services Managed by PM2
| PM2 Name            | Working Dir              | Script            | Port |
|:--------------------|:-------------------------|:------------------|:-----|
| sven-gateway-api    | services/gateway-api     | dist/index.js     | 3000 |
| sven-agent-runtime  | services/agent-runtime   | dist/index.js     | —    |
| sven-admin-ui       | apps/admin-ui            | next start --port | 3100 |
| sven-canvas-ui      | apps/canvas-ui           | next start --port | 3200 |

### PM2 Commands
```bash
pm2 start config/pm2/ecosystem.config.cjs
pm2 restart all
pm2 logs sven-gateway-api --lines 100
pm2 monit
```

### Default DB Connection (PM2/dev)
```
postgresql://sven:sven-dev-47@127.0.0.1:5432/sven
```

---

## Systemd

Config: `config/systemd/sven-compose-core.service`

### Enable Auto-Start
```bash
sudo cp config/systemd/sven-compose-core.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sven-compose-core.service
sudo systemctl start sven-compose-core.service
```

This starts: `postgres`, `nats`, `gateway-api`, `sven-internal-nginx` on boot.

---

## Required Secrets

### Production Required (config/env/prod.required.json)
- `DATABASE_URL`
- `COOKIE_SECRET`
- `NATS_URL`
- `OPENAI_API_KEY`
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `MAESTRO_CLOUD_API_KEY`

### Critical Secrets (rotate every 90 days)
| Secret                | Scope         | Generate                       |
|:----------------------|:--------------|:-------------------------------|
| `POSTGRES_PASSWORD`   | All VMs       | `openssl rand -base64 24 \| tr -d '/+=' \| head -c 24` |
| `COOKIE_SECRET`       | VM4           | `openssl rand -hex 32`         |
| `SVEN_ADAPTER_TOKEN`  | All VMs       | `openssl rand -hex 32`         |
| `ADMIN_PASSWORD`      | VM4           | `openssl rand -base64 24 \| tr -d '/+=' \| head -c 24` |

### High Priority Secrets (rotate every 180 days)
| Secret                      | Scope  |
|:----------------------------|:-------|
| `OPENSEARCH_PASSWORD`       | VM4,6  |
| `LITELLM_MASTER_KEY`        | VM5    |
| `SVEN_BRIDGE_SERVICE_TOKEN` | VM4    |
| `SVEN_METRICS_AUTH_TOKEN`   | VM4,6  |
| `GRAFANA_ADMIN_PASSWORD`    | VM6    |

### AI Provider Keys (rotate per vendor policy)
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` / `GEMINI_API_KEY`
- `AZURE_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`
- `GITHUB_COPILOT_TOKEN` (Classic PAT with `copilot` scope)
- `GITHUB_TOKEN` (for GitHub Models free tier)
- `HF_TOKEN` (HuggingFace)

### Channel Adapter Keys
- Discord: `DISCORD_TOKEN`
- Slack: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`
- Telegram: `TELEGRAM_TOKEN`
- WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
- Teams: `TEAMS_APP_ID`, `TEAMS_APP_PASSWORD`, `TEAMS_TENANT_ID`
- Matrix: `MATRIX_ACCESS_TOKEN`
- Signal: `SIGNAL_CLI_URL`, `SIGNAL_NUMBER`
- Voice (Twilio/Telnyx/Plivo): respective `SID`/`AUTH_TOKEN`/`API_KEY` pairs
- And more: IRC, Nostr, Feishu, Mattermost, Nextcloud Talk, LINE, Zalo, Twitch

### Federation Keys
- `SVEN_INSTANCE_ID`, `SVEN_INSTANCE_NAME`, `SVEN_PUBLIC_URL`
- `SVEN_FEDERATION_KEY_SECRET`
- `SVEN_DEFAULT_ORG_ID`

### Secret Generation Cheatsheet
```bash
# 64-char hex (cookies, adapter tokens)
openssl rand -hex 32

# 48-char hex (metrics tokens)
openssl rand -hex 24

# Alphanumeric password (DB, admin, Grafana)
openssl rand -base64 24 | tr -d '/+=' | head -c 24
```

---

## Key Rotation

Full procedure: `docs/KEY_ROTATION.md`

### Master Encryption Key Rotation (encrypts user DEKs)
1. Generate new master key with `age-keygen` or SOPS
2. Register in `master_key_metadata` table (inactive)
3. Stop services: `docker compose stop gateway-api agent-runtime skill-runner`
4. Re-encrypt all user DEKs: `npm run key-rotate --workspace services/gateway-api`
5. Mark new key active, old key deprecated
6. Restart services
7. Keep old key available for 30 days for recovery

### Rollback
```sql
UPDATE master_key_metadata SET is_active = FALSE WHERE key_version = 2;
UPDATE master_key_metadata SET is_active = TRUE WHERE key_version = 1;
```

---

## Kubernetes (Production Scale)

Path: `deploy/k8s/production-scale/`

### Validate Manifests
```bash
kubectl kustomize deploy/k8s/production-scale/base > /dev/null
kubectl kustomize deploy/k8s/production-scale/overlays/staging > /dev/null
kubectl kustomize deploy/k8s/production-scale/overlays/prod > /dev/null
```

### Reference Topology
```
Users → Managed DNS → Ingress/LB
  ├── admin-ui replicas
  ├── canvas-ui replicas
  ├── gateway-api replicas → NATS cluster → Postgres HA → OpenSearch cluster
  ├── agent-runtime replicas
  └── GPU node pool (Ollama/vLLM)
```

### When to Scale to K8s
- Need HA beyond single host
- Maintenance windows must not cause user-facing downtime
- Single node can't handle agent/runtime/search load
- You have operator maturity for cluster operations

---

## Observability Stack

| Component         | Config File                           | Purpose                    |
|:------------------|:--------------------------------------|:---------------------------|
| OTEL Collector    | `config/otel-collector-config.yaml`   | Trace/metric collection    |
| Prometheus        | `config/prometheus.yml`               | Metrics scraping (7d ret.) |
| Prometheus Alerts | `config/prometheus-alerts.yml`        | Alert rules                |
| Grafana           | `config/grafana/provisioning/`        | Dashboards & datasources   |
| Loki              | `config/loki-config.yml`              | Log aggregation (optional) |
| Promtail          | `config/promtail-config.yml`          | Log shipping (local)       |
| Promtail Remote   | `config/promtail-remote.yml`          | Log shipping (multi-VM)    |

### Prometheus Scrape Targets
- `otel-collector:8889` (15s interval)
- `localhost:9090` (Prometheus self)
- `gateway-api:3000/metrics` (10s interval)
- `agent-runtime` (DNS SD, port 9100)
- `skill-runner` (DNS SD, port 9100)
- `postgres:5432`
- `nats:8222/metrics`
- External labels: `cluster: sven-prod`, `environment: local`

### Prometheus Alert Rules
| Alert                      | Condition                      | Severity |
|:---------------------------|:-------------------------------|:---------|
| SvenGatewayApiDown         | up==0 for 2m                   | critical |
| SvenAgentRuntimeDown       | up==0 for 3m                   | warning  |
| SvenSkillRunnerDown        | up==0 for 3m                   | warning  |
| SvenNatsExporterDown       | up==0 for 3m                   | warning  |
| SvenHighErrorRate          | >5% for 5m                     | critical |
| SvenHighP95Latency         | >2x baseline for 10m           | warning  |
| SvenNatsConsumerLag        | >1000 pending for 5m           | warning  |
| SvenPostgresPoolExhaustion | >80% for 5m                    | warning  |
| SvenServiceRestart         | process restart detected       | info     |
| SvenDiskUsageWarning       | >85% for 5m                    | warning  |
| SvenDiskUsageCritical      | >95% for 2m                    | critical |
| SvenHighMemoryUsage        | gateway >1GB RSS for 10m       | warning  |
| SvenIncidentModeActive     | kill_switch or lockdown for 1m | critical |

### OTEL Collector Pipeline
- **Receivers:** OTLP gRPC (`:4317`), OTLP HTTP (`:4318`)
- **Processors:** batch (10s, 1024 batch size)
- **Exporters:** traces → debug, metrics → prometheus (`:8889`)

### Promtail Remote (Multi-VM)
- Pushes to `http://${LOKI_HOST:-10.47.47.10}:3100/loki/api/v1/push` (VM6)
- Labels: `job: docker`, `vm: ${VM_NAME}`
- Timezone: `Europe/Bucharest` (Grafana default)

---

## Quick Installer

### One-Liner Install (Unix)
```bash
curl -fsSL https://sven.systems/install.sh | sh
```

### One-Liner Install (Windows)
```powershell
irm https://sven.systems/install.ps1 | iex
```

### Installer Env Vars
```bash
SVEN_REPO_URL=           # Git clone URL (if using git)
SVEN_SOURCE_ARCHIVE_URL= # Tarball URL (default)
SVEN_BRANCH=main
SVEN_INSTALL_DIR=$HOME/.sven-src
SVEN_GATEWAY_URL=https://app.sven.systems
SVEN_INSTALL_BOOTSTRAP=0  # Set 1 for auto-bootstrap
```

---

## Restart Procedures

### Multi-VM Ordered Restart
```bash
# VM5 (AI services)
ssh vm5 "cd /opt/sven && docker compose -f docker-compose.vm5-ai.yml down"
ssh vm5 "cd /opt/sven && docker compose -f docker-compose.vm5-ai.yml up -d --wait"

# VM7 (Adapters)
ssh vm7 "cd /opt/sven && docker compose -f docker-compose.vm7-adapters.yml down"
ssh vm7 "cd /opt/sven && docker compose -f docker-compose.vm7-adapters.yml up -d --wait"

# Verify health
npm run release:multi-vm:restart:health:check
```

### VM Restart Drill
```bash
npm run ops:release:vm-restart-drill:strict    # dry run
npm run ops:release:vm-restart-drill:execute   # real drill
npm run release:vm-restart:drill:evidence:check
```

---

## Environment Templates

- Development: `config/env/.env.development.example`
- Staging: `config/env/.env.staging.example`
- Production: `config/env/.env.production.example`

### Key Environment Variables
```env
ENVIRONMENT=production
NODE_ENV=production
SVEN_DEPLOYMENT_MODE=production
DATABASE_URL=postgresql://...
NATS_URL=nats://...
GATEWAY_PORT=3000
POSTGRES_DB=sven
CORS_ORIGIN=https://app.sven.systems
SVEN_AGENT_DEFAULT_MODEL=gpt-4o
SVEN_AGENT_CODING_MODEL=coding
SVEN_AGENT_FAST_MODEL=coding-fast
```

---

## Staging Host Minimum Requirements

| Resource | Minimum  | Preferred (with local inference) |
|:---------|:---------|:---------------------------------|
| CPU      | 8 vCPU   | 12+ vCPU                         |
| RAM      | 16 GB    | 32 GB                            |
| Disk     | 200 GB SSD | Fast NVMe                      |
| GPU      | Optional | Local GPU for inference           |

---

## File Index (Config)

```
config/
├── caddy/Sven.Caddyfile              # Caddy ingress
├── env/.env.*.example                 # Env templates
├── env/{dev,staging,prod}.required.json
├── grafana/provisioning/              # Grafana dashboards/datasources
├── loki-config.yml                    # Loki log aggregation
├── nginx/
│   ├── sven-47matrix.conf             # Standalone nginx (TLS termination)
│   ├── sven-47matrix-behind-edge.conf # Behind external proxy
│   ├── sven-internal-ingress.conf     # Internal nginx (path routing)
│   ├── sven-internal-ingress.docker.conf  # Dockerized internal nginx
│   ├── extnginx-sven-app.conf        # External nginx (app host)
│   ├── extnginx-sven-installers.conf  # External nginx (installer host)
│   ├── extnginx-rate-limit-policy.conf
│   ├── sven-admin47-access.example.conf
│   └── ssl/                           # TLS certs (P256)
├── otel-collector-config.yaml
├── pm2/ecosystem.config.cjs           # PM2 process manager
├── prometheus.yml
├── prometheus-alerts.yml
├── promtail-config.yml
├── systemd/sven-compose-core.service  # Auto-start on boot
└── traefik/sven-dynamic.yml           # Traefik ingress
```

```
deploy/
├── k8s/production-scale/              # Kustomize manifests
├── multi-vm/RUNBOOK.md                # Multi-VM deployment runbook
├── nginx/                             # Extra nginx configs
└── quickstart/                        # Installer landing page & scripts
```

```
docs/deploy/
├── ingress-topologies.md              # Choose your proxy topology
├── nginx-47matrix-domains.md          # Domain setup guide
├── staging-bare-metal-2026.md         # Single-host staging
├── production-scale-2026.md           # K8s scale-out
├── sven-systems-cutover-checklist-2026.md  # Public domain cutover
└── ...
```

```
docs/security/
├── secrets-inventory-2026.md
├── secrets-rotation-schedule-production.md
├── threat-model.md                    # STRIDE threat model (10 categories)
├── KEY_ROTATION.md                    # Master encryption key rotation
└── ...
```

---

## Mobile Production Config

**File:** `config/env/mobile-dart-defines.release.local.json`

| Key                        | Value                                    |
|:---------------------------|:-----------------------------------------|
| `SVEN_API_BASE`            | `https://app.sven.systems`               |
| `SVEN_API_CERT_SHA256_PINS`| 2 pinned certificate hashes (SSL pinning)|
| Firebase iOS bundle ID     | `com.fortyseven.thesven`                 |
| Firebase project           | `379390504662`                           |
| Firebase web auth domain   | `thesven.firebaseapp.com`                |

---

## Deployment Ladder

| Stage            | Host Model                    | Runtime                           |
|:-----------------|:------------------------------|:----------------------------------|
| Local dev        | Developer machine             | Docker Compose / PM2              |
| Staging          | Single Linux VM               | Docker Compose                    |
| Production v1    | Single hardened Linux VM      | Docker Compose + managed ops      |
| Production scale | Multiple Linux VMs / nodes    | Kubernetes or Nomad               |

### Production v1 Path Layout
```
/srv/sven/prod/
├── app/                    # Application code
├── compose/                # Docker Compose files
├── env/                    # Environment files
├── data/
│   ├── postgres/           # PG data dir
│   ├── nats/               # NATS JetStream
│   ├── opensearch/         # OpenSearch data
│   └── artifacts/          # Build artifacts
├── backups/                # Database backups
└── logs/                   # Application logs
```

---

## Security Threat Model

**File:** `docs/security/threat-model.md`

10 threat categories documented:
1. **Prompt Injection** — Mitigation: input sanitization, output encoding
2. **Data Exfiltration via Tool Calls** — Mitigation: egress proxy, tool call approval
3. **Privilege Escalation** — Mitigation: RBAC, kill switch
4. **DoS / Token Exhaustion** — Mitigation: rate limiting (200 req/min global)
5. **Secret Leakage** — Mitigation: secret scanning, structured logging
6. **Supply Chain (Malicious Skills)** — Mitigation: skill quarantine, trust levels
7. **Cross-Agent Contamination** — Mitigation: org isolation
8. **Unauthorized Channel Access** — Mitigation: adapter tokens, channel auth
9. **Session Hijacking** — Mitigation: secure/HttpOnly/SameSite cookies
10. **Man-in-the-Middle** — Mitigation: HSTS, cert pinning, TLS 1.2+

Key mitigations: egress proxy allowlist, Docker network isolation, `helmet` headers, CSP, brute-force lockout (5 attempts → 15min).