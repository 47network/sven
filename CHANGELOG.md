# Changelog

All notable changes to Sven are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Admin API surface for 47Dynamics bridge tenant mappings (`/v1/admin/integrations/47dynamics/tenant-mappings`) with resolve, upsert, update, and deactivate flows.
- Bridge tenant mapping persistence table (`bridge_tenant_mappings`) with legacy wildcard seed for controlled migration from static bridge defaults.
- Contract regression tests for bridge correlation matching, admin bridge mapping route registration/permissions, and rag-indexer query-result handling.
- Admin bridge mapping health endpoint (`/v1/admin/integrations/47dynamics/tenant-mappings/health`) to audit invalid mappings and strict-mode readiness.
- Executable bridge runtime tests (`services/bridge-47dynamics`) that validate correlation-safe unary and streaming response matching against mocked NATS traffic.
- Bridge runtime tests now also validate strict-mode unmapped-tenant rejection and non-strict fallback routing to legacy org/chat/agent scope.
- Bridge runtime tests now validate `GetActionStatus` auth rejection and tenant-scoped action lookup isolation.
- Bridge runtime tests now validate `SubmitAction` tool-run publish contract and `IndexDomainKnowledge` tenant metadata stamping on `rag.index.request`.
- Bridge runtime tests now validate `RunbookSuggest` query publish contract, query-id correlated result handling, and empty-result behavior when no matching response arrives.
- Bridge runtime tests now validate `HealthCheck` healthy and degraded/unhealthy dependency-state reporting (DB, NATS, LiteLLM).
- Bridge runtime tests now validate `EdgeSummarize` auth rejection, successful LiteLLM summarization response mapping, and failure handling.
- Bridge runtime tests now validate `CopilotAsk` input boundaries for tenant ID format plus empty/oversized questions.
- Bridge runtime tests now validate `IndexDomainKnowledge` auth rejection and document-batch boundary rules (non-empty, max 100).
- Bridge runtime tests now validate `SubmitAction` and `RunbookSuggest` auth rejection plus required-field input validation.
- Bridge runtime tests now validate `GetActionStatus` and `EdgeSummarize` required-field and tenant-context validation boundaries.
- Added CI workflow `.github/workflows/bridge-runtime-tests.yml` to run `services/bridge-47dynamics` runtime tests on PRs, main-branch pushes, and manual dispatch.
- Added CI workflow `.github/workflows/gateway-bridge-contract-tests.yml` to run gateway bridge contract tests for tenant mappings, correlation matching, rag query path, and strict-mode env compatibility.
- Added release-gate mapping updates for bridge CI lanes via `config/release/required-workflows.json`, with contract coverage to prevent workflow-manifest drift.
- Final signoff now explicitly enforces bridge CI lane success signals from `ci-required-checks-latest.json`, and release docs include strict verification commands for those checks.
- Added bridge lane go/no-go helper (`ops:release:bridge-ci-lanes:check[:strict]`) that consolidates required bridge workflow checks plus final-signoff bridge checks into `docs/release/status/bridge-ci-lanes-latest.{json,md}` with remote-evidence enforcement.
- Bridge lane go/no-go helper now also supports local artifact validation (`ops:release:bridge-ci-lanes:check:local[:strict]`) for offline/dev diagnosis while keeping strict remote evidence for promotion authority.
- Added a focused GitHub-backed bridge remote checker (`ops:release:bridge-ci-lanes:remote[:strict]`) that verifies recent successful runs for `bridge-runtime-tests` and `gateway-bridge-contract-tests` without waiting for the full release workflow manifest sweep.
- Added VM-authoritative bridge lane orchestrator (`ops:release:bridge-vm-ci-lanes[:strict]`) to execute local release gates and emit `bridge-vm-ci-lanes-latest.{json,md}` when GitHub-hosted CI is unavailable.
- Bridge CI workflows now support manual dispatch to self-hosted runners (`runner_target=self-hosted`) to avoid GitHub-hosted minutes for bridge lanes.
- Added VM evidence PR publisher (`ops:release:bridge-vm-ci-lanes:pr-comment`) to post bridge gate summaries from local VM artifacts into GitHub PR discussion without requiring hosted CI execution.
- Added one-command VM bridge lane wrapper (`ops:release:bridge-vm-ci-lanes:run-and-comment`) to execute VM local bridge gates and post PR evidence in a single step.

### Changed
- `bridge-47dynamics` now resolves per-request tenant scope (organization/chat/agent) via `bridge_tenant_mappings`, with optional strict mode via `BRIDGE_REQUIRE_TENANT_MAPPING`.
- Bridge tenant resolution now validates mapping integrity at runtime (chat belongs mapped organization and mapped agent is active) before routing requests.

### Fixed
- Tenant admin user creation can no longer create global `admin` users unless caller is platform admin.
- Permissions schema is now organization-scoped via `permissions.organization_id` migration and backfill.
- `RunbookSuggest` bridge flow no longer times out due to query/index contract mismatch; `rag-indexer` now handles query-shaped `rag.index.request` events and emits `rag.index.result`.
- Bridge response correlation is now propagated and matched to reduce cross-talk risk when concurrent requests target the same chat.
- Bridge strict-mode env handling now accepts both `BRIDGE_REQUIRE_TENANT_MAPPING` and legacy `SVEN_BRIDGE_REQUIRE_TENANT_MAPPING` to prevent rollout misconfiguration.

---

## [0.1.0] — 2026-02-23

Initial public release of Sven — a production-grade, self-hosted AI assistant platform.

### Agent & Reasoning
- Multi-agent runtime with per-agent runtimes, routing rules, and profile overrides
- Self-correcting agent loop: error classification, bounded retries, strategy adjustments, infinite-loop detection
- Approval gates triggered at configurable retry thresholds
- Sub-agent nesting with context isolation; agent pause / resume mid-task
- Proactive agent: scheduled messages, calendar prefetch, health monitoring, pattern detection

### Memory & Intelligence
- Persistent memory: per-user private, chat-shared, global, and knowledge-graph scopes
- Temporal decay scoring and MMR (Maximal Marginal Relevance) re-ranking
- Hybrid BM25 + pgvector semantic search via OpenSearch + PostgreSQL
- Memory dashboard: browse, search, edit, delete, bulk-export, import
- Memory consolidation with AI-driven deduplication; delayed recall pipeline

### RAG — Retrieval-Augmented Generation
- Git ingestor: clone any repo, index commits and code for agent context
- NAS ingestor: index network-attached storage
- Notes ingestor: Apple Notes, Obsidian, Bear, Notion
- Structured RAG, multimodal RAG, temporal RAG, cross-agent knowledge sharing
- RAG feedback loop: thumbs up/down improves future retrieval

### Skills & Tools
- 80+ built-in tools: web fetch, file ops, code execution, Spotify, Sonos, Apple Notes, Reminders, Things 3, Notion, Obsidian, Bear, Trello, X (Twitter), 1Password, GIFs, weather, image generation, media analysis, and more
- Sandboxed execution via gVisor — zero host-escape risk
- Dynamic tool creation: agent-authored skills, auto-quarantine pipeline, admin approval
- Skill marketplace (registry): install, version, review, revenue share
- Policy engine: per-tool allowlist, privilege scopes, budget guards
- Secrets management: SOPS, Vault, file, env — read-only, never exposed to agent

### Voice Stack
- Wake word detection (local, always-listening)
- Faster-Whisper STT — local, multi-language speech-to-text
- Piper TTS — local, high-quality speech synthesis
- Continuous conversation mode, speaker identification, emotion detection
- Voice shortcuts, voice call routing, meeting assistant (transcribe + action items)

### Messaging Adapters (20)
- Slack, Microsoft Teams, Telegram, Discord, WhatsApp, Signal, Matrix, Google Chat,
  iMessage, Mattermost, IRC, Nostr, Twitch, Line, Zalo, Feishu, Nextcloud Talk,
  Tlon, WebChat, Voice Call

### Client Applications
- Flutter companion app (iOS + Android) — chat, voice, push (FCM + APNs), offline sync
- Tauri desktop app (macOS / Windows / Linux) — Rust-based, keychain, auto-update
- Admin UI — agents, memory, RAG, scheduler, registry, billing, observability
- Canvas UI — KaTeX math, code blocks, tool trace viewer, approval flows
- WebChat embeddable widget

### Private Search
- Self-hosted SearXNG — no query leakage to third parties
- Brave Search alternative backend; configurable engines, egress proxy routing

### Multi-Tenancy & Security
- Organisation-scoped data isolation, RBAC (admin / operator / member)
- Keycloak / OIDC SSO — full enterprise single sign-on
- Per-tenant storage mapping, usage metering, billing
- TLS 1.2+, auth lockout, TOTP for admin, CORS/egress allowlists
- SBOM + cosign image signing, Dependabot, npm audit enforcement in CI

### Scheduler
- One-time and recurring tasks (natural language or cron expressions)
- Admin UI scheduler with run history, manual trigger, missed-run detection

### Backup & Restore
- One-click backup: PostgreSQL + NATS + config + files to S3-compatible storage
- Retention policy, integrity validation, nightly auto-backup cron

### AI / LLM
- LiteLLM proxy: OpenAI, Anthropic, Google, Mistral, Ollama, LM Studio, and more
- Per-agent model selection, virtual API keys with spend limits, context-window optimisation

### Observability & Operations
- Prometheus metrics, structured JSON logging, distributed tracing
- Pre-built dashboards: SLO, agent performance, memory growth, API contract coverage
- Canary deployment strategy (phase 0 → phase 2 → 100%); one-command rollback
- Full ops runbook library: key rotation, incident triage, upgrade, backup/restore

### Infrastructure
- Docker Compose profiles: dev, staging, production
- GitHub Actions: deployment pipeline, security baseline, Flutter CI, parity E2E,
  release gates, supply chain, canary ops
- NATS JetStream with leaf-node auto-peer discovery
- Edge mirror agent (Raspberry Pi / kiosk)

---

[Unreleased]: https://github.com/47network/thesven/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/47network/thesven/releases/tag/v0.1.0
