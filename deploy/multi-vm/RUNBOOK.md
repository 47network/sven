# Sven Multi-VM Deployment Runbook

## Overview

This runbook covers provisioning, operating, and troubleshooting the Sven multi-VM production deployment across 4 virtual machines.

## Topology

| VM | Role | Internal IP | WireGuard IP | Containers | Services |
|----|------|-------------|--------------|------------|----------|
| VM4 | Platform | 10.47.47.8 | 10.47.0.6 | 15 | PostgreSQL+pgvector, NATS, Gateway API, Agent Runtime, Skill Runner, Registry Worker, Notification, Workflow Executor, bridge-47dynamics, Nginx, node-exporter, NATS-exporter, pg-exporter, OpenFGA, Promtail |
| VM5 | AI & Voice | 10.47.47.9 | 10.47.0.7 | 6 | llama-server/Ollama (AMD RX 9070 XT + RX 6750 XT), LiteLLM, faster-whisper, Piper TTS, Wake-word, Promtail |
| VM6 | Data & Observability | 10.47.47.10 | 10.47.0.8 | 12 | OpenSearch, RAG Indexer, RAG Ingestors, SearXNG, Egress Proxy, OTEL, Prometheus, Grafana, Loki, Promtail, node-exporter |
| VM7 | Adapters | 10.47.47.11 | 10.47.0.9 | 7 active + 14 stopped | Channel Adapters (Discord, Slack, Telegram, etc.), Cloudflared, Mirror, Promtail |

## Integrated External Service Hosts

These are Sven-managed companion services that are not part of the core 4-VM
stack, but are still fronted by the VM4 edge ingress and should be treated as
part of the live Sven environment.

| Host VM | Internal IP | Public Host | Service | Notes |
|---|---|---|---|---|
| VM12 | 10.47.47.12 | `talk.sven.systems` | Rocket.Chat | Reverse-proxied by VM4 nginx with WebSocket upgrade support and dedicated Let's Encrypt certificate paths under `/etc/letsencrypt/live/talk.sven.systems/` |

### Resource Requirements

#### Minimum Specifications

| VM | CPU | RAM | Disk | GPU | Network |
|----|-----|-----|------|-----|---------|
| VM4 (Platform) | 12 cores | 16 GB | 200 GB NVMe/SSD | None | 1 Gbps |
| VM5 (AI & Voice) | 12 cores | 32 GB | 100 GB SSD | AMD RX 9070 XT (16 GiB) + RX 6750 XT (12 GiB) | 1 Gbps |
| VM6 (Data & Obs.) | 12 cores | 16 GB | 500 GB NVMe/SSD | None | 1 Gbps |
| VM7 (Adapters) | 8 cores | 16 GB | 50 GB SSD | None | 1 Gbps |
| **Total** | **44 cores** | **80 GB** | **850 GB** | **RX 9070 XT + RX 6750 XT** | |

#### Recommended Specifications (production / 10x headroom)

| VM | CPU | RAM | Disk | GPU | Notes |
|----|-----|-----|------|-----|-------|
| VM4 (Platform) | 16 cores | 32 GB | 500 GB NVMe | None | PostgreSQL benefits from fast storage and RAM for shared_buffers/connections |
| VM5 (AI & Voice) | 16 cores | 64 GB | 200 GB NVMe | AMD RX 9070 XT (16 GiB) + RX 6750 XT (12 GiB) | llama-server tensor-split across both GPUs; Ollama optional (profile). System RAM for CPU‑offloaded layers |
| VM6 (Data & Obs.) | 16 cores | 32 GB | 1 TB NVMe | None | OpenSearch JVM heap + Prometheus TSDB + Loki chunks grow with retention |
| VM7 (Adapters) | 8 cores | 16 GB | 100 GB SSD | None | Adapters are IO‑bound; rarely CPU‑bound even at scale |
| **Total** | **56 cores** | **144 GB** | **1.8 TB** | **RX 9070 XT + RX 6750 XT** | |

#### Per-Service Resource Limits (from Docker Compose)

**VM4 — Platform** (container limits sum: ~12.25 CPU / ~7.5 GB RAM)

| Service | CPU Limit | RAM Limit | Notes |
|---------|-----------|-----------|-------|
| PostgreSQL + pgvector | 2.0 | 2 GB | Main data store; tune `shared_buffers` to 25% of VM RAM |
| NATS JetStream | 1.0 | 768 MB | Event bus; JetStream file store on fast disk |
| Gateway API | 1.5 | 1 GB | Fastify HTTP gateway — request fan‑out |
| Agent Runtime | 1.0 | 768 MB | Agent orchestration loop |
| Skill Runner | 1.5 | 1 GB | Executes user‑defined skills |
| Registry Worker | 0.75 | 512 MB | Skill/addon registry maintenance |
| Notification | 1.0 | 768 MB | Push/email/webhook dispatch |
| Workflow Executor | 1.0 | 768 MB | Long‑running workflow state machine |
| bridge-47dynamics | 1.0 | 512 MB | gRPC bridge to 47Dynamics |
| pg-exporter | 0.5 | 256 MB | Prometheus PostgreSQL metrics |
| Nginx | 1.0 | 256 MB | TLS termination / reverse proxy |

**VM5 — AI & Voice** (container limits sum: ~12.5 CPU / ~30 GB RAM)

| Service | CPU Limit | RAM Limit | GPU | Notes |
|---------|-----------|-----------|-----|-------|
| Ollama | 6.0 | 24 GB | RX 9070 XT + RX 6750 XT (ROCm) | LLM inference; tensor-split across both GPUs; RAM limit for CPU‑offloaded layers |
| LiteLLM | 2.0 | 2 GB | No | Proxy/router to Ollama, OpenAI, Anthropic, etc. |
| faster-whisper | 2.0 | 2 GB | Yes (shared) | Speech‑to‑text; GPU accelerated via CTranslate2 |
| Piper TTS | 1.5 | 1 GB | No | Text‑to‑speech; CPU‑only, lightweight |
| Wake-word | 1.0 | 768 MB | No | Keyword detection for voice activation |

**VM6 — Data & Observability** (container limits sum: ~12.5 CPU / ~10 GB RAM)

| Service | CPU Limit | RAM Limit | Notes |
|---------|-----------|-----------|-------|
| OpenSearch | 2.0 | 2 GB | Full‑text + vector search; set JVM heap to 50% of limit |
| RAG Indexer | 1.5 | 1 GB | Orchestrates embedding + index pipeline |
| RAG Ingestor (events) | 1.0 | 768 MB | Consumes NATS events for indexing |
| RAG Ingestor (docs) | 1.0 | 768 MB | Document chunking + embedding |
| RAG Ingestor (web) | 1.0 | 768 MB | Web scrape + embedding |
| SearXNG | 1.0 | 768 MB | Metasearch engine for web‑augmented retrieval |
| Egress Proxy (Squid) | 0.5 | 256 MB | HTTP/S proxy for outbound traffic control |
| OTEL Collector | 1.0 | 768 MB | Traces + metrics collection/forwarding |
| Prometheus | 1.5 | 1 GB | TSDB; retention scales disk usage (~1.5 bytes/sample) |
| Grafana | 1.0 | 768 MB | Dashboards + alerting UI |
| Loki | 1.0 | 1 GB | Log aggregation; chunk storage on disk |

**VM7 — Adapters** (container limits sum: ~11 CPU / ~11 GB RAM)

| Service | CPU Limit | RAM Limit | Notes |
|---------|-----------|-----------|-------|
| Each adapter (×20) | 0.5 | 512 MB | IO‑bound WebSocket/HTTP; peak CPU rare |
| Cloudflared | 0.5 | 512 MB | Cloudflare Tunnel ingress |
| Mirror | 0.5 | 512 MB | Message mirroring/routing |

> **Note:** Container CPU limits are additive maximums, not sustained usage.
> Typical steady-state utilisation is 30–50% of limits. The "minimum" specs
> above provide ~20% headroom over container limit sums to account for OS,
> Docker daemon, WireGuard, and node-exporter overhead.

## Prerequisites

- Debian 12 or Ubuntu 22.04+ on all VMs
- Network connectivity between all VMs (10.47.47.x subnet)
- Root or sudo access on all VMs
- DNS records pointing to VM4 for the domain
- ROCm + amdgpu-dkms installed on VM5 (AMD RX 9070 XT + RX 6750 XT); NVIDIA driver on VM13 (RTX 3060)

## Deployment Sequence

**Order matters.** Deploy VMs in this sequence to satisfy service dependencies:

### Step 1: Generate Certificates (from any machine)

```bash
cd deploy/multi-vm/scripts
sudo bash generate-certs.sh \
  --output-dir /srv/sven/prod/ssl \
  --domain app.sven.systems
```

Distribute certificates to each VM:
- VM4: `ssl/nginx/`, `ssl/postgres/`, `ssl/grpc/`
- VM1 (47Dynamics): `ssl/grpc/client.*` + `ssl/ca/ca.crt`

### Step 2: Deploy VM4 (Platform) — First

```bash
sudo bash install-multi-node.sh \
  --vm-role platform \
  --domain app.sven.systems \
  --data-dir /srv/sven/prod
```

Wait for PostgreSQL and NATS to be healthy before proceeding:
```bash
docker compose -f /srv/sven/prod/compose/docker-compose.yml ps
# All services should show "healthy"
```

### Step 3: Deploy VM6 (Data) — Second

```bash
sudo bash install-multi-node.sh \
  --vm-role data \
  --data-dir /srv/sven/prod
```

VM6 needs VM4's PostgreSQL and NATS. Verify cross-VM connectivity:
```bash
# From VM6, verify VM4 is reachable
nc -zv 10.47.47.8 5432  # PostgreSQL
nc -zv 10.47.47.8 4222  # NATS
```

### Step 4: Deploy VM5 (AI) — Third

```bash
sudo bash install-multi-node.sh \
  --vm-role ai \
  --data-dir /srv/sven/prod
```

Verify GPU passthrough:
```bash
docker exec sven-ollama nvidia-smi
```

Pull required models:
```bash
docker exec sven-ollama ollama pull llama3.1:8b
docker exec sven-ollama ollama pull nomic-embed-text:latest
```

### Step 5: Deploy VM7 (Adapters) — Last

```bash
sudo bash install-multi-node.sh \
  --vm-role adapters \
  --data-dir /srv/sven/prod
```

Only deploy the adapters you need. Use Docker Compose profiles:
```bash
# Deploy only Discord and Slack adapters
docker compose --profile discord --profile slack up -d
```

### Step 6: Configure WireGuard (all VMs)

On each VM:
```bash
cp deploy/multi-vm/wireguard/wg0.vmN.conf /etc/wireguard/wg0.conf
# Edit: replace all __*__ placeholders with real keys
wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/public.key
chmod 600 /etc/wireguard/private.key
# Exchange public keys between VMs, update configs
systemctl enable --now wg-quick@wg0
wg show  # Verify peers
```

## Cross-VM Connectivity Map

```
VM7 (Adapters)
  │
  └──→ VM4:3000 (Gateway API)
  └──→ VM6:4318 (OTEL)

VM5 (AI)
  │
  ├──→ VM4:5432 (PostgreSQL)
  ├──→ VM4:4222 (NATS)
  └──→ VM6:4318 (OTEL)

VM6 (Data)
  │
  ├──→ VM4:5432 (PostgreSQL)
  ├──→ VM4:4222 (NATS)
  └──→ VM5:11434 (Ollama - embeddings)

VM4 (Platform)
  │
  ├──→ VM5:11434 (Ollama)
  ├──→ VM5:4000 (LiteLLM)
  ├──→ VM6:9200 (OpenSearch)
  ├──→ VM6:4318 (OTEL)
  └──→ VM1:4020 (47Dynamics bridge - gRPC mTLS)
```

## Operations

### SSH Access

SSH aliases are configured for each VM:
```bash
ssh sven-platform   # VM4 (10.47.47.8)
ssh sven-ai         # VM5 (10.47.47.9)
ssh sven-data       # VM6 (10.47.47.10)
ssh sven-adapters   # VM7 (10.47.47.11)
```

SSH key: `~/.ssh/id_ed25519_sven`, user: `hantz`

### Docker Compose Commands

All compose commands MUST use the explicit file and env-file flags:
```bash
cd /srv/sven/prod/src
sudo docker compose -f deploy/multi-vm/docker-compose.vm4-platform.yml --env-file deploy/multi-vm/.env <command>
sudo docker compose -f deploy/multi-vm/docker-compose.vm5-ai.yml      --env-file deploy/multi-vm/.env <command>
sudo docker compose -f deploy/multi-vm/docker-compose.vm6-data.yml     --env-file deploy/multi-vm/.env <command>
sudo docker compose -f deploy/multi-vm/docker-compose.vm7-adapters.yml --env-file deploy/multi-vm/.env <command>
```

Examples:
```bash
# Status
sudo docker compose -f deploy/multi-vm/docker-compose.vm4-platform.yml --env-file deploy/multi-vm/.env ps

# Restart one service
sudo docker compose -f deploy/multi-vm/docker-compose.vm4-platform.yml --env-file deploy/multi-vm/.env restart gateway-api

# Pull and recreate
sudo docker compose -f deploy/multi-vm/docker-compose.vm4-platform.yml --env-file deploy/multi-vm/.env pull <service>
sudo docker compose -f deploy/multi-vm/docker-compose.vm4-platform.yml --env-file deploy/multi-vm/.env up -d <service>
```

### Restart-stable VM5/VM7 recovery

Use `up -d --wait` after restarts so Docker waits for compose healthchecks instead of returning immediately while AI and adapter processes are still cold-starting.

```bash
# VM5: restart AI/voice services and wait for healthchecks
sudo docker compose -f deploy/multi-vm/docker-compose.vm5-ai.yml --env-file deploy/multi-vm/.env up -d --wait

# VM7: restart only the enabled profiles and wait for healthchecks
sudo docker compose -f deploy/multi-vm/docker-compose.vm7-adapters.yml --env-file deploy/multi-vm/.env --profile adapters --profile tunnel up -d --wait

# Repo-side regression check for VM5/VM7 restart health coverage
npm run -s release:multi-vm:restart:health:check

# Emit a dated VM restart drill artifact without touching live services
npm run -s ops:release:vm-restart-drill:strict

# Execute the waited restart drill on-host and refresh the latest evidence
npm run -s ops:release:vm-restart-drill:execute

# Verify the emitted drill evidence is fresh and structurally valid
npm run -s release:vm-restart:drill:evidence:check
```

This preserves the current LAN and WireGuard bindings. The change is limited to health verification and safer restart sequencing.

### Start / Stop Services

```bash
# Start (on any VM)
systemctl start sven-<role>

# Stop
systemctl stop sven-<role>

# Restart
systemctl restart sven-<role>

# Status
systemctl status sven-<role>
```

### View Logs

```bash
# All services on a VM
docker compose -f /srv/sven/prod/compose/docker-compose.yml logs -f

# Specific service
docker compose -f /srv/sven/prod/compose/docker-compose.yml logs -f gateway-api

# Last 100 lines
docker compose -f /srv/sven/prod/compose/docker-compose.yml logs --tail 100 gateway-api
```

### Health Checks

```bash
# Gateway API health
curl -s http://10.47.47.8:3000/healthz

# Gateway API readiness
curl -s http://10.47.47.8:3000/readyz

# PostgreSQL
docker exec sven-postgres pg_isready -U sven

# NATS
curl -s http://10.47.47.8:8222/healthz

# OpenSearch
curl -s -u admin:PASSWORD http://10.47.47.10:9200/_cluster/health

# Ollama
curl -s http://10.47.47.9:11434/api/tags

# LiteLLM
curl -s http://10.47.47.9:4000/health
```

### 47Dynamics Bridge Integration Rollout

Run this sequence when deploying bridge integration changes:

```bash
# 1) Apply DB migrations on VM4 (gateway-api container)
cd /srv/sven/prod/src
sudo docker compose -f deploy/multi-vm/docker-compose.vm4-platform.yml --env-file deploy/multi-vm/.env exec gateway-api node dist/db/migrate.js

# 2) Restart gateway and bridge on VM4
sudo docker compose -f deploy/multi-vm/docker-compose.vm4-platform.yml --env-file deploy/multi-vm/.env up -d gateway-api bridge-47dynamics

# 3) Restart rag-indexer on VM6 (required for RunbookSuggest query handling)
sudo docker compose -f deploy/multi-vm/docker-compose.vm6-data.yml --env-file deploy/multi-vm/.env up -d rag-indexer
```

Bridge tenant mapping management API (on VM4 gateway):

```bash
# list mappings for active org
curl -sS -H "Cookie: sven_session=<session>" \
  "http://10.47.47.8:3000/v1/admin/integrations/47dynamics/tenant-mappings"

# upsert one tenant mapping
curl -sS -X POST -H "Cookie: sven_session=<session>" -H "Content-Type: application/json" \
  "http://10.47.47.8:3000/v1/admin/integrations/47dynamics/tenant-mappings" \
  -d '{
    "external_tenant_id":"tenant-001",
    "organization_id":"47dynamics-legacy-org",
    "chat_id":"47dynamics-hq",
    "agent_id":"47dynamics-copilot",
    "is_active":true
  }'

# audit mapping integrity and strict-mode readiness
curl -sS -H "Cookie: sven_session=<session>" \
  "http://10.47.47.8:3000/v1/admin/integrations/47dynamics/tenant-mappings/health?include_inactive=false"
```

Strict mode cutover:

```bash
# In deploy/multi-vm/.env set:
SVEN_BRIDGE_REQUIRE_TENANT_MAPPING=true

# Optional legacy alias (also accepted by bridge service):
# BRIDGE_REQUIRE_TENANT_MAPPING=true

# Then restart only bridge on VM4
sudo docker compose -f deploy/multi-vm/docker-compose.vm4-platform.yml --env-file deploy/multi-vm/.env up -d bridge-47dynamics
```

Only enable strict mode when `strict_mode_ready=true` and `invalid_active_mappings=0` from the health endpoint.
Keep `SVEN_BRIDGE_REQUIRE_TENANT_MAPPING=false` (or legacy alias `BRIDGE_REQUIRE_TENANT_MAPPING=false`) until all production 47Dynamics tenants are explicitly mapped.

### Backup

```bash
# Backup VM4 (platform)
sudo bash backup-restore.sh backup --vm-role platform

# Backup VM6 (data)
sudo bash backup-restore.sh backup --vm-role data

# Backup VM5 (AI models)
sudo bash backup-restore.sh backup --vm-role ai

# List backups
sudo bash backup-restore.sh list --vm-role platform

# Verify backup integrity
sudo bash backup-restore.sh verify --vm-role platform --backup-name platform-20260320_120000
```

### Restore

```bash
# Stop services, restore, restart
sudo bash backup-restore.sh restore --vm-role platform --backup-name platform-20260320_120000
```

### Certificate Renewal

Let's Encrypt auto-renews via certbot. For manual renewal:
```bash
certbot renew --deploy-hook=/etc/letsencrypt/renewal-hooks/deploy/sven.sh
```

For self-signed:
```bash
sudo bash generate-certs.sh --nginx-only --domain app.sven.systems
docker exec sven-nginx nginx -s reload
```

## Monitoring

### Access Grafana

Via nginx proxy: `https://app.sven.systems/grafana/`
Direct: `http://10.47.47.10:9091`
Default credentials: `admin` / (see `.env.vm6` `GRAFANA_ADMIN_PASSWORD`)

### Dashboards

| Dashboard | Panels | Purpose |
|-----------|--------|---------|
| Sven Infrastructure | 25 | VM CPU/memory/disk/network, PostgreSQL, NATS JetStream, Prometheus targets |
| Sven System Health | 8 | Service health, API response times, error rates, message throughput |
| Sven Agent Dashboard | 6 | Agent runtime metrics |
| Sven Channel Dashboard | 5 | Channel adapter metrics |
| Sven Cost Dashboard | 7 | LLM/API cost tracking |
| Sven Security Dashboard | 7 | Auth failures, rate limiting |
| Sven Parity Production Gates | 6 | Production readiness gates |

### Alert Rules

9 Grafana alert rules provisioned from `config/grafana/provisioning/alerting/alerts.yml`:

| Rule | Trigger | For | Severity |
|------|---------|-----|----------|
| High CPU Usage | > 85% avg | 5m | warning |
| High Memory Usage | > 90% | 5m | critical |
| High Disk Usage | > 85% | 5m | warning |
| PostgreSQL Connection Saturation | > 80% of max | 5m | warning |
| PostgreSQL Deadlocks | > 0 in 5m | 1m | critical |
| Gateway API High Error Rate | > 5% 5xx | 5m | critical |
| Gateway API High Latency | p99 > 2s | 5m | warning |
| NATS High Pending Messages | > 10,000 | 5m | warning |
| Prometheus Target Down | any target `up == 0` | 2m | critical |

### Prometheus Targets (11 scrape targets)

| Job | Instance | Source |
|-----|----------|--------|
| sven-gateway-api | 10.47.47.8:3000 | Gateway API /metrics |
| sven-agent-runtime | 10.47.47.8:3010 | Agent Runtime /metrics |
| sven-skill-runner | 10.47.47.8:3020 | Skill Runner /metrics |
| sven-registry-worker | 10.47.47.8:3030 | Registry Worker /metrics |
| sven-notification | 10.47.47.8:3040 | Notification /metrics |
| sven-workflow | 10.47.47.8:3050 | Workflow Executor /metrics |
| sven-openfga | 10.47.47.8:4020 | OpenFGA /metrics |
| node-exporter | 10.47.47.8-11:9100 | Node Exporter (all 4 VMs) |
| postgres-exporter | 10.47.47.8:9187 | PostgreSQL Exporter |
| nats-exporter | 10.47.47.8:7777 | NATS Exporter |
| prometheus | localhost:9090 | Self-scrape |

Verify all targets: `http://10.47.47.10:9090/targets`

### Centralized Logging (Loki + Promtail)

All 4 VMs ship container logs to Loki on VM6 via Promtail.

| VM | Promtail Config | VM Label | Push Target |
|----|-----------------|----------|-------------|
| VM4 | `config/promtail-remote.yml` | `vm4-platform` | `http://10.47.47.10:3100` |
| VM5 | `config/promtail-remote.yml` | `vm5-ai` | `http://10.47.47.10:3100` |
| VM6 | `config/promtail-config.yml` | `vm6-data` | `loki:3100` (Docker internal) |
| VM7 | `config/promtail-remote.yml` | `vm7-adapters` | `http://10.47.47.10:3100` |

Loki is bound to `${VM6_INTERNAL_IP:-10.47.47.10}:3100` (LAN only, not localhost).

Query logs in Grafana LogQL:
```
{vm="vm4-platform"}                     # All VM4 logs
{vm="vm4-platform",container="gateway-api"}  # Specific container
{vm=~"vm.*"} |= "error"                 # Errors across all VMs
```

**Important:** Loki ingestion rate limits are configured in `config/loki-config.yml`:
- `ingestion_rate_mb: 16` (default 4 is too low for initial backlog)
- `ingestion_burst_size_mb: 32`
- `per_stream_rate_limit: 5MB`
- `per_stream_rate_limit_burst: 15MB`

Remote Promtail uses `-config.expand-env=true` for env var substitution in config.

### Key Metrics

| Metric | Location | Alert Threshold |
|--------|----------|-----------------|
| Gateway API p99 latency | Prometheus | > 2s |
| PostgreSQL active connections | Prometheus | > 80% of max |
| NATS pending messages | NATS monitoring | > 10,000 |
| OpenSearch cluster health | OpenSearch API | Yellow/Red |
| Ollama GPU utilization | nvidia-smi | Sustained 100% |
| Disk usage per VM | Node Exporter | > 85% |
| Memory usage per VM | Node Exporter | > 90% |

### Prometheus Targets

Verify all scrape targets are up: `http://10.47.47.10:9090/targets`

## Troubleshooting

### Service won't start

1. Check logs: `docker compose logs -f <service>`
2. Check resource limits: `docker stats`
3. Verify `.env` values: no remaining `replace-with-*` placeholders
4. Check disk space: `df -h`
5. Verify cross-VM connectivity: `nc -zv <target_ip> <port>`

### Cross-VM connection refused

1. Verify the target VM's firewall allows the port: `ufw status`
2. Verify WireGuard is up: `wg show`
3. Verify the service is listening: `ss -tlnp | grep <port>`
4. Check Docker network binding: service must bind to `${VM_INTERNAL_IP}` not just `127.0.0.1`

### PostgreSQL connection failures from remote VMs

1. Check `pg_hba.conf` allows connections from remote IPs
2. Verify PostgreSQL is listening on all interfaces (not just localhost)
3. Test: `psql -h 10.47.47.8 -U sven -d sven -c "SELECT 1"`

### Ollama GPU not available

1. Verify NVIDIA drivers: `nvidia-smi`
2. Verify NVIDIA Container Toolkit: `docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi`
3. Check Docker daemon.json has nvidia runtime configured
4. Restart Docker: `systemctl restart docker`

### OpenSearch cluster RED

1. Check disk watermarks: `curl -s http://localhost:9200/_cluster/settings?include_defaults | jq '.defaults.cluster.routing.allocation.disk'`
2. Check unassigned shards: `curl -s http://localhost:9200/_cat/shards?v | grep UNASSIGNED`
3. Check node health: `curl -s http://localhost:9200/_cat/nodes?v`

### High memory usage on VM4

1. Check per-container usage: `docker stats --no-stream`
2. PostgreSQL shared_buffers may need tuning for available RAM
3. NATS JetStream storage may need purging: check stream sizes
4. Consider moving some services to dedicated VM

### Adapters disconnecting

1. Check adapter logs for token/auth errors
2. Verify `GATEWAY_URL` points to correct VM4 IP
3. Check Cloudflare Tunnel status: `docker logs sven-cloudflared`
4. Verify adapter tokens haven't expired

### Loki ingestion rate limit (429 errors)

If Promtail logs show `429 Too Many Requests` from Loki:
1. Check current limits: `config/loki-config.yml` → `limits_config`
2. Increase `ingestion_rate_mb` (default 4 is too low for multi-VM)
3. Increase `per_stream_rate_limit` if specific containers produce high volume
4. Restart Loki after config change

### Grafana alert rules "Failed to build" errors

This occurs when file-provisioned alert rules have stale/corrupt models in the Grafana SQLite database:
1. Stop Grafana
2. Remove stale data from SQLite:
   ```bash
   sudo docker run --rm -v multi-vm_grafana_data:/var/lib/grafana alpine sh -c \
     "apk add --no-cache sqlite && sqlite3 /var/lib/grafana/grafana.db \
     'DELETE FROM alert_rule; DELETE FROM alert_rule_version; DELETE FROM provenance_type WHERE record_type=1; DELETE FROM alert_instance;'"
   ```
3. Start Grafana — it will re-provision cleanly from the YAML file
4. Verify: `sudo docker logs --since 30s sven-grafana 2>&1 | grep "Failed to build"` should return empty

### VM7 compose parse errors

VM7's compose file requires placeholder values for ALL adapter env vars even for stopped adapters. If `docker compose config` fails:
1. Check which variable is missing from the error message
2. Add a placeholder to `deploy/multi-vm/.env` (e.g., `WHATSAPP_PHONE_NUMBER_ID=placeholder`)
3. All adapter env vars (WHATSAPP_*, SLACK_*, DISCORD_*, TELEGRAM_*, MATRIX_*, etc.) must exist in `.env`

## Rollback Procedure

If a deployment goes wrong:

1. **Stop all services on affected VM:**
   ```bash
   systemctl stop sven-<role>
   ```

2. **Restore from last known good backup:**
   ```bash
   sudo bash backup-restore.sh restore --vm-role <role>
   ```

3. **If compose file changed, restore previous version:**
   ```bash
   # Backup manifests include the compose file
   tar xzf /srv/sven/prod/backups/<backup-name>/config.tar.gz -C /tmp
   cp /tmp/config/docker-compose.yml /srv/sven/prod/compose/
   ```

4. **Restart services:**
   ```bash
   systemctl start sven-<role>
   ```

5. **Verify health:**
   ```bash
   docker compose -f /srv/sven/prod/compose/docker-compose.yml ps
   curl -s http://10.47.47.8:3000/healthz
   ```

## Scheduled Maintenance

### Daily (automated via cron)
- Backup all VMs: `0 2 * * * /srv/sven/prod/scripts/backup-restore.sh backup --vm-role <role> --force`
- Postgres vacuum: handled by `postgres-maintenance` sidecar on VM4

### Weekly
- Review Grafana dashboards for trends
- Check disk usage projections
- Review backup integrity: `backup-restore.sh verify`

### Monthly
- Rotate WireGuard keys
- Review and rotate all service tokens
- Update container images (pull latest tags)
- Review UFW firewall rules
- Check TLS certificate expiry

### Quarterly
- Full DR test: restore from backup to staging environment
- Review resource limits vs actual usage
- Security audit: review access logs, failed auth attempts
- Update OS packages: `apt update && apt upgrade`
