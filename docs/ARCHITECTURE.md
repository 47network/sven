# Sven — System Architecture

This document describes the full system architecture of the Sven platform — services, data flows, communication patterns, and integration points.

For a quickstart, see the [README](../README.md). For operational procedures, see [docs/ops/](ops/).

---

## High-Level Overview

Sven is a TypeScript monorepo built around a message-bus architecture. All inter-service communication flows through **NATS JetStream**. The **Gateway API** is the only externally-exposed service — all client surfaces (web, mobile, desktop) communicate exclusively through it.

```
╔═══════════════════════════════════════════════════════════════════╗
║                            Clients                                ║
║  Admin UI  ║  Canvas UI  ║  Flutter App  ║  Tauri Desktop  ║  WC  ║
╠═══════════════════════════╦═══════════════════════════════════════╣
║                           ║  HTTPS / WSS (443 / 80)               ║
╠═══════════════════════════╩═══════════════════════════════════════╣
║                        Gateway API                                ║
║  JWT auth · Rate limit · Routing · WSS streaming · REST           ║
╠══════════╦══════════╦═══════════╦══════════════════════════════════╣
║          ║          ║           ║                                  ║
║  Agent   ║  Skill   ║    RAG    ║  Workflow + Scheduler            ║
║  Runtime ║  Runner  ║  Indexer  ║  Executor                        ║
║          ║ (gVisor) ║ (OS+vec)  ║                                  ║
╠══════════╩══════════╩═══════════╩══════════════════════════════════╣
║          NATS JetStream (message bus + event store)                ║
╠═══════════════════════════════════════════════════════════════════╣
║  PostgreSQL  │  OpenSearch  │  LiteLLM  │  SearXNG  │  Keycloak   ║
╠═══════════════════════════════════════════════════════════════════╣
║  Faster-Whisper · Piper TTS · Wake-Word · Notification Service    ║
╠═══════════════════════════════════════════════════════════════════╣
║                   Messaging Adapters (20)                         ║
║  Slack · Teams · Telegram · Discord · WhatsApp · Signal · ...     ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## Service Catalogue

### Core Services

| Service | Path | Port | Description |
|:--------|:-----|:----:|:------------|
| **gateway-api** | `services/gateway-api` | 4000 | Central API. All client traffic goes here. |
| **agent-runtime** | `services/agent-runtime` | — | LLM orchestration, tool dispatch, memory R/W |
| **skill-runner** | `services/skill-runner` | — | Sandboxed tool execution (gVisor) |
| **workflow-executor** | `services/workflow-executor` | — | Cron + one-shot task scheduler |
| **registry-worker** | `services/registry-worker` | — | Skill marketplace ingestion pipeline |
| **notification-service** | `services/notification-service` | — | Push (FCM/APNs), email, in-app |

### Knowledge & Search

| Service | Path | Port | Description |
|:--------|:-----|:----:|:------------|
| **rag-indexer** | `services/rag-indexer` | — | Vector indexing engine (BM25 + pgvector) |
| **rag-git-ingestor** | `services/rag-git-ingestor` | — | Git repo ingestion |
| **rag-nas-ingestor** | `services/rag-nas-ingestor` | — | NAS / filesystem ingestion |
| **rag-notes-ingestor** | `services/rag-notes-ingestor` | — | Apple Notes, Obsidian, Bear, Notion |
| **searxng** | `services/searxng` | 8080 | Self-hosted private web search |
| **litellm** | `services/litellm` | 4001 | LLM provider proxy |

### Voice

| Service | Path | Port | Description |
|:--------|:-----|:----:|:------------|
| **faster-whisper** | `services/faster-whisper` | 8100 | Local STT (speech-to-text) |
| **piper** | `services/piper` | 8200 | Local TTS (text-to-speech) |
| **wake-word** | `services/wake-word` | 8300 | Always-on wake word detection |

### Infrastructure

| Service | Path | Port | Description |
|:--------|:-----|:----:|:------------|
| **sso** | `services/sso` | 8080 | Keycloak OIDC identity provider |
| **egress-proxy** | `services/egress-proxy` | 3128 | Outbound allowlist proxy (Squid) |
| **sven-mirror-agent** | `services/sven-mirror-agent` | — | Edge agent (Raspberry Pi / kiosk) |

### Messaging Adapters

All 20 adapters follow the same pattern — they connect to their respective messaging platform and relay messages to/from the Gateway API via authenticated webhooks or long-polling. Each runs as an independent Docker service.

| Adapter | Service path |
|:--------|:-------------|
| Slack | `services/adapter-slack` |
| Microsoft Teams | `services/adapter-teams` |
| Telegram | `services/adapter-telegram` |
| Discord | `services/adapter-discord` |
| WhatsApp | `services/adapter-whatsapp` |
| Signal | `services/adapter-signal` |
| Matrix | `services/adapter-matrix` |
| Google Chat | `services/adapter-google-chat` |
| iMessage | `services/adapter-imessage` |
| Mattermost | `services/adapter-mattermost` |
| IRC | `services/adapter-irc` |
| Nostr | `services/adapter-nostr` |
| Twitch | `services/adapter-twitch` |
| Line | `services/adapter-line` |
| Zalo | `services/adapter-zalo` |
| Feishu | `services/adapter-feishu` |
| Nextcloud Talk | `services/adapter-nextcloud-talk` |
| Tlon | `services/adapter-tlon` |
| WebChat | `services/adapter-webchat` |
| Voice Call | `services/adapter-voice-call` |

### Client Applications

| App | Path | Description |
|:----|:-----|:------------|
| **Admin UI** | `apps/admin-ui` | React dashboard for full platform control |
| **Canvas UI** | `apps/canvas-ui` | Rich real-time chat surface |
| **Flutter App** | `apps/companion-user-flutter` | iOS + Android companion app |
| **Tauri Desktop** | `apps/companion-desktop-tauri` | macOS / Windows / Linux native app |

---

## Communication Patterns

### Client → Gateway
All clients connect exclusively to the Gateway API over **HTTPS** (REST) or **WSS** (WebSocket streaming). No client has direct access to any internal service.

### Gateway → Services (NATS)
Internal service-to-service communication uses **NATS JetStream** publish/subscribe:

```
Gateway publishes:  sven.agent.run.<agentId>
Agent Runtime subscribes and processes, publishes results to:
                    sven.agent.result.<sessionId>
Gateway streams results back to client WebSocket
```

Key NATS subjects:

| Subject pattern | Producers | Consumers |
|:----------------|:----------|:----------|
| `sven.agent.run.*` | Gateway | Agent Runtime |
| `sven.tool.execute.*` | Agent Runtime | Skill Runner |
| `sven.tool.result.*` | Skill Runner | Agent Runtime |
| `sven.rag.query.*` | Agent Runtime | RAG Indexer |
| `sven.workflow.trigger.*` | Gateway / Scheduler | Workflow Executor |
| `sven.notify.*` | Gateway / Agent Runtime | Notification Service |
| `sven.adapter.inbound.*` | All adapters | Gateway |
| `sven.adapter.outbound.*` | Gateway | All adapters |

### Adapter → Gateway
Adapters publish inbound messages to `sven.adapter.inbound.<adapterId>.<accountId>`.
Gateway routes the message to the correct agent based on routing rules and publishes the agent's response to `sven.adapter.outbound.<adapterId>.<accountId>`.

---

## Data Stores

### PostgreSQL
Primary relational store. Holds:
- Users, organisations, RBAC
- Agent configurations and routing rules
- Memory entries (structured metadata + references to vectors)
- Session state
- Scheduler jobs
- Audit log
- Backup records
- Skill registry entries

Schema is managed by **Knex migrations** in `services/gateway-api/src/db/migrations/`.

### OpenSearch
Vector + full-text search index. Holds:
- Embedded memory chunks (pgvector via OpenSearch kNN)
- RAG document chunks (chunked, embedded, indexed)
- BM25 sparse index alongside dense vector index for hybrid retrieval

### NATS JetStream
Message bus and durable event log. Used for:
- Async service communication (all agent work)
- Adapter message relay
- Workflow trigger events
- Dead-letter queuing for failed tool executions

### File Storage
Uploaded files, RAG source documents, and backups are stored on local volume mounts (configurable to S3-compatible object storage via `BACKUP_S3_*` env vars).

---

## Authentication & Security Boundary

```
Internet
  │
  ▼
[Egress Proxy] ◄──── all outbound tool HTTP requests (allowlisted)
  │
  ├──► [Gateway API]  (443/4000) ◄── only public entry point
  │         │
  │         ├── JWT validation (symmetric, HS256, short TTL)
  │         ├── OIDC token verification via Keycloak (SSO tenants)
  │         ├── Rate limiting (per-user + per-IP)
  │         └── CORS enforcement (CORS_ORIGIN env var)
  │
  └──── All other services: internal network only, no public exposure
```

- **All service-to-service calls** use the internal Docker network. No service exposes a port externally except the Gateway.
- **Skill execution** runs inside gVisor (runsc) — syscall interception prevents host-escape.
- **Secrets** are injected via environment (SOPS / Vault / file) and are never stored in the database or written to agent context.

---

## Memory Architecture

Memory retrieval uses a **three-stage pipeline**:

```
Query
  │
  ├─ 1. BM25 sparse search  (keyword recall, OpenSearch)
  ├─ 2. Dense vector search  (semantic recall, pgvector / OpenSearch kNN)
  │         ↓
  ├─ 3. Score fusion + temporal decay weighting
  │         ↓
  └─ 4. MMR re-ranking  →  top-k diverse, non-redundant results
```

**Temporal decay**: scores are multiplied by `e^(-λt)` where `t` is age in days and `λ` is configurable per agent. Recent memories rank higher without explicitly overriding semantic relevance.

**MMR (Maximal Marginal Relevance)**: avoids returning near-duplicate chunks by penalising similarity to already-selected results.

**Memory scopes**:

| Scope | Visibility | Isolation |
|:------|:-----------|:----------|
| `private` | Owning user only | Per-user row-level security |
| `shared` | All participants in a chat session | Per-session namespace |
| `global` | All agents in the organisation | Per-tenant namespace |
| `knowledge` | Admin-curated reference knowledge | Per-tenant, read-only to agents |

---

## RAG Pipeline

```
Source (Git / NAS / Notes)
  │
  ├─ 1. Ingestor fetches + normalises content
  ├─ 2. Chunker splits into overlapping windows
  ├─ 3. Embedder (LiteLLM embedding endpoint) → vectors
  ├─ 4. Indexer writes to OpenSearch (BM25 + kNN)
  │
  └─ On query: retrieval → score fusion → MMR → agent context injection
```

Ingestors run on a schedule or can be triggered manually from the Admin UI.

---

## Agent Execution Loop

```
User message received by Gateway
  │
  ▼
Gateway publishes to NATS: sven.agent.run.<agentId>
  │
  ▼
Agent Runtime picks up message
  ├─ Load agent config (model, tools, system prompt, memory scope)
  ├─ Fetch relevant memories (RAG + memory pipeline)
  ├─ Build context window
  └─ Call LiteLLM (streaming)
        │
        ├─ Text delta → streamed back to client via Gateway WSS
        └─ Tool call detected
              │
              ├─ Validate tool against policy engine
              ├─ Publish to NATS: sven.tool.execute.<toolName>
              ├─ Skill Runner executes in gVisor sandbox
              ├─ Result returned via sven.tool.result.*
              └─ Inject result into context → continue loop
                      │
                      └─ On error: classify → retry / approve gate / abandon
```

**Self-correction**: on tool failure, the agent runtime classifies the error (transient, logic, permission, resource), applies a strategy (retry with backoff, reformulate, escalate), and detects infinite loops via a bounded iteration counter.

---

## Deployment

Sven should be deployed on Linux-hosted infrastructure. Docker Compose is the packaging/runtime method for local development and single-node environments, not the whole production strategy by itself.

Recommended ladder:

| Stage | Host model | Runtime model | Primary document |
|:--|:--|:--|:--|
| dev | developer workstation | Docker Compose / PM2 | [deploy/deployment-ladder-2026.md](deploy/deployment-ladder-2026.md) |
| staging | single Linux VM | Docker Compose | [deploy/staging-linux-vm-2026.md](deploy/staging-linux-vm-2026.md) |
| production v1 | single hardened Linux VM | Docker Compose + ingress + backups + monitoring | [deploy/production-v1-linux-vm-2026.md](deploy/production-v1-linux-vm-2026.md) |
| production scale | Linux node pool | Kubernetes or Nomad | [deploy/production-scale-2026.md](deploy/production-scale-2026.md) |

### Docker Compose profiles

| Profile | Command | Use case |
|:--------|:--------|:---------|
| dev | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` | Local development with hot-reload |
| staging | `docker compose -f docker-compose.yml -f docker-compose.staging.yml up` | Single-node Linux VM staging |
| production | `docker compose -f docker-compose.yml -f docker-compose.production.yml up` | Single-node Linux VM production baseline |

### Canary strategy

Production deployments use a phased canary approach defined in `.github/workflows/deployment-pipeline.yml`:

| Phase | Traffic | Duration | Automatic? |
|:------|:-------:|:--------:|:----------:|
| Phase 0 (canary) | 5% | 30 min | Yes |
| Phase 1 | 25% | 30 min | Yes |
| Phase 2 | 100% | — | Requires gate pass |

Rollback is a single `npm run release:rollback` command.

---

## CI/CD Workflows

| Workflow | Trigger | What it does |
|:---------|:--------|:-------------|
| `deployment-pipeline.yml` | Push to `master` | Build, test, push images, deploy canary |
| `security-baseline.yml` | Push + schedule | SBOM, npm audit, cosign sign |
| `flutter-user-app-ci.yml` | Push touching Flutter | Lint, test, build APK/IPA |
| `parity-e2e.yml` | Push to `master` | Full end-to-end parity test suite |
| `release-gates-sync.yml` | Schedule | Sync release gate status |
| `release-supply-chain.yml` | Release tag | SBOM attestation + image provenance |
| `desktop-tauri-release.yml` | Release tag | macOS / Windows / Linux builds |
| `mobile-release-sign.yml` | Release tag | Signed APK + IPA artifacts |

---

## Further Reading

- [README](../README.md) — quick start and feature overview
- [SECURITY.md](../SECURITY.md) — threat model and vulnerability reporting
- [docs/ops/](ops/) — operator runbooks
- [docs/release/](release/) — release checklists and assessments
