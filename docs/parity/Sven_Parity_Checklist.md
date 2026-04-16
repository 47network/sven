# Sven — OpenClaw Parity & Beyond Checklist

> **Goal**: Close every gap with OpenClaw/ClawdBot, then exceed it.  
> **Baseline**: Sven v0.1.0 (23 sections complete, 0 compilation errors)  
> **Source**: `Sven_vs_OpenClaw_Feature_Comparison.md` (rev 3 — 176 OC features), `docs/parity/sven-vs-agent-zero-feature-comparison.md` (rev 15 — 111 AZ features)  
> **Status**: 176/176 OC matched (100%), 111/111 AZ matched (100%) — 38 Sven-only advantages

---

## Progress Summary

| Phase | Target | Sections | Status |
|-------|--------|:--------:|:------:|
| v0.1.0 (DONE) | Core platform | 0–23 | ✅ 100% |
| v0.2.0 (DONE) | P0 Critical gaps | 24–27 | ✅ 100% |
| v0.3.0 (DONE) | P1 Important gaps | 28–32 | ✅ 100% |
| v0.4.0 (DONE) | P2 Nice-to-have | 33–39 | ✅ 100% |
| v0.5.0 (DONE) | Partial → Full | 40–44 | ✅ 100% |
| Production (DONE) | Final gates | 45–49 | ✅ 100% |

---

# ═══════════════════════════════════════════
# PHASE 0 — ALREADY COMPLETE (v0.1.0)
# ═══════════════════════════════════════════

> These are done. Listed for tracking and to show parity/advantages over OpenClaw.

## ✅ Matched Features (51 items — already at parity)

- [x] Local-first gateway control plane (REST + NATS vs OC's WS)
- [x] Session model with group isolation + DM always-respond
- [x] Agent runtime with policy engine + LLM router
- [x] Media pipeline (file/audio events, STT routing)
- [x] NATS JetStream event bus (7 streams, durable consumers) — **superior to OC**
- [x] PostgreSQL + pgvector (50+ tables, 12 migrations) — **superior to OC**
- [x] Structured JSON logging everywhere
- [x] OpenTelemetry + Prometheus + Grafana observability
- [x] WhatsApp adapter (files, audio, approval buttons)
- [x] Telegram adapter (inline keyboards, files, voice notes)
- [x] Slack adapter (Block Kit buttons, threads, files)
- [x] Discord adapter (buttons, threads, files, audio)
- [x] Google Chat adapter (cards/actions, threads)
- [x] Signal adapter (text command approvals, files)
- [x] BlueBubbles/iMessage adapter (text command approvals, file handling)
- [x] Microsoft Teams adapter (cards/actions, files)
- [x] WebChat channel (full feature reference client)
- [x] Group routing (mention gating, prefix triggers, allowlists)
- [x] STT — faster-whisper service
- [x] TTS — Piper service
- [x] Wake word — openWakeWord/Porcupine
- [x] Canvas UI with block rendering + artifacts
- [x] Git ops (local/Forgejo/GitHub, branch/PR/commit/merge)
- [x] Home Assistant integration with tiered approvals — **superior to OC (community skill only)**
- [x] Calendar (CalDAV + Google) with full OAuth — **superior to OC (community skill only)**
- [x] SKILL.md format parsing (YAML frontmatter, inputs/outputs schema)
- [x] Skill install from public/private/local sources
- [x] Quarantine pipeline (SBOM/Syft, vuln scan/Grype/Trivy, gVisor) — **superior to OC**
- [x] OCI image skills with digest pinning + cosign verification
- [x] LLM multi-provider (local-first Ollama/vLLM + cloud fallback)
- [x] Model failover with performance profiles
- [x] Session/context management
- [x] Hybrid RAG (OpenSearch BM25 + pgvector) with ACL-filtered retrieval
- [x] Workspace identity docs (sven_identity_docs, global + per-chat overlays)
- [x] Memories (user_private/chat_shared/global)
- [x] Admin UI (16+ pages, TanStack Table, realtime, dark mode)
- [x] Canvas UI (chat timeline, search, approvals inbox)
- [x] Container-per-call + gVisor + Firecracker sandbox
- [x] Deny-by-default policy engine with explicit allow/deny scopes
- [x] Network egress control (deny all, proxy, domain allowlist, audit) — **superior to OC**
- [x] Secret management (SOPS/age, Vault, redaction filters)
- [x] RBAC middleware + admin-only routes + per-scope permissions
- [x] Session cookie hardening (Secure/HttpOnly/SameSite)
- [x] Approval-gated write scopes + quorum logic
- [x] Docker Compose deployment stack
- [x] Health endpoints for every service
- [x] Budget enforcement (usage_counters) in LLM Router
- [x] WebSocket/SSE realtime updates (presence + typing)
- [x] CI pipeline with release tagging/version strategy
- [x] Workflow engine (create/version/enable, pause/resume/retry/cancel)
- [x] Workflow approval checkpoint steps

## ✅ Sven-Only Advantages (24 items — OpenClaw lacks these)

- [x] Knowledge Graph — entity/relation extraction with evidence citations
- [x] Prompt Firewall — tool call justification + system prompt hash drift detection
- [x] Kill Switch — instantly overrides ALL write scopes system-wide
- [x] Lockdown Mode — forces quarantine on all new skills during incidents
- [x] Forensics Mode — pauses tools but keeps read-only chat/canvas
- [x] Envelope Encryption — per-user wrapped DEKs, master key rotation, audit trail
- [x] Audit Hash Chain — cryptographic tool-run attestation (prev_hash → run_hash → sha256)
- [x] Model Governance — canary rollouts with auto-rollback triggers
- [x] Policy Simulator — deterministic "decision explanation object"
- [x] Backpressure System — ordered service degradation with auto-deactivation
- [x] Performance Profiles — Gaming/Balanced/Performance with resource limits + feature flags
- [x] Replay Harness — synthetic scenario testing with similarity scoring + delta comparison
- [x] Backup & DR — nightly/weekly/monthly + quarterly DR drill checklists
- [x] Privacy/Compliance — PII detection, data export/deletion, retention, redaction rules
- [x] HA Tiered Approvals — danger tier classification (1/2/3) with escalating quorums
- [x] HA Event Subscriptions — polling with state/attribute matching + cooldown
- [x] HA Automation Builder — state/numeric/time triggers with approval flows
- [x] NAS File Ops — per-user boundary enforcement with mount modes
- [x] Web Fetch with Egress Proxy — domain allowlist enforcement
- [x] Cosign Signature Verification — cryptographic OCI skill image verification
- [x] Workflow Builder UI — DAG editor with step timeline visualization
- [x] RAG Citation Verifier — reject/rewrite claims without citations
- [x] Escalation Rules — approvals aging into escalations with notifications
- [x] Improvement Items — self-improvement flow with tracked evidence

---

# ═══════════════════════════════════════════
# PHASE 1 — P0 CRITICAL (v0.2.0)
# ═══════════════════════════════════════════

> These are the 4 biggest competitive gaps. Implement first.

---

## 24) Browser Automation Service

> OpenClaw: Dedicated Chrome/Chromium with CDP control, snapshots, actions, uploads, profiles.  
> Sven today: Only HTTP fetch + HTML extraction. No browser interaction.

### 24.1 Browser Engine
- [x] Playwright or Puppeteer integration chosen
- [x] Dedicated Chromium instance managed by Sven
- [x] Browser launched in headless mode by default
- [x] Optional headed mode for debugging
- [x] Browser lifecycle management (start/stop/restart)

### 24.2 Core Browser Tools
- [x] `browser.navigate` — navigate to URL (respects domain allowlist)
- [x] `browser.snapshot` — capture full page screenshot (PNG)
- [x] `browser.screenshot_element` — capture specific element screenshot
- [x] `browser.get_text` — extract visible text from current page
- [x] `browser.get_html` — extract DOM/HTML from current page or selector
- [x] `browser.click` — click element by selector or text
- [x] `browser.type` — type text into input field
- [x] `browser.fill_form` — fill form fields by name/selector mapping
- [x] `browser.select` — select dropdown option
- [x] `browser.scroll` — scroll page (up/down/element into view)
- [x] `browser.wait` — wait for selector/navigation/timeout
- [x] `browser.evaluate` — execute JavaScript in page context (sandboxed)

### 24.3 Advanced Features
- [x] Profile management (cookies/local storage/sessions persist per profile)
- [x] File upload support (input[type=file])
- [x] File download capture (download to temp + return artifact)
- [x] Multi-tab support (open/close/switch tabs)
- [x] PDF generation from page
- [x] Network request interception (optional, for debugging)

### 24.4 Security Integration
- [x] Domain allowlist enforced (reuse web fetch allowlist or separate)
- [x] Egress proxy integration for browser traffic
- [x] All browser actions logged to audit trail
- [x] Approval required for write actions (form submit, file upload)
- [x] Block raw IP navigation unless allowlisted
- [x] Browser runs in sandboxed container (not host process)

### 24.5 Database & API
- [x] `browser_profiles` table (id, name, storage_path, created_at, last_used)
- [x] `browser_sessions` table (id, profile_id, started_at, ended_at, pages_visited)
- [x] REST API: POST /v1/tools/browser/navigate
- [x] REST API: POST /v1/tools/browser/snapshot
- [x] REST API: POST /v1/tools/browser/action (click/type/fill/select)
- [x] REST API: GET /v1/tools/browser/profiles
- [x] REST API: POST /v1/tools/browser/profiles

### 24.6 Tests
- [x] E2E: Navigate to allowed domain → screenshot → extract text
- [x] E2E: Navigate to blocked domain → verify denied
- [x] E2E: Fill form → submit → verify action logged
- [x] E2E: Profile persistence (cookies survive restart)
- [x] E2E: File download → artifact stored
- [x] E2E: Approval required for form submission
- [x] Compilation: 0 errors

---

## 25) CLI Tool (sven-cli)

> OpenClaw: Full CLI — `openclaw gateway`, `agent`, `send`, `wizard`, `doctor`.  
> Sven today: Admin via REST API + Admin UI only. No CLI.

### 25.1 CLI Framework
- [x] CLI framework chosen (Commander.js / yargs / oclif)
- [x] `sven` binary entry point (bin field in package.json)
- [x] Global install works: `npm install -g @sven/cli`
- [x] Help text for every command (`sven --help`, `sven <cmd> --help`)
- [x] Version output: `sven --version`
- [x] JSON output flag for all commands (`--json`)

### 25.2 Gateway Commands
- [x] `sven gateway start` — start gateway daemon
- [x] `sven gateway stop` — stop gateway daemon
- [x] `sven gateway status` — show gateway health/uptime/connections
- [x] `sven gateway restart` — restart gateway
- [x] `sven gateway logs` — tail gateway logs (optional `--follow`)

### 25.3 Agent Commands
- [x] `sven agent` — interactive chat REPL with the assistant
- [x] `sven agent --message "..."` — single-shot message + response
- [x] `sven agent --chat <chat_id>` — resume specific chat
- [x] `sven agent --model <model>` — override model for this session
- [x] `sven agent --thinking <level>` — set thinking level (off/low/medium/high)
- [x] Streaming output (token-by-token display)

### 25.4 Send Commands
- [x] `sven send --to <channel:target> --message "..."` — send to any connected channel
- [x] `sven send --channel discord --target #general --message "..."` — send to Discord channel
- [x] `sven send --channel slack --target #ops --message "..."` — send to Slack channel
- [x] `sven send --file <path>` — attach file to message
- [x] Confirmation prompt before sending (unless `--yes`)

### 25.5 Wizard (Onboarding)
- [x] `sven wizard` or `sven onboard` — interactive setup wizard
- [x] Step 1: Create admin account + TOTP setup
- [x] Step 2: Configure database connection (Postgres)
- [x] Step 3: Configure NATS connection
- [x] Step 4: Configure OpenSearch (optional)
- [x] Step 5: Configure inference endpoint (Ollama/vLLM/cloud)
- [x] Step 6: Configure first channel (Discord/Telegram/Slack)
- [x] Step 7: Test connections + generate config
- [x] Step 8: Install daemon (systemd/launchd/PM2)
- [x] Writes config to `~/.sven/sven.json` or `.env`

### 25.6 Doctor (Diagnostics)
- [x] `sven doctor` — run full diagnostic check
- [x] Check: Gateway reachable
- [x] Check: Database connection + migrations current
- [x] Check: NATS connection + streams exist
- [x] Check: OpenSearch connection (if configured)
- [x] Check: Inference endpoint reachable
- [x] Check: Channel adapters connected
- [x] Check: Security — risky/misconfigured settings flagged
- [x] Check: Disk space / NAS mounts
- [x] Check: SSL/TLS certificates (if configured)
- [x] Output: summary with ✅/⚠️/❌ per check

### 25.7 Utility Commands
- [x] `sven channels list` — show connected channels + status
- [x] `sven channels login <channel>` — pair/login to a channel
- [x] `sven skills list` — show installed skills
- [x] `sven skills install <slug>` — install a skill from registry
- [x] `sven approvals list` — show pending approvals
- [x] `sven approvals approve <id>` — approve from CLI
- [x] `sven pairing approve <channel> <code>` — approve DM pairing
- [x] `sven config get <key>` — read config value
- [x] `sven config set <key> <value>` — write config value
- [x] `sven update` — self-update CLI + gateway

### 25.8 Tests
- [x] Unit: All commands parse arguments correctly
- [x] Unit: Help text renders for every command
- [x] Integration: `sven doctor` connects to running services
- [x] Integration: `sven agent --message` returns response
- [x] E2E: `sven wizard` completes full setup flow (mock)
- [x] Compilation: 0 errors

---

## 26) Chat Commands System

> OpenClaw: `/status`, `/new`, `/reset`, `/compact`, `/think`, `/verbose`, `/usage`, `/restart`, `/activation`.  
> Sven today: Group trigger modes (mention/prefix) but no in-chat command system.

### 26.1 Command Parser
- [x] Chat command prefix configurable (default: `/`)
- [x] Command parser in agent runtime (intercept before LLM)
- [x] Unknown commands return helpful error message
- [x] Commands work across all channels (Discord, Slack, Telegram, WebChat, etc.)
- [x] Commands are case-insensitive

### 26.2 Session Commands
- [x] `/status` — show session info (model, token count, cost estimate, uptime)
- [x] `/new` or `/reset` — reset session context (fresh conversation)
- [x] `/compact` — smart context compaction (summarize + trim old messages)
- [x] `/history` — show recent message count / session length
- [x] `/session` — show session metadata (id, started_at, message_count)

### 26.3 Agent Control Commands
- [x] `/think <level>` — set reasoning depth (off | low | medium | high)
- [x] `/verbose on|off` — toggle detailed/verbose responses
- [x] `/model <model_name>` — switch model for current session
- [x] `/usage off|tokens|full` — per-response usage footer display
- [x] `/profile gaming|balanced|performance` — switch performance profile

### 26.4 Group Commands (admin-only)
- [x] `/activation mention|always` — toggle group activation mode
- [x] `/restart` — restart the gateway (admin-only in groups)
- [x] `/mute <duration>` — temporarily mute bot in group
- [x] `/unmute` — unmute bot in group

### 26.5 Utility Commands
- [x] `/help` — list available commands
- [x] `/version` — show Sven version
- [x] `/skills` — list active skills in current session
- [x] `/rag on|off` — toggle RAG for current session
- [x] `/buddy on|off` — toggle buddy mode (HQ only)

### 26.6 Database & Persistence
- [x] Per-session command state persisted (think level, verbose, usage mode)
- [x] `session_settings` table or extension to `sessions` table
- [x] Settings survive reconnections within same session

### 26.7 Tests
- [x] E2E: `/status` returns valid session info
- [x] E2E: `/reset` clears context + starts fresh
- [x] E2E: `/compact` reduces token count
- [x] E2E: `/think high` changes reasoning behavior
- [x] E2E: `/model` switches model mid-session
- [x] E2E: `/help` lists all commands
- [x] E2E: unknown command returns error
- [x] Compilation: 0 errors

---

## 27) Context Compaction Engine

> OpenClaw: `/compact` summarizes conversation history to save tokens.  
> Sven today: Session reset only. No smart compaction.

### 27.1 Compaction Strategy
- [x] Summarization-based compaction (LLM summarizes older messages)
- [x] Configurable compaction threshold (e.g., compact when > 80% of context window)
- [x] Auto-compact option (compact automatically when approaching limit)
- [x] Manual compact via `/compact` chat command
- [x] Preserve recent N messages verbatim (configurable, default: last 10)
- [x] Preserve pinned facts / user profile data through compaction
- [x] Preserve tool results from recent N turns

### 27.2 Token Budget Management
- [x] Token counting per session (input + output)
- [x] Context window tracking per model (know max tokens)
- [x] Warning when approaching context limit (80%)
- [x] Auto-compact trigger at configurable threshold
- [x] Cost estimation (per model pricing)

### 27.3 Compaction Service
- [x] CompactionService.ts
- [x] `compactSession(sessionId, options)` — run compaction
- [x] `estimateTokenCount(sessionId)` — count current tokens
- [x] `getContextBudget(modelId)` — get model's context window size
- [x] `shouldCompact(sessionId)` — check if compaction needed
- [x] `getCompactionHistory(sessionId)` — list past compactions

### 27.4 Database
- [x] `compaction_events` table (id, session_id, before_tokens, after_tokens, summary_text, created_at)
- [x] `session_token_usage` table or add token_count field to sessions

### 27.5 REST API
- [x] POST /v1/sessions/{id}/compact — trigger compaction
- [x] GET /v1/sessions/{id}/token-usage — get token count + budget
- [x] GET /v1/sessions/{id}/compaction-history — list compaction events

### 27.6 Tests
- [x] E2E: Compact reduces token count significantly
- [x] E2E: Recent messages preserved after compaction
- [x] E2E: Pinned facts survive compaction
- [x] E2E: Auto-compact triggers at threshold
- [x] E2E: Token count tracking accurate
- [x] Compilation: 0 errors

---

# ═══════════════════════════════════════════
# PHASE 2 — P1 IMPORTANT (v0.3.0)
# ═══════════════════════════════════════════

> Close ecosystem and UX gaps that matter for real-world usage.

---

## 28) Agent-to-Agent Sessions

> OpenClaw: `sessions_list`, `sessions_history`, `sessions_send` for cross-session coordination.  
> Sven today: Single-agent architecture. No cross-agent coordination.

### 28.1 Multi-Agent Foundation
- [x] Agent registry (multiple named agent instances)
- [x] Per-agent workspace + session isolation
- [x] Agent spawn/destroy lifecycle
- [x] Agent routing rules (which channels → which agent)

### 28.2 Session Coordination Tools
- [x] `sessions_list` — discover active sessions (agents) + metadata
- [x] `sessions_history` — fetch transcript logs for another session
- [x] `sessions_send` — message another session/agent
- [x] Reply-back ping-pong (agent A sends → agent B responds → agent A gets reply)
- [x] `REPLY_SKIP` / `ANNOUNCE_SKIP` control flags
- [x] `sessions_spawn` — spawn a new sub-session for delegation

### 28.3 Supervisor Pattern (optional)
- [x] Supervisor agent can orchestrate sub-agents
- [x] Task routing based on agent capabilities
- [x] Result aggregation from multiple agents
- [x] Conflict resolution for overlapping capabilities

### 28.4 Database
- [x] `agents` table (id, name, workspace_path, model, status, created_at)
- [x] `agent_sessions` table (agent_id, session_id, routing_rules)
- [x] `inter_agent_messages` table (from_agent, to_agent, session_id, message, status)

### 28.5 Tests
- [x] E2E: Spawn second agent → list shows both
- [x] E2E: Send message to other agent → receive response
- [x] E2E: Session history fetched across agents
- [x] E2E: Routing rules direct channel to correct agent
- [x] Compilation: 0 errors

---

## 29) MCP (Model Context Protocol) Support

> OpenClaw / VoltAgent: Connect to MCP servers for extended context and tools.  
> Sven today: No MCP support.

### 29.1 MCP Client
- [x] MCP client library integrated (official SDK or compatible)
- [x] Connect to local MCP servers (stdio transport)
- [x] Connect to remote MCP servers (SSE/HTTP transport)
- [x] Server discovery + capability negotiation
- [x] Tool listing from connected servers
- [x] Resource/prompt listing from connected servers

### 29.2 MCP Configuration
- [x] MCP server config in settings (url, transport, auth)
- [x] Admin UI page: /mcp-servers (list/add/remove/test)
- [x] per-chat MCP server overrides (optional)
- [x] Auto-reconnect on MCP server restart

### 29.3 MCP Tool Execution
- [x] MCP tools appear in agent's available tools list
- [x] MCP tool calls routed through policy engine (allow/deny)
- [x] MCP tool results returned to agent context
- [x] MCP tool calls logged in audit trail
- [x] Timeout enforcement for MCP tool calls

### 29.4 MCP Server Mode (Sven as MCP server)
- [x] Sven exposes its tools as MCP tools
- [x] External agents can call Sven tools via MCP
- [x] Authentication for inbound MCP connections
- [x] Rate limiting for MCP requests

### 29.5 Database
- [x] `mcp_servers` table (id, name, transport, url, status, capabilities_json, last_connected)
- [x] `mcp_tool_calls` table (id, server_id, tool_name, input, output, duration_ms)

### 29.6 Tests
- [x] E2E: Connect to mock MCP server → list tools
- [x] E2E: Call MCP tool → receive result
- [x] E2E: MCP tool blocked by policy → denied
- [x] E2E: MCP tool call logged in audit trail
- [x] Compilation: 0 errors

---

## 30) DM Pairing Security

> OpenClaw: Unknown senders get pairing code, must be approved via CLI/admin before bot responds.  
> Sven today: Adapter token management + allowlists but no pairing flow.

### 30.1 Pairing Flow
- [x] Unknown sender sends DM → bot replies with short pairing code (6-digit)
- [x] Bot does NOT process the message (only sends pairing code)
- [x] Pairing code expires after configurable TTL (default: 5 minutes)
- [x] Admin receives notification of pending pairing request
- [x] Admin approves/denies via Admin UI or CLI (`sven pairing approve <channel> <code>`)
- [x] On approval, sender added to channel allowlist
- [x] On denial, sender optionally blocked

### 30.2 Policy Configuration
- [x] `dmPolicy` per channel: `"pairing"` (default) | `"open"` | `"deny"`
- [x] `"pairing"` — require pairing code approval
- [x] `"open"` — anyone can DM (opt-in, security warning)
- [x] `"deny"` — ignore all unknown DMs silently
- [x] Per-channel allowlists (`channels.<channel>.dm.allowFrom`)
- [x] Wildcard support (`"*"` to allow all)

### 30.3 Database
- [x] `pairing_requests` table (id, channel, sender_id, code, status, created_at, expires_at, approved_by)
- [x] `channel_allowlists` table extension (channel, sender_id, approved_at, approved_by)

### 30.4 Admin UI
- [x] /pairing page (list pending codes, approve/deny buttons)
- [x] Notification badge for pending pairings
- [x] Channel settings: DM policy selector

### 30.5 Tests
- [x] E2E: Unknown sender → receives pairing code
- [x] E2E: Admin approves → sender can now chat
- [x] E2E: Expired code → re-generates on next message
- [x] E2E: dmPolicy="deny" → no response at all
- [x] E2E: dmPolicy="open" → processes immediately
- [x] Compilation: 0 errors

---

## 31) Additional Channels

> OpenClaw: Matrix, Zalo, Zalo Personal as extension channels.  
> Sven today: 9 channels (no Matrix, Zalo).

### 31.1 Matrix Adapter
- [x] Matrix SDK integration (matrix-js-sdk or matrix-bot-sdk)
- [x] Homeserver configuration (URL, access token)
- [x] Room join/leave management
- [x] Message ingestion (text + media)
- [x] Reply/thread support
- [x] File upload/download
- [x] Approval buttons via reactions or text commands
- [x] E2E encryption support

### 31.2 Zalo Adapter (if demand exists)
- [x] Zalo OA API integration
- [x] Message ingestion
- [x] File/image support
- [x] Reply support
- [x] Approval via text commands

### 31.3 Shared
- [x] All new adapters follow existing adapter contract (ingest → NATS → outbox)
- [x] Identity linking for new channels
- [x] Adapter token management in Admin UI

### 31.4 Tests
- [x] E2E: Matrix ingest → NATS → runtime → outbox → deliver
- [x] E2E: Matrix file upload handling
- [x] E2E: Matrix approval via reactions
- [x] Compilation: 0 errors

---

## 32) Cron & Webhooks Surface

> OpenClaw: Dedicated cron jobs + wakeups + webhook surface.  
> Sven today: Has workflow scheduling but no standalone cron or webhook system.

### 32.1 Cron Jobs
- [x] Cron expression parser (standard 5-field cron syntax)
- [x] `cron_jobs` table (id, name, expression, handler, enabled, last_run, next_run)
- [x] CRUD API: POST/GET/PUT/DELETE /v1/admin/cron
- [x] Built-in handlers: backup, RAG re-index, digest generation, health check
- [x] Custom handlers: trigger workflow, send message, run tool
- [x] Cron job history (runs, duration, status)
- [x] Admin UI: /cron page (list, enable/disable, run now, history)

### 32.2 Webhooks
- [x] `webhooks` table (id, name, path, secret, handler, enabled)
- [x] POST /v1/webhooks/{path} — receive external events
- [x] Webhook signature verification (HMAC-SHA256)
- [x] Webhook → NATS event publishing
- [x] Webhook → workflow trigger
- [x] Webhook → agent message (configurable chat/session)
- [x] Admin UI: /webhooks page (create, test, logs)

### 32.3 Tests
- [x] E2E: Cron job fires at scheduled time
- [x] E2E: Webhook receives POST → triggers handler
- [x] E2E: Webhook signature verification passes/fails
- [x] Compilation: 0 errors

---

# ═══════════════════════════════════════════
# PHASE 3 — P2 NICE-TO-HAVE (v0.4.0+)
# ═══════════════════════════════════════════

> Polish, ecosystem completions, and advanced features.

---

## 33) ElevenLabs Voice Integration

> OpenClaw: ElevenLabs as premium cloud voice provider.  
> Sven today: Piper (local TTS) only.

- [x] ElevenLabs API client
- [x] Voice selection (voice_id configuration)
- [x] Text-to-speech via API (streaming audio)
- [x] Voice provider abstraction (swap between Piper / ElevenLabs / OpenAI)
- [x] Per-channel voice provider override
- [x] Usage tracking / cost estimation for cloud voices
- [x] Fallback: ElevenLabs → Piper when API unavailable
- [x] Tests: E2E cloud TTS + fallback

---

## 34) Tailscale Integration

> OpenClaw: Built-in Serve/Funnel for remote Gateway access.  
> Sven today: VPN-first but no Tailscale automation.

- [x] `tailscale serve` integration for tailnet-only HTTPS
- [x] `tailscale funnel` integration for public HTTPS
- [x] Configuration: `gateway.tailscale.mode` (off | serve | funnel)
- [x] Auto-configure on gateway start
- [x] Force password auth when funnel enabled
- [x] Reset serve/funnel on gateway shutdown (optional)
- [x] Tests: Tailscale Serve configures correctly

---

## 35) Gmail Pub/Sub Email Triggers

> OpenClaw: Gmail Pub/Sub for email-triggered workflows.  
> Sven today: No email integration.

- [x] Google Cloud Pub/Sub subscription for Gmail push notifications
- [x] Gmail API integration (read/label/archive emails)
- [x] Email → NATS event publishing
- [x] Email → workflow trigger
- [x] Email → agent message (configurable routing)
- [x] Admin UI: /email page (configure, test, logs)
- [x] Tests: Email push → NATS → handler

---

## 36) Resumable Streaming

> VoltAgent: Clients reconnect mid-stream after refresh.  
> Sven today: Standard request/response API.

- [x] Server-Sent Events (SSE) for streaming responses
- [x] Stream ID for each response stream
- [x] Client reconnect with `Last-Event-ID` header
- [x] Buffer recent events for reconnection window (configurable TTL)
- [x] Stream resume from last received event
- [x] WebSocket alternative transport (optional)
- [x] Tests: Disconnect mid-stream → reconnect → resume

---

## 37) Live Canvas A2UI

> OpenClaw: Agent-driven UI push/reset/eval model.  
> Sven today: Static canvas with pre-rendered blocks.

- [x] A2UI protocol definition (push, reset, eval, snapshot)
- [x] Agent can push HTML/React components to canvas in real-time
- [x] Agent can evaluate JavaScript in canvas context (sandboxed)
- [x] Canvas snapshot on demand (capture current state)
- [x] Canvas reset (clear and rebuild)
- [x] Bidirectional: user interactions in canvas → agent events
- [x] Tests: Agent pushes UI → user sees updates → user interacts → agent responds

---

## 38) Native Companion Apps (macOS/iOS/Android)

> OpenClaw: macOS menu bar, iOS node, Android node.  
> Sven today: Web only (Admin UI + Canvas UI).

### 38.1 macOS Menu Bar App
- [x] Electron or Swift wrapper
- [x] Gateway connect/disconnect toggle
- [x] Quick chat overlay
- [x] Voice Wake activation
- [x] Push-to-talk
- [x] System notifications for approvals
- [x] Tray icon with status indicator

### 38.2 iOS App
- [x] React Native or SwiftUI
- [x] Canvas view
- [x] Voice Wake + Talk Mode
- [x] Camera snap/clip capability
- [x] Push notifications (approvals, digests)
- [x] Bonjour pairing with gateway

### 38.3 Android App
- [x] React Native or Kotlin
- [x] Canvas view
- [x] Talk Mode
- [x] Camera snap/clip capability
- [x] Push notifications

---

## 39) Miscellaneous P2 Items

### 39.1 Nix Deployment Support
- [x] `flake.nix` with devShell (node, pnpm, postgres client, docker)
- [x] NixOS module: `services.sven` (enable, package, dataDir, configFile)
- [x] Module options for gateway bind, ports, and env overrides
- [x] Nix-based systemd unit (restart, limits, working dir)
- [x] Nix-based healthcheck (systemd `ExecStartPre` curl /healthz)
- [x] Documentation: `docs/deploy/nix.md` with minimal working example
- [x] Tests: nix flake eval + build derivation

### 39.2 SOUL.md Registry
- [x] Registry API (list/search/get/version metadata)
- [x] `sven souls list` CLI command (local + remote)
- [x] `sven souls install <slug>` CLI command
- [x] Admin UI: /souls page (browse, preview, install, activate)
- [x] Local cache of installed souls (versioned)
- [x] Signature verification (optional) + trust policy
- [x] Tests: install → activate → session uses new soul

### 39.3 Thinking Level Control
- [x] Per-message override: `/think <level>` applies to next reply only
- [x] Per-session default: `/think set <level>` persists
- [x] Levels: off | low | medium | high (mapped to model params)
- [x] Model mapping table (reasoning tokens / temperature / max tokens)
- [x] Admin UI toggle for default thinking level
- [x] Audit log includes thinking level used
- [x] Tests: per-message override resets after one response

### 39.4 Config File System
- [x] `~/.sven/sven.json` config file support (read on startup)
- [x] Merge precedence: env vars > config file > DB defaults
- [x] Config schema + validation (zod or jsonschema)
- [x] `sven config get/set/validate` CLI commands
- [x] `sven config print` shows resolved config (with redaction)
- [x] Full key reference documentation in `docs/config.md`
- [x] Tests: invalid config fails with actionable error

---

# ═══════════════════════════════════════════
# PHASE 4 — PARTIAL → FULL (v0.5.0+)
# ═══════════════════════════════════════════

> Upgrade features marked as "⚠️ Partial" to full parity.

---

## 40) Multi-Agent Routing (Upgrade from Partial)

> Current: Chat isolation + multi-tenant. Missing: Route channels/accounts/peers to isolated agent instances.

- [x] Agent workspace isolation (per-agent config + prompts)
- [x] Channel→Agent routing rules table
- [x] Per-account routing (same channel, different agents per user)
- [x] Admin UI: Agent routing configuration page
- [x] Tests: Two agents handle different channels independently

---

## 41) Full Onboarding Wizard (Upgrade from Partial)

> Current: Admin UI setup wizard. Missing: CLI-based interactive onboarding like `openclaw onboard`.

- [x] Fully interactive CLI wizard (via `sven wizard`)
- [x] Progress persistence (resume interrupted setup)
- [x] Daemon installation (systemd/launchd/PM2)
- [x] Post-setup verification (`sven doctor` automatically)
- [x] Config file generation with all settings
- [x] ALL will be present in a UI-based wizard as well (Admin UI: /wizard)
- [x] Tests: Full wizard flow end-to-end

---

## 42) Advanced Memory System (Upgrade from Partial)

> Current: memories table (user_private/chat_shared/global). Missing: Multi-store adapters + advanced retrieval.

- [x] Memory adapter abstraction (LibSQL / PostgreSQL / Redis / File)
- [x] Long-term memory extraction (automatic fact extraction from conversations)
- [x] Memory retrieval by relevance (semantic search over memories)
- [x] Memory consolidation (merge similar memories)
- [x] Memory decay (reduce weight of old memories over time)
- [x] Tests: Memory stored → retrieved by semantic similarity

---

## 43) Talk Mode Overlay (Upgrade from Partial)

> Current: Wake word + STT/TTS pipeline. Missing: Dedicated Talk Mode overlay UI.

- [x] Floating overlay UI for continuous voice conversation
- [x] Voice activity detection (auto-detect speech start/end)
- [x] Visual feedback (waveform/indicator while speaking)
- [x] Conversation transcript display in overlay
- [x] One-tap mute/unmute
- [x] Overlay available on macOS/iOS/Android apps
- [x] Tests: Voice conversation round-trip through overlay

---

## 44) Data Shaping in Workflows (Upgrade from Partial)

> Current: Conditional steps in workflows. Missing: `where`, `pick`, `head` operators like Lobster.

- [x] `where` operator (filter arrays by condition)
- [x] `pick` operator (select specific fields)
- [x] `head` / `tail` operators (first/last N items)
- [x] `sort` operator (sort by field)
- [x] `map` operator (transform each item)
- [x] `reduce` operator (aggregate values)
- [x] Operators chainable in workflow step definitions
- [x] Tests: Pipeline with filter → transform → output

---

# ═══════════════════════════════════════════
# FINAL VERIFICATION
# ═══════════════════════════════════════════

## Definition of Done — Full Parity

When all phases complete, verify:

- [x] **All ~176 OpenClaw features tracked** (125 matched/71%, 21 partial, 30 missing — see `Sven_vs_OpenClaw_Feature_Comparison.md` rev 3)
- [x] **All ~111 Agent Zero features tracked** (111 matched/100%, 0 partial, 0 missing — see `docs/parity/sven-vs-agent-zero-feature-comparison.md` rev 15)
- [x] **38 Sven-only advantages maintained** (no regressions)
- [x] **14+ channels supported** (match OpenClaw's 14)
- [x] **CLI parity** — `sven gateway/agent/send/wizard/doctor` all functional
- [x] **Chat commands** — `/status /reset /compact /think /verbose /usage /activation`
- [x] **Browser automation** — CDP-controlled Chromium with full tool suite
- [x] **MCP support** — both client and server modes
- [x] **Multi-agent** — routing + agent-to-agent coordination
- [x] **Native apps** — at least macOS menu bar companion
- [x] **Voice cloud** — ElevenLabs option alongside Piper local
- [x] **0 compilation errors** across all new code
- [x] **E2E tests** for every new section
- [x] **Sven_vs_OpenClaw_Feature_Comparison.md updated** — all items ✅ or ✅+

---

# ═══════════════════════════════════════════
# PRODUCTION STATE TRACK (START NOW)
# ═══════════════════════════════════════════

> This track runs in parallel with parity work. A feature is only counted as "done" when both parity and production gates pass.

## 45) Release Readiness Gates (for every parity feature)

### 45.1 Engineering Gate
- [x] TypeScript build clean (`pnpm -r typecheck` / `pnpm -r build`)
- [x] Lint clean for touched services
- [x] No TODO/FIXME left in changed production code
- [x] API contracts updated (OpenAPI/types/shared schemas)
- [x] Migration is forward-safe and rollback plan documented

### 45.2 Quality Gate
- [x] Unit tests added/updated for new logic
- [x] Integration tests added for API/tool boundaries
- [x] E2E path added for user-visible behavior
- [x] Replay harness scenario added for regression detection
- [x] Test evidence attached in PR notes

### 45.3 Security Gate
- [x] Threat model note added for new surface
- [x] Policy engine coverage verified (allow/deny/approval paths)
- [x] Audit log coverage verified for every write/action endpoint
- [x] Secrets and tokens handled via refs (no plaintext in code/config)
- [x] Egress constraints validated for new networked components

### 45.4 Operations Gate
- [x] Health endpoint added/updated
- [x] Metrics + alerts added (error rate, latency, saturation)
- [x] Dashboards updated for new component
- [x] Runbook added (`docs/runbooks/...`) with incident actions
- [x] Backpressure behavior defined for failure mode

### 45.5 Product Gate
- [x] Admin UI controls/visibility implemented if feature is operator-facing
- [x] Canvas/user UX path validated across supported channels
- [x] Documentation updated (setup, config, known limits)
- [x] Feature flag or staged rollout strategy defined
- [x] Rollback switch confirmed (config or release toggle)

---

## 46) v0.2.0 Production Sprint Plan (P0 Execution Order)

> Implement in this sequence to de-risk launch.

### 46.1 Sprint A — Browser Automation Foundation
- [x] Containerized Playwright service running behind policy gate
- [x] Allowlist + proxy + approval hooks enforced before any write action
- [x] Navigate/snapshot/get_text/click/type/fill/select/wait tools shipped
- [x] Browser E2E suite green on CI

### 46.2 Sprint B — Chat Commands + Compaction
- [x] Unified command parser merged (`/help /status /reset /compact /model /usage`)
- [x] Session settings persistence merged
- [x] Compaction service + token budget endpoints merged
- [x] Auto-compact threshold protection active

### 46.3 Sprint C — CLI Baseline
- [x] `sven --help/--version` and global install path validated
- [x] `gateway`, `agent --message`, `doctor`, `skills list/install` shipped
- [x] JSON output mode consistent across commands
- [x] CLI integration tests green (mock + live gateway)

### 46.4 v0.2.0 Exit Criteria
- [x] Sections 24–27 complete with passing E2E
- [x] No open P0 security findings
- [x] No open P0 reliability findings
- [ ] Release candidate runs 72h soak without Sev1/Sev2 incident
  Soak run started on February 13, 2026 at 03:26:27 UTC.
  Live status: `npm run release:soak:status` (`docs/release/status/soak-72h-summary.json`).

---

## 47) Parity Burn-down Tracker

> Keep this block updated each week.

- [x] Week 1 target: Section 24 browser service alpha
- [x] Week 2 target: Sections 26 + 27 merged behind flags
- [x] Week 3 target: Section 25 CLI beta + docs
- [ ] Week 4 target: v0.2.0 RC + soak + cut release
  Pending soak completion + CI workflow proofs (`final-dod-e2e`, `parity-e2e`) once git remote is configured.
- [x] Parity score updated in `Sven_vs_OpenClaw_Feature_Comparison.md`
- [x] Remaining gaps re-prioritized for v0.3.0

---

## 48) Production Sign-off Checklist (Before each release tag)
- [ ] `final-dod.e2e.ts` passes in CI
- [ ] New parity E2E suite passes in CI
- [ ] D9 Keycloak live OIDC interop gate passes in CI
- [ ] D9 Keycloak local selfcheck passes (`release:sso:keycloak:interop:selfcheck:local`)
  Local validation passed on February 13, 2026 via `npm run test:final-dod:local` and `npm run test:parity-e2e:local`.
  GitHub Actions validation passed on February 13, 2026 (`final-dod-e2e` run `21981040204`, `parity-e2e` run `21981040312`).
- [x] Migrations tested on a copy of production data
- [x] Backup restore drill completed for this release window
- [x] Security review sign-off recorded
- [x] Observability review sign-off recorded
- [x] Release notes include user-facing changes + rollback steps
- [ ] Post-release verification checklist completed (health, queue lag, error rate, approvals)
---

## 49) OpenClaw 2026 Delta (Surpass Track)

> Source audit date: February 13, 2026. These items extend beyond the original parity grid.

### 49.1 Plugin Migration Advantage
- [x] Add `sven plugins import-openclaw <manifest_url>` bridge command
- [x] Add `sven plugins validate` for policy/egress/scope checks
- [x] Add one-shot `import + quarantine + dry-run` flow

### 49.2 Voice Call Surface
- [x] Add provider-agnostic voice call adapter (Twilio/Telnyx/Plivo style)
- [x] Add call action policy scopes + approval pathways
- [x] Add call session timeline + recordings/transcript integration

### 49.3 Channel Breadth
- [x] Add LINE adapter parity path
- [x] Add adapter conformance tests + admin UI controls

### 49.4 Browser Relay
- [x] Add extension relay mode for existing user browser session
- [x] Add explicit risk controls (domain/session/permission guardrails)

---

*Created: February 2026*  
*Based on: Sven_vs_OpenClaw_Feature_Comparison.md*  
*Previous work: Sven_Master_Checklist.md (Sections 0–23, 100% complete)*
