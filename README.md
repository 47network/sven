<div align="center">

```
 ███████╗██╗   ██╗███████╗███╗   ██╗
 ██╔════╝██║   ██║██╔════╝████╗  ██║
 ███████╗██║   ██║█████╗  ██╔██╗ ██║
 ╚════██║╚██╗ ██╔╝██╔══╝  ██║╚██╗██║
 ███████║ ╚████╔╝ ███████╗██║ ╚████║
 ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝
```

### The self-hosted AI platform.

**47+ microservices. 20 messaging adapters. Native mobile & desktop apps. Enterprise multi-tenancy. Full observability. Zero cloud dependency.**

One platform that runs your entire AI stack — agents, voice, RAG, document intelligence, security scanning, quantum simulation, compute orchestration — on infrastructure you own.

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build](https://github.com/47network/sven/actions/workflows/deployment-pipeline.yml/badge.svg)](https://github.com/47network/sven/actions)
[![Security](https://github.com/47network/sven/actions/workflows/security-baseline.yml/badge.svg)](https://github.com/47network/sven/actions)
[![Flutter CI](https://github.com/47network/sven/actions/workflows/flutter-user-app-ci.yml/badge.svg)](https://github.com/47network/sven/actions)
[![E2E](https://github.com/47network/sven/actions/workflows/parity-e2e.yml/badge.svg)](https://github.com/47network/sven/actions)
[![Release Gates](https://github.com/47network/sven/actions/workflows/release-gates-sync.yml/badge.svg)](https://github.com/47network/sven/actions)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](CHANGELOG.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<br/>

[Quick Start](#-quick-start) &nbsp;·&nbsp; [Platform Overview](#-platform-overview) &nbsp;·&nbsp; [Architecture](#-architecture) &nbsp;·&nbsp; [Services](#-services--capabilities) &nbsp;·&nbsp; [Docs](docs/) &nbsp;·&nbsp; [Contributing](CONTRIBUTING.md)

</div>

---

## What is Sven?

Sven is a **self-hosted AI platform** — a complete, production-grade system for deploying intelligent agents, voice interfaces, document processing, security scanning, distributed compute, and more across any scale of organisation.

It is not a chatbot. It is not a wrapper around an LLM API. It is a **full-stack AI operating environment** with 47+ independently deployable microservices, 10 shared libraries, native mobile and desktop applications, 20 messaging platform adapters, and enterprise infrastructure — all running on your own hardware, under your own control.

### What makes Sven different

| | |
|:---:|---|
| **Full platform** | Not a single tool — an entire AI infrastructure stack: agents, memory, RAG, voice, security, compute mesh, document intelligence, quantum simulation, marketing analytics, and more |
| **Any scale** | Runs on a Raspberry Pi for personal use, scales to multi-tenant enterprise with SSO, RBAC, canary deploys, and full observability |
| **Any interface** | Native Flutter mobile app, Tauri desktop app, web admin dashboard, real-time chat canvas, embeddable widget, 20 messaging adapters, voice with wake word |
| **Zero cloud dependency** | Every component — LLM inference, search, STT, TTS, vector DB — runs locally. Nothing phones home. Your data never leaves your infrastructure |
| **Production-grade** | Not a demo. Structured logging, distributed tracing, Prometheus metrics, health endpoints, graceful shutdown, migration scripts, rollback procedures, runbook library |

> **MIT licensed. Self-hosted. No telemetry. No vendor lock-in.**

---

## 🧩 Platform Overview

<details open>
<summary><strong>Core AI Runtime</strong></summary>

- **Multi-agent orchestration** — parallel execution, routing rules, self-correcting loops, approval gates, sub-agent nesting, pause/resume
- **Per-user persistent memory** — private, shared, global, and knowledge-graph scopes with temporal decay scoring and MMR re-ranking
- **RAG pipeline** — Git repos, NAS, Apple Notes, Obsidian, Bear, Notion ingestion with chunking, embedding, incremental re-indexing, and feedback loops
- **80+ sandboxed skills** — gVisor-isolated execution, dynamic tool creation at runtime, skill marketplace with versioning and revenue share
- **LLM flexibility** — LiteLLM proxy supporting OpenAI, Anthropic, Google, Mistral, Ollama, LM Studio; per-agent model selection, virtual API keys with spend limits

</details>

<details open>
<summary><strong>Voice & Communication</strong></summary>

- **Full local voice stack** — wake word detection, Whisper STT (faster-whisper), Piper TTS, speaker identification, emotion detection — 100% on-device
- **20 messaging adapters** — Slack, Teams, Telegram, Discord, WhatsApp, Signal, Matrix, iMessage, Google Chat, Mattermost, IRC, Nostr, Twitch, Line, Zalo, Feishu, Nextcloud Talk, Tlon, WebChat, Voice Call
- **Meeting assistant** — transcription, speaker ID, summarisation, action item extraction
- **Proactive notifications** — scheduled messages, calendar prefetch, pattern detection, health monitoring, configurable triggers with quiet hours and rate limiting

</details>

<details open>
<summary><strong>Intelligence Services</strong></summary>

- **Document Intelligence** — OCR, entity extraction, summarisation, PII detection and redaction, multi-format batch processing
- **Marketing Intelligence** — competitive signal monitoring, brand voice analysis, content scoring, campaign management, ROI analytics, coaching debriefs
- **Security Toolkit** — SAST (14 rules), secret scanning (20 patterns), dependency CVE audit, infrastructure audit, pen-test scenarios, security posture reporting
- **Quantum Simulation** — 25-qubit state-vector simulator, QAOA, Grover's search, quantum Monte Carlo, annealing, portfolio optimisation, multi-backend cost estimation (IBM, AWS, Origin)

</details>

<details open>
<summary><strong>Infrastructure & Compute</strong></summary>

- **Compute Mesh** — distributed workload orchestration across heterogeneous device fleets with capability-based scheduling and fault-tolerant reassignment
- **Model Router** — LLM inference routing across multi-provider GPU fleets, VRAM monitoring, hot-swap deployment, benchmark tracking, latency-based decisions
- **Workflow Executor** — cron scheduling, natural language task creation, missed-run detection, admin UI with run history
- **Notification Service** — push (FCM/APNs), email, in-app notifications across all client surfaces

</details>

<details open>
<summary><strong>Enterprise & Operations</strong></summary>

- **Multi-tenancy** — organisation-scoped data isolation, RBAC (admin / operator / member), per-tenant storage, usage metering, billing
- **SSO** — Keycloak / OIDC, TOTP for admin accounts
- **Observability** — Prometheus metrics, structured JSON logging, distributed tracing, pre-built Grafana dashboards, alerting baselines
- **Security** — TLS 1.2+, CORS/egress allowlists, secrets encryption, SBOM + cosign signing, dependency vulnerability scanning
- **Operations** — canary deployment (phase 0 → 100%), one-command rollback, backup/restore with S3, full runbook library

</details>

---

## 🏗️ Architecture

```
╔═══════════════════════════════════════════════════════════════════╗
║                            Clients                                ║
║  Admin UI  ║  Canvas UI  ║  Flutter App  ║  Tauri Desktop  ║  WC  ║
╠═══════════════════════════╦═══════════════════════════════════════╣
║                           ║  HTTPS / WebSocket / REST             ║
╠═══════════════════════════╩═══════════════════════════════════════╣
║                        Gateway API                                ║
║  JWT Auth · Rate Limiting · Multi-agent Routing · Message Queue   ║
╠══════════╦══════════╦══════════╦══════════════════════════════════╣
║  Agent   ║  Skill   ║   RAG    ║  Workflow + Scheduler Executor   ║
║  Runtime ║  Runner  ║ Indexer  ║                                  ║
║ (LLM +   ║ (gVisor) ║ (OS +    ║                                  ║
║  tools)  ║          ║  pgvec)  ║                                  ║
╠══════════╩══════════╩══════════╩══════════════════════════════════╣
║  Compute Mesh  │  Model Router  │  Security Toolkit               ║
║  Document Intel │  Marketing Intel │  Proactive Notifier           ║
║  Quantum Sim   │  Notification Service │  Registry Worker          ║
╠═══════════════════════════════════════════════════════════════════╣
║  PostgreSQL  │  NATS JetStream  │  OpenSearch  │  LiteLLM         ║
║  SearXNG     │  Keycloak SSO    │  Faster-Whisper STT             ║
║  Piper TTS   │  Wake-Word       │  Egress Proxy                   ║
╠═══════════════════════════════════════════════════════════════════╣
║                   Messaging Adapters (20)                         ║
║  Slack · Teams · Telegram · Discord · WhatsApp · Signal           ║
║  Matrix · iMessage · IRC · Nostr · Twitch · Line · Zalo           ║
║  Feishu · Nextcloud · Mattermost · Tlon · WebChat · VoiceCall     ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## 📦 Services & Capabilities

### Monorepo Layout

```
sven/
├── apps/
│   ├── admin-ui/                  # React admin dashboard
│   ├── canvas-ui/                 # Real-time chat canvas (KaTeX, tool traces)
│   ├── companion-user-flutter/    # iOS + Android Flutter companion app
│   └── companion-desktop-tauri/   # macOS / Windows / Linux (Tauri/Rust)
│
├── services/                      # 47+ independently deployable microservices
│   ├── gateway-api/               # Central API — auth, routing, rate limiting
│   ├── agent-runtime/             # LLM + tool orchestration engine
│   ├── skill-runner/              # gVisor-sandboxed tool executor
│   ├── workflow-executor/         # Scheduler + cron engine
│   ├── registry-worker/           # Skill marketplace pipeline
│   ├── notification-service/      # Push (FCM/APNs), email, in-app
│   ├── rag-indexer/               # Vector indexing engine
│   ├── rag-git-ingestor/          # Git repo ingestion
│   ├── rag-nas-ingestor/          # NAS / filesystem ingestion
│   ├── rag-notes-ingestor/        # Notes app connectors
│   ├── compute-mesh/              # Distributed workload orchestration
│   ├── model-router/              # LLM inference routing + GPU fleet management
│   ├── security-toolkit/          # SAST, secrets, CVE audit, infra audit, pen-test
│   ├── document-intel/            # OCR, entities, summarisation, PII detection
│   ├── marketing-intel/           # Competitive intel, brand voice, campaigns
│   ├── proactive-notifier/        # Autonomous trigger-based notifications
│   ├── quantum-sim/               # Quantum circuit simulation + algorithms
│   ├── litellm/                   # LLM provider proxy
│   ├── searxng/                   # Self-hosted private search
│   ├── egress-proxy/              # Outbound allowlist proxy
│   ├── faster-whisper/            # Local STT
│   ├── piper/                     # Local TTS
│   ├── wake-word/                 # Always-on wake word engine
│   ├── sso/                       # Keycloak OIDC provider
│   ├── sven-mirror-agent/         # Edge agent (Raspberry Pi / kiosk)
│   └── adapter-*/                 # 20 messaging adapters
│
├── packages/                      # Shared TypeScript libraries
│   ├── shared/                    # Utilities, types, NATS subjects, logger
│   ├── compute-mesh/              # Compute mesh library
│   ├── model-router/              # Model routing library
│   ├── security-toolkit/          # Security scanning library
│   ├── document-intel/            # Document processing library
│   ├── marketing-intel/           # Marketing intelligence library
│   ├── proactive-notifier/        # Notification engine library
│   ├── quantum-sim/               # Quantum gates, simulator, algorithms, hardware
│   ├── design-system/             # React UI component library
│   └── cli/                       # Command-line interface
│
├── skills/                        # 80+ built-in skills (SKILL.md standard)
├── tests/                         # E2E + load tests
├── deploy/                        # Kubernetes, Helm, Compose configs
├── config/                        # Prometheus, Grafana, Loki, Traefik, Caddy, nginx
├── docs/                          # Architecture, security, ops, release docs
└── scripts/                       # 100+ dev and ops automation scripts
```

### Service Port Map

| Service | Port | Description |
|:---|:---:|:---|
| Gateway API | 4000 | Central REST + WebSocket API |
| Admin UI | 3000 | Control panel |
| Canvas UI | 3001 | Real-time chat surface |
| Compute Mesh | 9470 | Distributed workload orchestration |
| Model Router | 9471 | LLM inference routing |
| Security Toolkit | 9472 | Security scanning & audit |
| Document Intel | 9473 | Document processing pipeline |
| Marketing Intel | 9474 | Competitive & marketing analytics |
| Proactive Notifier | 9475 | Autonomous notifications |
| Quantum Sim | 9476 | Quantum circuit simulation |

---

## ⚡ Quick Start

### Prerequisites

| Tool | Version | Required for |
|:---|:---:|:---|
| Docker + Compose | 25+ | Everything |
| Node.js | 20+ | Gateway + UIs |
| Flutter SDK | 3.27+ | Mobile app |
| Rust + Cargo | 1.76+ | Desktop app |
| PostgreSQL | 15+ | Local dev (or use Docker) |

### 1 · Clone

```bash
git clone https://github.com/47network/sven.git
cd sven
```

### 2 · Configure

```bash
cp .env.example .env
# Set at minimum:
#   DATABASE_URL, NATS_URL, COOKIE_SECRET, ADMIN_INITIAL_EMAIL
#   + at least one LLM provider key (e.g. OPENAI_API_KEY)
```

### 3 · Launch

```bash
# Full dev stack (hot-reload on all services)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Single-node Linux production baseline
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

### 4 · Migrate & seed

```bash
npm install
npm run db:migrate
```

### 5 · Open

| Surface | URL | Description |
|:---|:---|:---|
| **Admin UI** | http://localhost:3000 | Agents, memory, RAG, billing, observability |
| **Canvas Chat** | http://localhost:3001 | Rich chat surface with tool trace viewer |
| **Gateway API** | http://localhost:4000 | REST + WebSocket API |

Complete first-run setup in the Admin UI — create your first agent, connect a messaging adapter, and start using the platform.

### Deployment Guides

For production deployments beyond `docker compose`:

- [Deployment Ladder](docs/deploy/deployment-ladder-2026.md) — choose your deployment tier
- [Setup Paths Matrix](docs/deploy/setup-paths-matrix-2026.md) — hardware and config decision tree
- [Staging VM Guide](docs/deploy/staging-linux-vm-2026.md) — single-node staging deployment
- [Production VM Guide](docs/deploy/production-v1-linux-vm-2026.md) — production-grade single-node
- [Production Scale](docs/deploy/production-scale-2026.md) — multi-node / Kubernetes

---

## ⚙️ Configuration

All configuration is environment-variable driven. Use [`.env.example`](.env.example) as the canonical startup contract.

| Variable | Description |
|:---|:---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NATS_URL` | NATS JetStream broker address |
| `LITELLM_API_BASE` | LiteLLM proxy base URL |
| `SVEN_EGRESS_PROXY` | Forward proxy for tool egress |
| `COOKIE_SECRET` | Session signing secret (required) |
| `ADMIN_INITIAL_EMAIL` | First admin account email |
| `ADMIN_INITIAL_PASSWORD` | First admin account password |
| `OPENSEARCH_URL` | OpenSearch / Elasticsearch URL |
| `SSO_ISSUER_URL` | Keycloak / OIDC issuer URL |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging key (mobile push) |

---

## 📬 Messaging Adapters

20 platform adapters ship out of the box:

| | | | |
|:---|:---|:---|:---|
| 💬 **Slack** | 🟦 **Microsoft Teams** | ✈️ **Telegram** | 🎮 **Discord** |
| 🟩 **WhatsApp** | 🔵 **Signal** | 🟪 **Matrix** (E2EE) | 🔵 **Google Chat** |
| 🍎 **iMessage** | 🔷 **Mattermost** | 🖥️ **IRC** | 🔑 **Nostr** |
| 🎥 **Twitch** | 🟢 **Line** | 🇻🇳 **Zalo** | 🪶 **Feishu** |
| ☁️ **Nextcloud Talk** | 🌊 **Tlon** | 🌐 **WebChat** | 📞 **Voice Call** |

---

## 🚀 Use Cases

Sven is a general-purpose AI platform. Here are some of the ways it is being used:

| Scale | Use Case | Key Services |
|:---|:---|:---|
| **Personal** | AI assistant across all your messaging apps with private memory per conversation | Agent Runtime, Memory, 20 Adapters |
| **Home** | Voice-controlled hub — "Hey Sven" from any room, 100% local | Wake Word, Whisper STT, Piper TTS, Mirror Agent |
| **Team** | Private team AI — shared knowledge base, per-member memory, SSO | Multi-tenancy, RAG, Keycloak SSO, RBAC |
| **Enterprise** | On-prem AI platform — multi-tenant, compliance audit trail, canary deploys | All services, observability stack, runbook library |
| **Research** | Quantum algorithm exploration, circuit simulation, portfolio optimisation | Quantum Sim, Compute Mesh |
| **Security** | Automated SAST, secret scanning, dependency audit, pen-test orchestration | Security Toolkit |
| **Content** | Document processing at scale — OCR, entity extraction, PII redaction | Document Intel |
| **Marketing** | Competitive intelligence, brand monitoring, campaign analytics | Marketing Intel |
| **DevOps** | Distributed compute orchestration, GPU fleet management, model routing | Compute Mesh, Model Router |
| **Knowledge** | Index Git repos, NAS, notes apps — cross-source semantic search | RAG Indexer, Git/NAS/Notes Ingestors |

---

## 🆚 How Sven Compares

| Capability | Sven | Single-user AI CLI | Chat Bridge Platform |
|:---|:---:|:---:|:---:|
| Self-hosted, zero cloud dependency | ✅ | ✅ | ✅ |
| Full platform (agents + voice + RAG + security + compute) | ✅ | ❌ | ❌ |
| Multi-tenant RBAC + Enterprise SSO | ✅ | ❌ | ❌ |
| Native mobile app (Flutter) | ✅ | ❌ | Limited |
| Native desktop app (Tauri) | ✅ | ❌ | Limited |
| Full local voice stack (wake word + STT + TTS) | ✅ | Partial | ❌ |
| Per-user private memory with temporal decay | ✅ | ❌ | ❌ |
| Full RAG pipeline (Git + NAS + Notes) | ✅ | Partial | ❌ |
| Sandboxed skill execution (gVisor) | ✅ | Partial | ❌ |
| Skill marketplace with revenue sharing | ✅ | ❌ | ❌ |
| Document intelligence (OCR, PII, entities) | ✅ | ❌ | ❌ |
| Security scanning (SAST, secrets, CVE, pen-test) | ✅ | ❌ | ❌ |
| Quantum simulation | ✅ | ❌ | ❌ |
| Distributed compute mesh | ✅ | ❌ | ❌ |
| LLM fleet routing + VRAM management | ✅ | ❌ | ❌ |
| Marketing & competitive intelligence | ✅ | ❌ | ❌ |
| Messaging adapters | **20** | 0 | **20** |
| Canary deployment pipeline | ✅ | ❌ | ❌ |
| Full observability (metrics + traces + alerts) | ✅ | Partial | Partial |
| Operator runbook library | ✅ | ❌ | ❌ |
| Billing / usage metering | ✅ | ❌ | ❌ |

### Capability Proof (machine-verified)

| Scope | Proven | Coverage |
|:---|:---:|:---:|
| Agent Zero parity matrix | 111 / 111 | 100% |
| OpenClaw parity matrix | 176 / 176 | 100% |
| Combined competitor rows | 287 / 287 | 100% |

Evidence: `docs/release/status/competitor-capability-proof-latest.json`

---

## 📖 Documentation

| Document | Description |
|:---|:---|
| [Feature Catalog](docs/features/sven-feature-catalog-2026-03-12.md) | Canonical capability map |
| [Architecture](docs/ARCHITECTURE.md) | System design and service interactions |
| [Feature Flow Diagrams](docs/architecture/feature-flow-diagrams-2026-03-12.md) | End-to-end execution flows |
| [Local Testing Guide](docs/release/LOCAL_TESTING_GUIDE.md) | Run the full stack locally |
| [Operator Runbooks](docs/ops/) | Key rotation, incident triage, upgrade, backup |
| [Security Guide](docs/release/section-k-security-privacy.md) | Threat model, controls, pen-test baseline |
| [Performance Guide](docs/release/section-j-performance-accessibility.md) | SLOs, load tests, accessibility |
| [Release Checklists](docs/release/checklists/) | Production readiness gates |
| [Onboarding Kits](docs/guides/onboarding-kits-by-role.md) | Role-based getting started guides |
| [Parity: vs Agent Zero](docs/parity/sven-vs-agent-zero-feature-comparison.md) | Feature-by-feature comparison |
| [Parity: vs OpenClaw](docs/parity/Sven_vs_OpenClaw_Feature_Comparison.md) | Feature-by-feature comparison |

---

## 🤝 Contributing

Contributions are welcome — from bug reports to new adapters to full service implementations.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:
- **Development setup** — prerequisites, local dev stack, hot-reload workflow
- **PR process** — branch naming, commit conventions (Conventional Commits)
- **Testing requirements** — unit, integration, E2E expectations
- **Code style** — ESLint, Prettier, TypeScript strict mode

> **Security vulnerabilities**: follow the responsible disclosure process in [SECURITY.md](SECURITY.md). Do **not** open a public issue.

---

<div align="center">

[![Star on GitHub](https://img.shields.io/github/stars/47network/sven?style=for-the-badge&logo=github&label=Star)](https://github.com/47network/sven)

**[MIT](LICENSE) © 2026 [47network](https://github.com/47network)**

</div>
