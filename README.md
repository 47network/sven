<div align="center">

```
 ███████╗██╗   ██╗███████╗███╗   ██╗
 ██╔════╝██║   ██║██╔════╝████╗  ██║
 ███████╗██║   ██║█████╗  ██╔██╗ ██║
 ╚════██║╚██╗ ██╔╝██╔══╝  ██║╚██╗██║
 ███████║ ╚████╔╝ ███████╗██║ ╚████║
 ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝
```

**The AI companion you run for everyone you care about.**

*Deploy once. Your parents use it on WhatsApp. Your household talks to it by voice. Your friends find it on Telegram. Your team gets it on Slack. All private. All local. All yours.*

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build](https://github.com/47network/thesven/actions/workflows/deployment-pipeline.yml/badge.svg)](https://github.com/47network/thesven/actions)
[![Security](https://github.com/47network/thesven/actions/workflows/security-baseline.yml/badge.svg)](https://github.com/47network/thesven/actions)
[![Flutter CI](https://github.com/47network/thesven/actions/workflows/flutter-user-app-ci.yml/badge.svg)](https://github.com/47network/thesven/actions)
[![E2E](https://github.com/47network/thesven/actions/workflows/parity-e2e.yml/badge.svg)](https://github.com/47network/thesven/actions)
[![Release Gates](https://github.com/47network/thesven/actions/workflows/release-gates-sync.yml/badge.svg)](https://github.com/47network/thesven/actions)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](CHANGELOG.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<br/>

[Quick Start](#-quick-start) &nbsp;·&nbsp; [Architecture](#-architecture) &nbsp;·&nbsp; [Features](#-key-features) &nbsp;·&nbsp; [Adapters](#-messaging-adapters) &nbsp;·&nbsp; [Docs](docs/) &nbsp;·&nbsp; [Contributing](CONTRIBUTING.md)

</div>

---

## What is Sven?

Sven is the AI companion **you deploy on your own server, so the people you care about can use it every day** — without needing to understand anything about servers, Docker, or AI.

Your parents already have WhatsApp. Your flatmates can just say *"Hey Sven"*. Your friends are on Telegram. Your colleagues use Slack. You connect the adapters once, create a user for each person, and they immediately have a private, intelligent companion waiting for them in the app they already use. No signup on their side, no new app to download, no data going anywhere you don't control.

Sven scales from a single Raspberry Pi home hub up to a full enterprise deployment: multi-tenant, multi-agent, native Flutter mobile app, Tauri desktop app, 20 messaging adapters, a full local voice stack, a RAG pipeline, a sandboxed skill marketplace, and full observability — all self-hosted, all MIT open source.

> **Your data — and your family's — never leaves your infrastructure.**

---

## 🌐 Live Entry Points (Reference Release Model)

GitHub-facing release documentation uses generic example hostnames. Real deployment runbooks and env templates can use your actual domains.

| Surface | URL |
|:---|:---|
| Release landing + install | `https://example.com/` |
| Landing suite | `https://example.com/suite` |
| Canvas runtime | `https://app.example.com/` |
| Community hub | `https://app.example.com/community` |
| Admin control center | `https://app.example.com/admin47` |

---

## 👥 Who is Sven for?

**You** — the person who runs it. One `docker compose up -d` and you give the people you love an AI that just works.

| | Who | What they use | What they experience |
|:---:|:---|:---|:---|
| 👨‍👩‍👧 | **Your family** | WhatsApp, iMessage, Telegram | A helpful AI in the app they already have. No signup, no new app. |
| 🏠 | **Your household** | Wake word — *"Hey Sven"* | Hands-free voice assistant. Timers, questions, music, schedules. 100% local. |
| 👥 | **Your friends** | Discord, Telegram, Signal | Shared bot, private memory per person. Knows each of them individually. |
| 🏢 | **Your team** | Slack, Teams, Mattermost | SSO, RBAC, multi-tenant, full observability. Enterprise-ready when you need it. |

> The people you share Sven with don't need to know anything about servers. They just chat.

---

## ✨ Why Sven?

| | What you get |
|:---:|---|
| 👨‍👩‍👧 | **A companion for everyone you love** — family, friends, and household all on the platforms they already use, with zero setup on their side |
| 🏠 | **Your home hub** — wake word detection, local Whisper STT, Piper TTS, speaker ID; no audio ever leaves your home |
| 🔒 | **Fully private, fully local** — every model, search engine, STT, and TTS component runs on your own server; nothing touches a third-party cloud |
| 🧠 | **Memory per person** — each user gets their own private memory; Sven knows your mum's preferences separately from your friends' inside jokes |
| 📱 | **Native everywhere** — Flutter (iOS + Android), Tauri (macOS / Windows / Linux), browser, and all 20 chat platforms |
| 🔧 | **Skills you install once, everyone benefits** — gVisor-sandboxed, versioned, hot-reloaded; Spotify, calendar, weather, notes, and 80+ more |
| 🏢 | **Grows with you** — when you're ready: multi-tenancy, RBAC, Keycloak SSO, canary deploys, observability, runbook library |

---

## 💡 Key Features

### 🤖 Multi-Agent Runtime
- Parallel agent execution with dedicated per-agent runtimes
- Routing rules: route channels, accounts, or topics to specific agents
- **Self-correcting agent loop** — error classification, bounded autonomous retries, strategy adjustments, infinite-loop detection
- Approval gates triggered at configurable retry thresholds
- Sub-agent nesting with context isolation
- Agent pause / resume mid-task
- Per-agent model and profile overrides

### 🧠 Memory & Intelligence
- Persistent memory: per-user private, chat-shared, global, and knowledge-graph scopes
- **Temporal decay scoring** — recent memories ranked higher automatically
- **MMR re-ranking** — Maximal Marginal Relevance for diverse, non-redundant results
- Hybrid BM25 + pgvector semantic search (OpenSearch + PostgreSQL)
- Memory dashboard: browse, search, edit, delete, bulk-export, import
- Memory consolidation with AI-driven deduplication
- Session memory indexing for fast in-session recall
- Delayed recall for background memory enrichment

### 📚 RAG — Retrieval-Augmented Generation
- **Git ingestor** — clone any repo, index commits and code for agent context
- **NAS ingestor** — index your network-attached storage
- **Notes ingestor** — Apple Notes, Obsidian, Bear, Notion
- Chunking, embedding, and incremental re-indexing pipelines
- Structured RAG, multimodal RAG, temporal RAG, and cross-agent knowledge sharing
- RAG feedback loop: thumbs up/down on retrieved results → improved future retrieval

### 🔧 Skills & Tools (80+)
- **Sandboxed execution** via gVisor — zero host-escape risk
- **Dynamic tool creation** — agent authors new skills at runtime, auto-quarantined pending admin approval
- Skill marketplace (registry): install, version, review, revenue share
- Built-in tools: web fetch (Firecrawl), file ops, code execution, email, image generation, media analysis, Spotify, Sonos, Apple Notes, Reminders, Things 3, Notion, Obsidian, Bear, Trello, X (Twitter), 1Password, GIFs, weather, and more
- Policy engine: per-tool allowlist, privilege scopes, budget guards
- Secrets management: SOPS, Vault, file, env — mounted read-only; never exposed to the agent

### 🔍 Private Search
- **Self-hosted SearXNG** — privacy-respecting web search, no query leakage to third parties
- **Brave Search** as an alternative backend
- Configurable engines, safe search levels, per-category controls
- Search audit log (local only), egress proxy routing

### 🎙️ Voice Stack
- **Wake word detection** — always-listening, fully local processing
- **Whisper STT** (faster-whisper) — local speech-to-text, multi-language
- **Piper TTS** — local high-quality text-to-speech synthesis
- Continuous conversation mode — hands-free back-and-forth interaction
- Speaker identification — know who is speaking at all times
- Emotion detection in voice input
- Voice shortcuts — single phrase triggers complex multi-step workflows
- Voice call integration — full call routing through the agent
- Meeting assistant — transcribe, summarise, extract action items

### 📱 Native Mobile — Flutter (iOS & Android)
- Full iOS and Android companion app built in Flutter
- Chat, voice, notifications, deep links, push (FCM + APNs)
- Cold-start < 2 s on mid-range devices
- Offline-capable with sync on reconnect
- Accessibility: WCAG 2.1 AA compliant
- Production release pipeline with signing and store distribution

### 🖥️ Native Desktop — Tauri (macOS / Windows / Linux)
- Rust-based Tauri app — smaller binary, lower memory, OS-native APIs
- Secure keychain / credential store integration
- Auto-update with code signing and provenance verification
- System tray, notifications, deep link handling

### 🌐 Web UIs
- **Admin UI** — full control panel: agents, memory, RAG, scheduler, registry, billing, observability
- **Canvas UI** — rich real-time chat surface with KaTeX math, markdown, code blocks, tool trace viewer, approval flows
- **WebChat widget** — drop Sven into any webpage with a single script tag

### 🏢 Multi-Tenancy & Enterprise SSO
- Organisation-scoped data isolation, RBAC (admin / operator / member)
- **Keycloak / OIDC SSO** — full enterprise single sign-on
- Per-tenant storage mapping, usage metering, and billing
- Integration runtime isolation — tenant workloads sandboxed separately

### 📊 Proactive Intelligence
- Scheduled messages: *"remind me every Monday at 9am"*
- Calendar prefetch: surfaces upcoming events as agent context
- Pattern detection: learns recurring tasks and offers to automate them
- Health monitoring: watches your services and proactively alerts
- Configurable triggers for any event type

### 🔒 Production Security
- TLS 1.2+ enforced end-to-end
- Auth lockout, token expiry, session invalidation on password change
- TOTP required for admin accounts
- CORS allowlist, egress allowlist, no raw-IP egress
- Secrets encrypted at rest, separated from runtime config
- SBOM + cosign image signing, Dependabot, npm audit enforcement
- Dependency vulnerability scanning in CI
- Penetration testing baseline documented in [SECURITY.md](SECURITY.md)

### 📈 Observability & Operations
- Prometheus metrics, structured JSON logging, distributed tracing
- Pre-built dashboards: SLO, agent performance, memory growth, API contract coverage
- Alerting baselines with noise thresholds
- Full ops runbook library: key rotation, incident triage, upgrade guide, backup/restore
- Canary deployment strategy (phase 0 → phase 2 → 100%)
- One-command rollback with rehearsal scripts

### 🗂️ Scheduler
- One-time and recurring tasks (cron expressions)
- Chat-driven scheduling: *"schedule a task"* in natural language
- Admin UI scheduler with run history, manual trigger, enable/disable per task
- Missed-run detection with configurable retry policy

### 💾 Backup & Restore
- One-click backup: PostgreSQL + NATS + config + uploaded files
- S3-compatible remote backup destination
- Configurable retention policy (keep last N backups)
- Pre-restore integrity validation + version compatibility check
- Nightly auto-backup cron with verification alert

### 🔌 AI / LLM Flexibility
- **LiteLLM proxy** — OpenAI, Anthropic, Google, Mistral, local (Ollama, LM Studio), and more
- Per-agent model selection from the Admin UI
- Virtual API keys with per-key spend limits and cost tracking
- Context-window optimisation, prompt refinement A/B testing
- Tool-selection optimisation, resource optimisation profiles
- AI-generated weekly ops report

---

## 📬 Messaging Adapters

Sven ships **20 messaging platform adapters** out of the box:

| Adapter | Notes |
|:---|:---|
| 💬 **Slack** | Bolt SDK, DM + channels |
| 🟦 **Microsoft Teams** | Bot Framework |
| ✈️ **Telegram** | grammY |
| 🎮 **Discord** | discord.js |
| 🟩 **WhatsApp** | Full business API integration |
| 🔵 **Signal** | signal-cli bridge |
| 🟪 **Matrix** | E2E encrypted rooms |
| 🔵 **Google Chat** | Chat API |
| 🍎 **iMessage** | macOS + BlueBubbles |
| 🔷 **Mattermost** | Self-hosted teams chat |
| 🖥️ **IRC** | Classic network support |
| 🔑 **Nostr** | Decentralized protocol |
| 🎥 **Twitch** | Live chat integration |
| 🟢 **Line** | Asia-Pacific messaging |
| 🇻🇳 **Zalo** | Vietnam market |
| 🪶 **Feishu** | Lark / ByteDance |
| ☁️ **Nextcloud Talk** | Self-hosted collaboration |
| 🌊 **Tlon** | Urbit-based messaging |
| 🌐 **WebChat** | Embeddable browser widget |
| 📞 **Voice Call** | SIP / phone integration |

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
║  PostgreSQL  │  NATS JetStream  │  OpenSearch  │  LiteLLM         ║
║  SearXNG     │  Keycloak SSO    │  Faster-Whisper STT             ║
║  Piper TTS   │  Wake-Word       │  Notification Service           ║
╠═══════════════════════════════════════════════════════════════════╣
║                   Messaging Adapters (20)                         ║
║  Slack · Teams · Telegram · Discord · WhatsApp · Signal           ║
║  Matrix · iMessage · IRC · Nostr · Twitch · Line · Zalo           ║
║  Feishu · Nextcloud · Mattermost · Tlon · WebChat · VoiceCall     ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Monorepo Layout

```
thesven/
├── apps/
│   ├── admin-ui/                  # React admin dashboard
│   ├── canvas-ui/                 # Real-time chat canvas (KaTeX, tool traces)
│   ├── companion-user-flutter/    # iOS + Android Flutter companion app
│   └── companion-desktop-tauri/   # macOS / Windows / Linux (Tauri/Rust)
├── services/
│   ├── gateway-api/               # Central API (TypeScript / Node)
│   ├── agent-runtime/             # LLM + tool orchestration engine
│   ├── skill-runner/              # Sandboxed tool executor (gVisor)
│   ├── workflow-executor/         # Scheduler + cron engine
│   ├── registry-worker/           # Skill marketplace pipeline
│   ├── notification-service/      # Push (FCM/APNs), email, in-app
│   ├── rag-indexer/               # Vector indexing engine
│   ├── rag-git-ingestor/          # Git repo ingestion
│   ├── rag-nas-ingestor/          # NAS / filesystem ingestion
│   ├── rag-notes-ingestor/        # Notes app connectors
│   ├── litellm/                   # LLM provider proxy
│   ├── searxng/                   # Self-hosted private search
│   ├── egress-proxy/              # Outbound allowlist proxy
│   ├── faster-whisper/            # Local STT service
│   ├── piper/                     # Local TTS service
│   ├── wake-word/                 # Always-on wake word engine
│   ├── sso/                       # Keycloak OIDC provider
│   ├── sven-mirror-agent/         # Edge agent (Raspberry Pi / kiosk)
│   └── adapter-*/                 # 20 messaging adapters
├── packages/                      # Shared TypeScript packages
├── skills/                        # Built-in skills (SKILL.md standard)
├── tests/                         # E2E + load tests
├── deploy/                        # Kubernetes, Helm, Compose configs
├── config/                        # Service configuration
├── docs/                          # Full documentation
└── scripts/                       # Developer and ops scripts
```

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
git clone https://github.com/47network/thesven.git
cd thesven
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

# Single-node Linux staging / production-v1 baseline
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

For real deployment guidance, do not stop at raw Docker commands. Use the deployment ladder:

- [docs/deploy/deployment-ladder-2026.md](docs/deploy/deployment-ladder-2026.md)
- [docs/deploy/setup-paths-matrix-2026.md](docs/deploy/setup-paths-matrix-2026.md)
- [docs/deploy/github-release-install-guide-2026.md](docs/deploy/github-release-install-guide-2026.md)
- [docs/deploy/staging-linux-vm-2026.md](docs/deploy/staging-linux-vm-2026.md)
- [docs/deploy/production-v1-linux-vm-2026.md](docs/deploy/production-v1-linux-vm-2026.md)
- [docs/deploy/production-scale-2026.md](docs/deploy/production-scale-2026.md)

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

Complete first-run setup in the Admin UI — create your first agent, connect a messaging adapter, and start chatting.

---

## ⚙️ Configuration

All configuration is environment-variable driven. Use [`.env.example`](.env.example) as the canonical compose startup contract and `config/env/.env.*.example` for environment-specific overlays.

| Variable | Description |
|:---|:---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NATS_URL` | NATS broker address |
| `LITELLM_API_BASE` | LiteLLM proxy base URL |
| `SVEN_EGRESS_PROXY` | Forward proxy for tool egress (`http://egress-proxy:3128`) |
| `COOKIE_SECRET` | Session/cookie signing secret — use a strong random value (required) |
| `ADMIN_INITIAL_EMAIL` | First admin account email |
| `ADMIN_INITIAL_PASSWORD` | First admin account password |
| `OPENSEARCH_URL` | OpenSearch / Elasticsearch URL |
| `SSO_ISSUER_URL` | Keycloak / OIDC issuer URL |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging key (mobile push) |

---

## 🚀 Real-World Use Cases

- 👨‍👩‍👧 **Family companion** — your parents WhatsApp it to ask questions, check recipes, set reminders; they never know or care how it works
- 🏠 **Smart home voice hub** — "Hey Sven" triggers from any room; answers questions, controls smart home devices, reads out schedules; runs on a Raspberry Pi mirror agent with no cloud
- 👥 **Friends group assistant** — one bot on a shared Discord or Telegram group that knows each person individually with separate private memory
- 💬 **Multi-channel personal assistant** — you get it on all 20 platforms simultaneously; one brain, everywhere you already are
- 📖 **Personal knowledge base** — index your Git repos, Obsidian vault, Apple Notes, and NAS; ask cross-source questions and get cited answers
- 🏢 **Private team assistant** — when you outgrow personal use: deploy for your organisation, each member gets private memory, shared knowledge base, their own agent profile
- 📹 **Meeting intelligence** — join calls, transcribe in real-time, identify speakers, generate summaries and action items automatically
- ⚙️ **Ops automation** — schedule recurring tasks, monitor service health, trigger runbooks when anomalies are detected
- 🔐 **Enterprise AI on-prem** — multi-tenant, SSO, RBAC, full compliance audit trail — deploy inside your private cloud and own everything

---

## 🆚 How Sven Compares

Most AI tools are built for one tech-savvy person using a terminal. Sven is built to be deployed by one person so that *many people* — regardless of technical ability — can use it every day, privately, without changing anything about how they communicate:

| Capability | Sven | Single-user AI CLI | Chat Bridge Platform |
|:---|:---:|:---:|:---:|
| Self-hosted | ✅ | ✅ | ✅ |
| **Non-technical end users (no setup required for them)** | ✅ | ❌ | ❌ |
| **Per-person private memory** | ✅ | ❌ | ❌ |
| **Home voice hub (wake word + STT + TTS, 100% local)** | ✅ | Partial | ❌ |
| Multi-tenant RBAC | ✅ | ❌ | ❌ |
| Enterprise SSO (Keycloak / OIDC) | ✅ | ❌ | ❌ |
| Native mobile app (Flutter) | ✅ | ❌ | Limited |
| Native desktop app (Tauri) | ✅ | ❌ | Limited |
| Full RAG pipeline (Git + NAS + Notes) | ✅ | Partial | ❌ |
| Temporal decay + MMR re-ranking memory | ✅ | ❌ | ❌ |
| Full local voice stack (STT + TTS + wake word) | ✅ | Partial | Limited |
| Dynamic tool creation at runtime | ✅ | ✅ | ❌ |
| Sandboxed skill execution (gVisor) | ✅ | Partial | ❌ |
| Skill marketplace with revenue sharing | ✅ | ❌ | ❌ |
| Messaging adapters | **20** | 0 | **20** |
| Proactive agent (calendar, health, patterns) | ✅ | ❌ | ❌ |
| One-click backup / restore | ✅ | ✅ | ❌ |
| Canary deployment pipeline | ✅ | ❌ | ❌ |
| Full observability (metrics + traces + alerts) | ✅ | Partial | Partial |
| Operator runbook library | ✅ | ❌ | ❌ |
| Billing / usage metering | ✅ | ❌ | ❌ |

### Capability Proof (machine-verified)

Current runtime-backed parity snapshot (generated from release status artifacts):

| Scope | Proven | Coverage |
|:---|:---:|:---:|
| Agent Zero parity matrix | 111 / 111 | 100% |
| OpenClaw parity matrix | 176 / 176 | 100% |
| Combined competitor rows | 287 / 287 | 100% |
| Wave competitor closeouts (W1..W8) | 8 / 8 pass | 100% |

Evidence artifacts:
- `docs/release/status/competitor-capability-proof-latest.json`
- `docs/release/status/competitor-delta-sheet-latest.json`
- `docs/release/status/parity-checklist-verify-latest.json`

---

## 📖 Documentation

| Document | Description |
|:---|:---|
| [Feature Catalog](docs/features/sven-feature-catalog-2026-03-12.md) | Canonical current capability map and usage pointers |
| [Audience Guides](docs/guides/README.md) | Guided paths for non-technical users, operators, and developers |
| [Role-Based Onboarding Kits](docs/guides/onboarding-kits-by-role.md) | Day-1/week-1 onboarding checklists for family, operators, developers, and security reviewers |
| [Feature Flow Diagrams](docs/architecture/feature-flow-diagrams-2026-03-12.md) | End-to-end execution flows for chat, relay, RAG, mobile push, and release evidence |
| [Enterprise Documentation Standard](docs/documentation/enterprise-documentation-standard-2026.md) | Documentation quality/governance standard for production truthfulness |
| [Master Checklist Coverage Matrix](docs/documentation/master-checklist-doc-coverage-matrix-2026-03-12.md) | Section-by-section documentation coverage with evidence anchors |
| [Documentation Health Dashboard](docs/documentation/docs-health-dashboard-2026-03-12.md) | At-a-glance docs quality status, enterprise gates, and next actions |
| [Repo Hygiene and Packaging](docs/documentation/repo-hygiene-and-release-packaging-2026.md) | Enterprise repository cleanup policy and release packaging audit flow |
| [Live Release Status](docs/release/status/latest.md) | Current strict blockers and release readiness snapshot |
| [Local Testing Guide](docs/release/LOCAL_TESTING_GUIDE.md) | Run the full stack locally end-to-end |
| [Operator Runbooks](docs/ops/) | Key rotation, incident triage, upgrade, backup, troubleshooting |
| [Release Checklists](docs/release/checklists/) | Production readiness gates and sign-offs |
| [Parity Assessment](docs/release/section-i-parity-assessment.md) | Feature parity analysis vs comparable tools |
| [Security Guide](docs/release/section-k-security-privacy.md) | Threat model, controls, pen-test baseline |
| [Performance Guide](docs/release/section-j-performance-accessibility.md) | SLOs, load test results, accessibility compliance |
| [Flutter App Checklist](docs/release/checklists/flutter-user-app-checklist-2026.md) | Mobile release requirements and gates |
| [Ops Runbook Index](docs/ops/runbook-index-2026.md) | Overview of all operational runbooks |
| [Parity: Single-user AI CLI](docs/parity/sven-vs-agent-zero-feature-comparison.md) | Feature-by-feature comparison |
| [Parity: Chat Bridge Platform](docs/parity/Sven_vs_OpenClaw_Feature_Comparison.md) | Feature-by-feature comparison |

---

## 🤝 Contributing

Contributions are welcome — from bug reports to new adapters to full skill implementations.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:
- **Development setup** — prerequisites, local dev stack, hot-reload workflow
- **PR process** — branch naming, commit conventions (Conventional Commits)
- **Testing requirements** — unit, integration, E2E expectations
- **Code style** — ESLint, Prettier, TypeScript strict mode

> **Security vulnerabilities**: follow the responsible disclosure process in [SECURITY.md](SECURITY.md). Do **not** open a public issue.

---

## ⭐ Support the Project

If Sven is useful to you — or to someone you care about — consider starring the repo. It helps others discover the project.

[![Star on GitHub](https://img.shields.io/github/stars/47network/thesven?style=social)](https://github.com/47network/thesven)

---

## 📜 License

[MIT](LICENSE) © 2026 [47network](https://github.com/47network)
