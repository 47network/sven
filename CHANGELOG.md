# Changelog

All notable changes to Sven are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Federation instance identity service (5.1): Ed25519 keypair generation via TweetNaCl, AES-256-GCM encrypted private key storage, fingerprint derivation, payload signing/verification, keypair rotation with automatic deactivation.
- Federation discovery & peer management service (5.2): peer registration with UPSERT, handshake protocol (initiate → exchange public keys → complete → upgrade to verified), trust level management (untrusted → verified → trusted → blocked), `.well-known/sven/instance` endpoint data, stale peer pruning.
- Homeserver connection service (5.3): client connection registry (Flutter mobile, Tauri desktop, web, CLI, API), secure connection token via `crypto.randomBytes(32)`, heartbeat mechanism, idle pruning, instance config endpoint with capabilities.
- Federated community topics service (5.4): cross-instance topic creation with peer trust verification, NATS subject generation (`federation.community.{name}`), message counting, topic deactivation (soft delete), federation summary stats.
- Cross-instance agent delegation service (5.5): delegation requests with configurable timeout (5–120s, default 30s), requires active peer with verified/trusted trust level, SQL `INTERVAL`-based timeout expiration, status tracking through full lifecycle.
- Community consent service (5.6): per-user consent toggles (OFF / READ_ONLY / CONTRIBUTE, default OFF), GDPR Article 7 compliant, automatic clearing of sharing flags on revocation, topic-level participation checks, consent stats.
- Data sovereignty service (5.7): org-level federation scope controls (default: federation OFF, mutual TLS required, peer verification required, export none), `canFederateWith()` with peer count limit enforcement, export policy checks (none / anonymized / pseudonymized / full).
- Federation health service (5.8): health check recording with automatic peer status sync, ping simulation, mesh health summary (CTE-based latest-per-peer aggregation), mesh status classification (no_peers / unhealthy / degraded / healthy), audit logging (SOC 2 / GDPR), old record pruning.
- DB migration `20260408180000_federation_tables.sql`: 9 new tables (`federation_instance_identity`, `federation_peers`, `federation_homeserver_connections`, `federation_community_topics`, `federation_agent_delegations`, `federation_consent`, `federation_data_sovereignty`, `federation_peer_health`, `federation_audit_log`) with 15 indexes, proper FK cascades, and CHECK constraints.
- NATS `FEDERATION` stream with `federation.>` subjects (Limits retention, 30-day max_age, file storage). Four subject constants and three dynamic per-peer helpers.
- 35+ federation admin endpoints across all 8 services at `/v1/admin/federation/*` with organisation scoping and audit logging integration.
- 55 unit tests for federation batch: migration structure, service exports, route registration, consent logic, sovereignty defaults, mesh health classification, trust levels, identity crypto, homeserver types, delegation timeouts.
- Quantum-inspired fading memory system (`decay(t) = e^(-γt) × (1 + A × sin(ωt + φ))`) with importance-weighted persistence — memories referenced more often resist decay.
- Quantum fade consolidation worker: background sweep that promotes fading memories to knowledge graph entities before they reach threshold, preserving core insights permanently.
- Brain visualization API (`/v1/admin/brain/graph`): returns live neural map of user's memories, KG entities, emotional states, and reasoning records as a graph with decay-state visual mapping.
- Brain decay trajectory endpoint (`/v1/admin/brain/decay-trajectory`): renders quantum fade curve over time for any parameter set.
- Emotional intelligence engine: keyword-based heuristic analysis detecting mood, sentiment, frustration, excitement, and confusion from user messages with structured signal metadata.
- User reasoning capture service: records WHY users make decisions, detects expertise areas, builds aggregated understanding model across dimensions (risk tolerance, tech preferences, communication style, etc.).
- Memory consent layer (GDPR Articles 15-17): per-user consent controls for consolidation, emotional tracking, and reasoning capture. Includes data export, "forget me" erasure, and retention policy enforcement.
- Quantum fade admin controls (`/v1/admin/memory/quantum-fade-config`): per-organization tuning of gamma, amplitude, omega, consolidation threshold, resonance factor, and memory budget.
- DB migration `20260408120000_quantum_fade_memory.sql`: extends memories table with quantum fade columns, creates quantum_fade_config, emotional_states, user_reasoning, user_understanding, and memory_consent tables with proper indexes and GDPR fields.
- Batch 1 community env vars configured: docs URL, Discord, GitHub Discussions, marketplace, verified persona access mode, OIDC provider, persona allowlist, strict moderation, reviewed-only agent posts, security baseline sign-off.
- Agent persona service: full lifecycle for community agent identities (bot, advisor, assistant, moderator, custom) with organization-scoped CRUD, status management (draft→active→suspended→retired), and community visibility controls.
- Agent-to-agent protocol service: NATS-routed inter-agent messaging with persistent storage, thread tracking, inbox/outbox queries, and message status management (delivered→read→archived).
- Agent rate limiting service: per-agent cadence controls with configurable messages-per-hour, daily limits, cooldown periods, burst allowance, and quiet hours scheduling.
- Smart agent moderator service: automated content moderation with configurable risk scoring, keyword pattern detection, auto-approve/flag/reject thresholds, human review queue, and audit trail.
- Transparency changelog service: public-facing record of all Sven behavior changes with entry types (behavior_change, model_update, capability_added, bug_fix, policy_change), visibility controls, and publish workflow.
- Confidence scoring service: per-response confidence calibration with source reliability, reasoning chain depth, and domain expertise factors. Automatic uncertainty disclosure for low-confidence responses below configurable threshold.
- Feedback routing loop: structured signal collection (thumbs_up/down, correction, suggestion, detailed_review) with model and skill recommendation engine based on aggregated task-type performance analytics.
- Correction pipeline service: user-submitted corrections with verification workflow, promotion to long-term memory, and integration with knowledge graph for persistent learning.
- Pattern observation service: automated detection and tracking of recurring user interaction patterns (user_preference, workflow_pattern, error_pattern, knowledge_gap, communication_style) with occurrence counting, confidence scoring, and self-improvement dashboard snapshots.
- DB migration `20260408140000_community_agents_calibrated_intelligence.sql`: creates agent_personas, agent_messages, agent_rate_limits, agent_posts, moderation_decisions, transparency_changelog, response_confidence, feedback_signals, corrections, and observed_patterns tables with full indexing.
- 35 unit tests for Batch 3+4 services covering route registration, confidence disclosure logic, and service class exports.
- Guide Agent service (3.2): newcomer onboarding, FAQ knowledge base with keyword search, welcome message generation, usage tracking, and category-based FAQ management.
- Inspector Agent service (3.3): continuous capability testing across 12 Sven subsystems (database, KG, memory, agent protocol, chat, channels, file storage, search, notifications, scheduler, NATS, database), health summary with pass/fail/degraded classification, and response time monitoring.
- Curator Agent service (3.4): watch-before-speak pattern — analyzes confirmed patterns and verified corrections to create significance-scored highlights, with publish workflow and community insight surfacing.
- Advocate Agent service (3.5): automatic feature request surfacing from community pattern observations, vote tracking, priority classification, and roadmap landscape summary with status/priority breakdown.
- QA Agent service (3.6): community-visible bug reporting with severity classification, duplicate detection (links to existing open bugs on same capability), reproduction step tracking, and quality metrics dashboard (MTTF, by-severity, by-capability).
- Librarian Agent service (3.7): knowledge index and living wiki with topic-based entries, full-text search with relevance scoring, bidirectional topic linking, view counting, and entry type classification (article, faq, guide, reference, glossary).
- Feature Tester Agent service (3.8): end-to-end test scenario management with lifecycle (pending→running→passed/failed/skipped/blocked), execution timing, and testing summary with pass rate and failure analysis.
- Feature Imagination Agent service (3.9): creative use-case invention with scenario categories (novel_workflow, cross_feature_combo, edge_case_exploration, user_persona_simulation, stress_scenario, creative_misuse), propose-to-tester workflow, and creativity summary metrics.
- Dedicated agent test VM compose (3.14): isolated Docker Compose environment (`docker-compose.vm-agents-test.yml`) with sandboxed PostgreSQL, NATS, and gateway-api for safe agent experimentation without production impact.
- DB migration `20260408160000_agent_type_tables.sql`: creates agent_faq_entries, agent_capability_reports, agent_curated_highlights, agent_feature_requests, agent_bug_reports, agent_knowledge_index, and agent_test_scenarios tables with proper FK cascades and indexes.
- Admin routes for all 8 agent types: bootstrap, CRUD, and domain-specific endpoints (40+ new endpoints) registered via `registerAgentTypeRoutes`.
- 42 unit tests for agent type implementations covering migration structure, service exports, route registration, welcome message logic, health classification, FAQ edge cases, imagination categories, and QA deduplication.
- Personality Engine module (`packages/shared/src/personality-engine.ts`): configurable buddy personality modes (professional, friendly, casual, terse), mood derivation from operational signals, XP/leveling system, achievement tracking, streak tracking, context-aware greetings, and milestone celebrations.
- Visual Companion types (`packages/shared/src/visual-companion.ts`): companion species, appearance, accessory slots, XP display, achievement display, streak display, companion events (WebSocket), and companion settings for frontend rendering across Tauri desktop, Flutter mobile, and admin-ui web surfaces.
- Smart Digest enhancement: buddy daily/weekly digests now include success rate, top tools, error pattern detection with proactive suggestions, conversation activity, streak tracking, and milestone celebrations.
- Feature flag environment variables for agent-runtime: `FEATURE_PROMPT_GUARD_ENABLED`, `FEATURE_MEMORY_EXTRACTOR_ENABLED`, `FEATURE_ANTI_DISTILLATION_ENABLED`, watermark config (`SVEN_WATERMARK_ENABLED`, `SVEN_WATERMARK_PAYLOAD`, `SVEN_WATERMARK_DENSITY`, `SVEN_FINGERPRINT_SECRET`), and buddy config (`BUDDY_PERSONALITY_MODE`, `BUDDY_STREAK_TRACKING`).
- Feature flag environment variables for skill-runner: `SVEN_COMMIT_AUTHOR_NAME`, `SVEN_COMMIT_AUTHOR_EMAIL`.
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
- Piper TTS: `VOICE_TTS_STORAGE` absolute paths were incorrectly joined with `process.cwd()`, causing `EACCES: permission denied, mkdir '/app/var'` crash loop in container.
- LiteLLM healthcheck: replaced broken `curl` command (not available in container) with `python3 urllib` check against `/health/liveliness` (no auth required).
- Ollama compose device mappings: replaced fragile per-device (`/dev/dri/cardN`, `/dev/dri/renderDN`) mounts with `/dev/dri:/dev/dri` to survive device renumbering across reboots.
- Faster-whisper: removed NVIDIA device request dependency from compose; set `FASTER_WHISPER_DEVICE=cpu` for AMD GPU hosts where CUDA is unavailable.
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
