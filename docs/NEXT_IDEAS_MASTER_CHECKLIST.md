# Sven — Next Ideas Master Implementation Checklist

> Generated: 2026-04-15
> Source: Video transcript research + architecture analysis
> Status: PLANNING PHASE — no code yet
> Private branch codename: **`argentum`** (Ag — element 47, Latin for silver)

---

## Table of Contents

1. [Epic A — LLM Council (Multi-Model Debate)](#epic-a--llm-council-multi-model-debate)
2. [Epic B — ASI-Evolve Integration (Self-Improving Research Loop)](#epic-b--asi-evolve-integration-self-improving-research-loop)
3. [Epic C — Persistent Memory System (Claude-Mem Style)](#epic-c--persistent-memory-system-claude-mem-style)
4. [Epic D — Animated Desktop Companion (Little Agents Style)](#epic-d--animated-desktop-companion-little-agents-style)
5. [Epic E — Programmatic Video Generation (Remotion)](#epic-e--programmatic-video-generation-remotion)
6. [Epic F — Skill Ecosystem Expansion (380+ Skills Parity)](#epic-f--skill-ecosystem-expansion-380-skills-parity)
7. [Epic G — Local Model Fleet (Qwen 3.5 + Open Models)](#epic-g--local-model-fleet-qwen-35--open-models)
8. [Epic H — MicroGPT / On-Device Training](#epic-h--microgpt--on-device-training)
9. [Epic I — Autonomous Infrastructure Management (Automaton Style)](#epic-i--autonomous-infrastructure-management-automaton-style)
10. [Dependency Map & Suggested Order](#dependency-map--suggested-order)

---

## Research Summary per Video

| Video | Key Project | License | Source | Sven Already Has | Gap |
|-------|-------------|---------|--------|-------------------|-----|
| V1 | Little Agents (animated macOS companion) | Unknown (not found on GH) | Concept only | Tauri Desktop app | No animated characters, no dock overlay |
| V2 | ASI-Evolve (GAIR-NLP) | Apache-2.0 | [github.com/GAIR-NLP/ASI-Evolve](https://github.com/GAIR-NLP/ASI-Evolve) | model-benchmark, self-code, self-heal | No closed-loop evolutionary research framework |
| V3 | Claude-Mem, Stitch 2.0, Dispatch | Various | Multiple | Memory architecture (BM25+vector+MMR) | No cross-session persistent memory compression, no UI gen from description |
| V4 | Claude Skills (marketing, email, images, video, token reduction) | MIT (agent-skills repo) | [github.com/michelve/agent-skills](https://github.com/michelve/agent-skills) | 14 skill categories, 50+ skills | Missing some marketing, email, video skills |
| V5 | LLM Council (Karpathy) | No license (provided "as-is") | [github.com/karpathy/llm-council](https://github.com/karpathy/llm-council) | model-router, model-benchmark, LiteLLM | No multi-model debate + peer review + chairman synthesis |
| V6 | Qwen 3.5 family | Apache-2.0 | [huggingface.co/Qwen](https://huggingface.co/collections/Qwen/qwen3-67dd247413f0e2e4f653967f) | LiteLLM proxy, model-router | Qwen models not yet deployed locally |
| V7 | Automaton (self-sustaining AI + Conway infra) | Not found on GH | Concept (Sigil Wen) | compute-mesh, self-code | No autonomous infrastructure management loop |
| V8 | MicroGPT / Micrograd (Karpathy) | MIT | [github.com/karpathy/micrograd](https://github.com/karpathy/micrograd) | None | No on-device micro-training capability |
| V9 | 380+ Agent Skills (michelve/agent-skills) | MIT | [github.com/michelve/agent-skills](https://github.com/michelve/agent-skills) | 14 skill categories | Need to audit overlap and port missing ones |

---

## Epic A — LLM Council (Multi-Model Debate)

**Source:** Video 5 — Karpathy's LLM Council
**Priority:** HIGH (core intelligence upgrade)
**Sven synergy:** Already has `model-router`, `model-benchmark`, `LiteLLM` proxy, `agent-spawner`

### Concept
Instead of routing to a single model, Sven sends important queries to multiple LLMs simultaneously, has them critique each other's responses anonymously, then a "chairman" model synthesizes the best answer.

### Architecture Decision
- **Do NOT fork** Karpathy's repo (no license, Python/FastAPI stack, provided "as-is")
- **Build natively** as a Sven skill + agent-runtime enhancement
- Leverage existing `LiteLLM` multi-provider proxy and `model-router` scoring

### Implementation Checklist

#### A.1 — Council Skill (new skill: `skills/ai-agency/llm-council/`)
- [x] A.1.1 — Create `SKILL.md` manifest with actions: `deliberate`, `configure_council`, `get_history`, `get_stats`
- [x] A.1.2 — Create `handler.ts` with council orchestration logic
- [x] A.1.3 — Define council configuration schema (models, chairman, anonymize, rounds)
- [x] A.1.4 — Implement Stage 1: **First Opinions** — parallel query to N configured models via LiteLLM
- [x] A.1.5 — Implement Stage 2: **Peer Review** — each model reviews anonymized responses, ranks by accuracy/insight
- [x] A.1.6 — Implement Stage 3: **Synthesis** — chairman model compiles final response from all inputs + rankings
- [x] A.1.7 — Implement scoring aggregation (weighted by peer review rankings)
- [x] A.1.8 — Implement cost tracking per council session (total tokens, cost by model)
- [x] A.1.9 — Add structured logging for each stage with trace context

#### A.2 — Agent Runtime Integration
- [x] A.2.1 — Add `council_mode` flag to agent configuration (per-agent opt-in)
- [x] A.2.2 — Add NATS subject `sven.council.deliberate.<sessionId>` for async council requests
- [x] A.2.3 — Add council result caching (same query within TTL returns cached consensus)
- [x] A.2.4 — Implement quality threshold trigger — auto-escalate to council when confidence is low

#### A.3 — Gateway API Routes
- [x] A.3.1 — `POST /api/council/deliberate` — submit a query for council deliberation
- [x] A.3.2 — `GET /api/council/sessions` — list past council sessions
- [x] A.3.3 — `GET /api/council/sessions/:id` — get full deliberation transcript
- [x] A.3.4 — `PUT /api/council/config` — update council configuration (admin only)

#### A.4 — Frontend (Canvas UI + Admin UI)
- [x] A.4.1 — Canvas UI: "Council Mode" toggle in chat settings
- [x] A.4.2 — Canvas UI: Council response view showing individual responses in tabs + peer reviews + final synthesis
- [x] A.4.3 — Admin UI: Council configuration page (model selection, chairman, rounds)
- [x] A.4.4 — Admin UI: Council analytics dashboard (cost, quality improvement, model performance)

#### A.5 — Flutter App
- [x] A.5.1 — Council mode toggle in mobile chat settings
- [x] A.5.2 — Council response accordion view (compact for mobile)

#### A.6 — Tests
- [x] A.6.1 — Unit tests for council orchestration logic (mock LiteLLM responses)
- [x] A.6.2 — Integration test: full 3-stage deliberation flow
- [x] A.6.3 — Test anonymization (model names stripped in peer review stage)
- [x] A.6.4 — Test cost tracking accuracy
- [x] A.6.5 — Test graceful degradation when one council member times out

---

## Epic B — ASI-Evolve Integration (Self-Improving Research Loop)

**Source:** Video 2 — GAIR-NLP/ASI-Evolve
**Priority:** HIGH (Sven's self-improvement engine)
**License:** Apache-2.0 ✅
**Sven synergy:** `self-code`, `self-heal-guide`, `model-benchmark`, `compute-mesh`

### Concept
Integrate ASI-Evolve's Learn → Design → Experiment → Analyze loop as Sven's self-improvement engine. Sven can autonomously evolve his own algorithms: routing policies, RAG retrieval, scheduling heuristics, etc.

### Architecture Decision
- **Port the ASI-Evolve core loop** to TypeScript (it's Python, ~500 LOC core)
- **Connect to Sven's existing**: cognition store → Sven's memory/RAG system, experiment DB → PostgreSQL, LLM calls → LiteLLM
- Use `compute-mesh` for parallel experiment execution

### Implementation Checklist

#### B.1 — Evolution Engine Module (`services/agent-runtime/src/evolution-engine.ts`)
- [x] B.1.1 — Create evolution engine module in agent-runtime (follows llm-council pattern)
- [x] B.1.2 — Port ASI-Evolve's 3-agent pipeline (Researcher, Engineer, Analyzer) to TypeScript
- [x] B.1.3 — Implement Cognition Store adapter (in-memory with DB migration for persistence)
- [x] B.1.4 — Implement Experiment Database (PostgreSQL tables: evolution_runs, evolution_nodes, evolution_cognition)
- [x] B.1.5 — Implement parent-node sampling algorithms (UCB1, greedy, random, MAP-Elites)
- [x] B.1.6 — Implement evaluator sandbox (Promise.race timeout, score clamping, error isolation)
- [x] B.1.7 — Implement evolution loop controller (step → evaluate → analyze → store → repeat)
- [x] B.1.8 — Add parallel worker support via compute-mesh jobs
- [x] B.1.9 — Add evolution run stats tracking (total runs, evaluations, best scores, averages)

#### B.2 — Evolution Skill (`skills/ai-agency/evolution-engine/`)
- [x] B.2.1 — Create `SKILL.md` with actions: `start_evolution`, `stop_evolution`, `get_run`, `list_runs`, `get_best`, `inject_knowledge`, `list_templates`, `get_stats`
- [x] B.2.2 — Create `handler.ts` that dispatches to evolution-engine module (8 actions)
- [x] B.2.3 — Define experiment template schema (problem description, evaluator, baseline, cognition seeds)

#### B.3 — Pre-Built Evolution Experiments
- [x] B.3.1 — **RAG Retrieval Evolution** — evolve scoring/fusion weights, eval = retrieval accuracy on test set
- [x] B.3.2 — **Model Routing Evolution** — evolve routing heuristics, eval = quality + latency + cost
- [x] B.3.3 — **Prompt Engineering Evolution** — evolve system prompts, eval = task completion accuracy
- [x] B.3.4 — **Scheduling Evolution** — evolve workflow-executor scheduling policies, eval = throughput

#### B.4 — DB Migrations
- [x] B.4.1 — `evolution_runs` table (id, org_id, user_id, experiment, config, status, current_gen, best_node_id, best_score, total_evals, error, timestamps)
- [x] B.4.2 — `evolution_nodes` table (id, run_id, parent_id, generation, code, score, metrics, analysis, visits, created_at)
- [x] B.4.3 — `evolution_cognition` table (id, run_id, title, content, source, relevance, embedding vector(1536), created_at)

#### B.5 — Frontend
- [x] B.5.1 — Admin UI: Evolution dashboard (active runs, leaderboard, generation tree visualization)
- [x] B.5.2 — Admin UI: Create experiment wizard (problem → evaluator → baseline → cognition → launch)
- [x] B.5.3 — Admin UI: Run detail view (generation graph, best candidates, analysis logs)

#### B.6 — Tests (42 tests passing)
- [x] B.6.1 — Unit test: cognition store retrieval + researcher/analyzer feedback loop
- [x] B.6.2 — Unit test: parent sampling algorithms (UCB1, greedy, random, MAP-Elites — 14 tests)
- [x] B.6.3 — Integration test: full evolution loop (N generations, mock evaluator — 4 tests)
- [x] B.6.4 — Unit test: evaluator isolation (error handling, timeout, score clamping — 4 tests)
- [x] B.6.5 — Unit test: lifecycle (start/stop/list/stats/inject knowledge — 12 tests)

---

## Epic C — Persistent Memory System (Claude-Mem Style)

**Source:** Video 3 — "Claudia Mem" plugin concept
**Priority:** HIGH (token efficiency, continuity)
**Sven synergy:** Already has BM25 + pgvector + MMR memory, temporal decay

### Concept
Enhance Sven's existing memory to add:
1. **Cross-session persistent memory compression** — summarize and compress long conversation histories into reusable memory nodes
2. **Proactive memory injection** — auto-retrieve relevant memories before agent processes query
3. **Memory importance scoring** — not all memories are equal; prioritize by access frequency, recency, and explicit user bookmarks
4. **Token budget management** — dynamically compress context to stay within token limits while retaining maximum information

### Architecture Decision
- **Extend existing** `rag-indexer` and `agent-runtime` memory pipeline — NOT a new service
- Sven already has the best memory architecture in the space; this is about making it smarter

### Implementation Checklist

#### C.1 — Memory Compression Engine (in `services/agent-runtime/`)
- [x] C.1.1 — Implement conversation summarizer (end-of-session → compressed memory node)
- [x] C.1.2 — Implement progressive summarization (hierarchical: messages → paragraphs → bullets → tags)
- [x] C.1.3 — Implement memory importance scoring: `score = access_frequency × recency_decay × user_boost × relevance`
- [x] C.1.4 — Implement token budget allocator: given N tokens, select optimal memory set via knapsack algorithm
- [x] C.1.5 — Implement memory deduplication (detect near-duplicate memories, merge into canonical)

#### C.2 — Proactive Memory Retrieval
- [x] C.2.1 — Pre-query memory scan: before LLM call, retrieve top-K memories relevant to the conversation context
- [x] C.2.2 — Implement "memory priming" — inject retrieved memories as system context, not user messages
- [x] C.2.3 — Implement memory-aware prompt template that includes `[MEMORIES]` section with dynamic content
- [x] C.2.4 — Track memory hit rate (% of retrieved memories actually used in response)

#### C.3 — User Memory Controls
- [x] C.3.1 — "Remember this" command — user explicitly bookmarks a fact/preference
- [x] C.3.2 — "Forget this" command — user requests memory deletion (GDPR compliant)
- [x] C.3.3 — Memory browser UI — view, edit, delete stored memories
- [x] C.3.4 — Memory export (JSON/CSV) for data portability

#### C.4 — DB Migrations
- [x] C.4.1 — Add `importance_score`, `access_count`, `last_accessed`, `compression_level` to memory table
- [x] C.4.2 — Add `memory_summaries` table for compressed session summaries
- [x] C.4.3 — Add memory usage analytics table (token savings tracking)

#### C.5 — Frontend
- [x] C.5.1 — Canvas UI: Memory indicator (shows when memories are active in conversation)
- [x] C.5.2 — Canvas UI: "Remember this" / "Forget this" quick actions
- [x] C.5.3 — Admin UI: Memory analytics dashboard (token savings, memory hit rate, storage usage)
- [x] C.5.4 — Admin UI: Memory management (browse, search, bulk operations)

#### C.6 — Tests
- [x] C.6.1 — Unit test: progressive summarization quality
- [x] C.6.2 — Unit test: token budget allocation optimality
- [x] C.6.3 — Integration test: cross-session memory retrieval
- [x] C.6.4 — Test GDPR compliance: forget command purges all storage layers

---

## Epic D — Animated Desktop Companion (Little Agents Style)

**Source:** Video 1 — Little Agents macOS app
**Priority:** MEDIUM (UX delight, brand identity)
**Sven synergy:** Tauri Desktop app already exists

### Concept
Add animated Sven character(s) to the Tauri desktop app. Characters walk across the screen, show thought bubbles when processing, celebrate on task completion, and clicking them opens the Sven terminal/chat.

### Architecture Decision
- **Extend Tauri app** (`apps/companion-desktop-tauri/`) — NOT a separate app
- Use Lottie/Rive animations for the characters (lightweight, scalable)
- System tray integration + dock overlay for always-visible characters

### Implementation Checklist

#### D.1 — Character Design & Animation
- [x] D.1.1 — Design Sven character sprite sheet (idle, walking, thinking, celebrating, sleeping)
- [x] D.1.2 — Create Lottie/Rive animation files for each state
- [x] D.1.3 — Design thought bubble animation (typing indicator, progress dots)
- [x] D.1.4 — Design celebration animation (confetti, sound effects)
- [x] D.1.5 — Design "Sven is working" animation (coding/terminal visual)

#### D.2 — Tauri Integration
- [x] D.2.1 — Create always-on-top transparent overlay window for character rendering
- [x] D.2.2 — Implement character walk cycle (left-right movement above dock/taskbar)
- [x] D.2.3 — Implement click interaction (click character → open Sven chat panel)
- [x] D.2.4 — Implement state machine: idle → thinking (when query sent) → celebrating (when task done)
- [x] D.2.5 — Connect to gateway API WebSocket for real-time agent state updates
- [x] D.2.6 — Add system tray menu (show/hide character, settings, quick commands)
- [x] D.2.7 — Implement mini-terminal popup (click → quick command input without full app)

#### D.3 — Cross-Platform
- [x] D.3.1 — macOS: dock overlay positioning
- [x] D.3.2 — Windows: taskbar overlay positioning
- [x] D.3.3 — Linux: panel overlay positioning
- [x] D.3.4 — Respect system DPI/scaling for crisp rendering

#### D.4 — Sound Effects
- [x] D.4.1 — Task complete sound (short, pleasant chime)
- [x] D.4.2 — Error sound (subtle alert)
- [x] D.4.3 — User preference: mute / low / normal volume
- [x] D.4.4 — Custom sound pack support

#### D.5 — Tests
- [x] D.5.1 — Test character state transitions (73 tests)
- [x] D.5.2 — Test transparent window overlay on each OS
- [x] D.5.3 — Test WebSocket connection state sync

---

## Epic E — Programmatic Video Generation (Remotion)

**Source:** Video 4 — Remotion skill
**Priority:** MEDIUM (content creation capability)
**License:** Special license (company license required for commercial use)
**Sven synergy:** `skills/design/motion-design/`, notification system

### Concept
Give Sven the ability to create videos programmatically — marketing videos, data visualization videos, social media content, tutorial videos — using React-based video generation.

### Architecture Decision
- **License check required**: Remotion requires a company license for commercial use. Evaluate cost.
- **Alternative**: Consider `ffmpeg` + Canvas-based rendering if Remotion license is prohibitive
- Implement as a skill that generates Remotion project code + renders to MP4

### Implementation Checklist

#### E.1 — Video Generation Engine (`services/agent-runtime/src/video-engine.ts`)
- [x] E.1.1 — **License decision**: ffmpeg-based rendering (no Remotion license needed, ffmpeg already checked by `sven doctor`)
- [x] E.1.2 — Create `SKILL.md` with actions: `create_video`, `list_templates`, `render`, `get_status`, `cancel`, `preview`, `get_stats`
- [x] E.1.3 — Create `handler.ts` with video generation orchestration (7 actions)
- [x] E.1.4 — Implement template system (social_media, data_dashboard, product_showcase, tutorial, brand)
- [x] E.1.5 — Implement text-to-video-spec pipeline (natural language → LLM → VideoSpec JSON → render)
- [x] E.1.6 — Implement render queue (in-memory async with status tracking, 100 cap LRU)
- [x] E.1.7 — Implement asset management (image overlays, audio tracks with fade in/out)

#### E.2 — Pre-Built Templates
- [x] E.2.1 — Social media post template (9:16 vertical, hook → body → CTA)
- [x] E.2.2 — Data dashboard animation template (16:9, metrics + title + closing)
- [x] E.2.3 — Product showcase template (16:9, intro → features → CTA)
- [x] E.2.4 — Tutorial/walkthrough template (16:9, numbered steps)
#### E.3 — Frontend
- [x] E.3.1 — Canvas UI: "Create Video" command
- [x] E.3.2 — Canvas UI: Video preview player
- [x] E.3.3 — Admin UI: Video template manager
- [x] E.3.4 — Admin UI: Render queue monitor

#### E.4 — Tests (57 tests passing)
- [x] E.4.1 — Unit test: template composition, scene creation, element builders (18 tests)
- [x] E.4.2 — Unit test: ffmpeg command building (text filters, image overlays, transitions, args, preview — 14 tests)
- [x] E.4.3 — Unit test: render execution, job lifecycle, stats, validation, NL-to-spec pipeline (25 tests)

---

## Epic F — Skill Ecosystem Expansion (380+ Skills Parity)

**Source:** Video 4 + Video 9 — Claude Skills + Agent Skills library
**Priority:** HIGH (capability breadth)
**License:** MIT (agent-skills repo)
**Sven synergy:** Sven already has 50+ skills across 14 categories

### Concept
Audit the 380+ skills from michelve/agent-skills and port/adapt the most valuable ones that Sven doesn't have yet. Focus on official team skills (Vercel, Cloudflare, Stripe, Google, etc.) and high-impact community skills.

### Architecture Decision
- **Do NOT copy-paste** — adapt each skill to Sven's handler.ts + SKILL.md pattern
- Prioritize skills that integrate with Sven's existing infrastructure
- Skip skills that are specific to other platforms (e.g., Cursor-specific, Vercel-deploy-specific)

### Gap Analysis (What Sven Needs)

| Category | Sven Has | Missing from 380+ Library |
|----------|----------|---------------------------|
| Marketing | 9 skills (analytics, brand-voice, campaign, etc.) | SEO optimizer, A/B test copy, social media scheduler |
| Email | ❌ None | Email composer, email automation, reply assistant |
| Document Creation | ❌ None | DOCX, PPTX, XLSX, PDF creation/editing |
| Web Testing | ❌ None | Playwright-based webapp testing |
| Frontend Design | 5 design skills | UI/UX from description (Stitch-like), React best practices |
| DevOps/Infra | ❌ None | Terraform, Cloudflare Workers, Docker optimization |
| Database | ❌ None | PostgreSQL best practices, query optimization |
| Security Audit | 1 skill | Trail of Bits security patterns, dependency scanning |
| Data/Analytics | ❌ None | ClickHouse, Tinybird, data pipeline best practices |
| Content Engineering | ❌ None | Token reduction, context optimization, prompt compression |

### Implementation Checklist

#### F.1 — Priority 1: Document Creation Skills
- [x] F.1.1 — `skills/productivity/docx-generator/` — Create/edit Word documents
- [x] F.1.2 — `skills/productivity/xlsx-generator/` — Create/edit Excel spreadsheets
- [x] F.1.3 — `skills/productivity/pptx-generator/` — Create/edit PowerPoint presentations
- [x] F.1.4 — `skills/productivity/pdf-generator/` — Create/edit PDFs

#### F.2 — Priority 2: Email Skills
- [x] F.2.1 — `skills/email-generic/email-composer/` — Draft emails from context
- [x] F.2.2 — `skills/email-generic/email-reply/` — Generate contextual email replies
- [x] F.2.3 — `skills/email-generic/email-automation/` — Scheduled email workflows

#### F.3 — Priority 3: Content Engineering & Token Optimization
- [x] F.3.1 — `skills/ai-agency/context-engineer/` — Optimize prompts to reduce token usage
- [x] F.3.2 — `skills/ai-agency/prompt-compressor/` — Compress long contexts while preserving information

#### F.4 — Priority 4: Web Testing
- [x] F.4.1 — `skills/security/webapp-tester/` — Playwright-based automated web testing

#### F.5 — Priority 5: Infrastructure Skills
- [x] F.5.1 — `skills/compute-mesh/docker-optimizer/` — Optimize Dockerfiles, layer caching
- [x] F.5.2 — `skills/compute-mesh/db-query-optimizer/` — PostgreSQL EXPLAIN ANALYZE advisor

#### F.6 — Priority 6: Additional Marketing Skills
- [x] F.6.1 — `skills/marketing/seo-optimizer/` — SEO analysis and optimization
- [x] F.6.2 — `skills/marketing/social-scheduler/` — Social media content scheduling
- [x] F.6.3 — `skills/marketing/ab-copywriter/` — A/B test copywriting variants

#### F.7 — Tests (for each new skill)
- [x] F.7.1 — Unit test per skill handler
- [x] F.7.2 — Integration test for document generation (verify output format)
- [x] F.7.3 — Integration test for email skills (verify MIME format)

---

## Epic G — Local Model Fleet (Qwen 3.5 + Open Models)

**Source:** Video 6 — Qwen 3.5 family
**Priority:** HIGH (cost reduction, sovereignty, speed)
**License:** Apache-2.0 ✅
**Sven synergy:** `LiteLLM` proxy, `model-router`, `model-benchmark`, `compute-mesh`

### Concept
Deploy Qwen 3.5 models locally to run alongside cloud models. Sven's model-router already handles routing — this epic adds local model deployment and management.

### Hardware Assessment ✅ RESOLVED

**Available GPU cluster: ~40 GiB total VRAM (all AMD except VM13)**

| Node | GPU(s) | VRAM | Target Model |
|------|--------|------|--------------|
| VM5/VM9 | RX 9070 XT + RX 6750 XT | 28 GiB | **Qwen3-32B Q4_K_M** (~18 GiB) via tensor-split — flagship |
| VM13 | RTX 3060 | 12 GiB | **Qwen3-8B FP8** (~6 GiB) — fast workhorse |
| S24 Ultra | Adreno 750 | ~4 GiB | **Qwen3-4B Q4** (~2 GiB) on-device |

### Implementation Checklist

#### G.1 — Local Model Runtime
- [x] G.1.1 — Choose inference engine: **llama.cpp** (already deployed on VM5 with HIP/ROCm) or **Ollama** (already on VM13) or **vLLM** (ROCm support improving)
- [x] G.1.2 — Create Docker service configuration for local model serving
- [x] G.1.3 — Configure LiteLLM to route to local model endpoints
- [x] G.1.4 — Download and quantize Qwen3 models suitable for available hardware

#### G.2 — Model Management Skill Enhancement
- [x] G.2.1 — Extend `model-router` to prefer local models when latency/quality acceptable
- [x] G.2.2 — Extend `model-benchmark` to benchmark local vs. cloud models automatically
- [x] G.2.3 — Add VRAM monitoring integration (real-time GPU memory tracking)
- [x] G.2.4 — Add model hot-swap (load/unload models based on demand)

#### G.3 — Model Download & Deployment Pipeline
- [x] G.3.1 — Create model download script (HuggingFace Hub → local cache)
- [x] G.3.2 — Create auto-quantization pipeline (FP16 → FP8/INT4 based on available VRAM)
- [x] G.3.3 — Add model health check endpoint
- [x] G.3.4 — Add model performance profiling (tokens/sec, time-to-first-token)

#### G.4 — Admin UI
- [x] G.4.1 — Local model management page (available models, loaded models, VRAM usage)
- [x] G.4.2 — One-click model download + deploy
- [x] G.4.3 — Model benchmark comparison charts (local vs. cloud)
- [x] G.4.4 — Cost savings dashboard (local inference vs. cloud API costs)

#### G.5 — docker-compose Integration
- [x] G.5.1 — Add local model service to docker-compose profiles
- [x] G.5.2 — Add GPU passthrough configuration (ROCm for AMD on VM5, NVIDIA runtime for VM13)
- [x] G.5.3 — Add model volume mounts for persistent storage

#### G.6 — Tests
- [x] G.6.1 — Health check test for local model endpoint
- [x] G.6.2 — Benchmark test: local model latency and throughput
- [x] G.6.3 — Routing test: model-router correctly prefers local when applicable
- [x] G.6.4 — Failover test: falls back to cloud when local model is down

---

## Epic H — MicroGPT / On-Device Training

**Source:** Video 8 — Karpathy's MicroGPT / Micrograd
**Priority:** LOW (educational + niche, minimal production value)
**License:** MIT ✅
**Sven synergy:** `compute-mesh`, `model-benchmark`

### Concept
Implement a minimal GPT training capability within Sven for fine-tuning small models on domain-specific data. Not for replacing frontier models — for learning and lightweight task-specific adaptation.

### Architecture Decision
- Karpathy's actual "microGPT" video project is more educational than production-ready
- The real value is **fine-tuning small open models** (Qwen3-4B) on Sven's domain data
- Use existing PyTorch/HuggingFace training stack, not a from-scratch implementation

### Implementation Checklist

#### H.1 — Fine-Tuning Pipeline
- [x] H.1.1 — Create `skills/ai-agency/model-trainer/` skill
- [x] H.1.2 — Implement LoRA/QLoRA fine-tuning wrapper (HuggingFace + PEFT)
- [x] H.1.3 — Implement training data preparation pipeline (conversation logs → training format)
- [x] H.1.4 — Implement evaluation pipeline (pre/post training benchmark comparison)
- [x] H.1.5 — Implement model export + integration with LiteLLM
- [x] H.1.6 — Add training job scheduling via compute-mesh

#### H.2 — Pre-Built Fine-Tuning Recipes
- [x] H.2.1 — Recipe: Fine-tune on user's writing style (for email/message drafting)
- [x] H.2.2 — Recipe: Fine-tune on codebase conventions (for code generation)
- [x] H.2.3 — Recipe: Fine-tune on domain vocabulary (for specialized knowledge)

#### H.3 — Micrograd Educational Module (Optional)
- [x] H.3.1 — Port Karpathy's micrograd to a Sven educational skill
- [x] H.3.2 — Interactive notebook-style walkthrough of how neural networks learn
- [x] H.3.3 — Connect to Canvas UI for visual training progression display

#### H.4 — Tests
- [x] H.4.1 — Test training pipeline with tiny dataset (52 tests)
- [x] H.4.2 — Test model export format compatibility with LiteLLM
- [x] H.4.3 — Test evaluation pipeline produces valid metrics

---

## Epic I — Autonomous Infrastructure Management (Automaton Style)

**Source:** Video 7 — Automaton (Sigil Wen), Conway infrastructure
**Priority:** HIGH (Sven's autonomous operations vision)
**Sven synergy:** compute-mesh, self-code, sven.systems, the47network.com

### Concept
Sven becomes self-managing by:
1. **Deploying services** — product building and service delivery on owned infrastructure
2. **Managing infrastructure** — auto-scaling, upgrades, health monitoring
3. **Using owned infrastructure** (sven.systems, the47network.com) — NOT external servers
4. **Growing together** with the user as a partnership

### Critical Architecture Decisions
- **Use existing infrastructure**: sven.systems + the47network.com — NOT Conway/external
- **Revenue sources**: SaaS services, freelance coding, product deployment
- **Human oversight**: User retains approval authority on major decisions

### Implementation Checklist

#### I.1 — Service Delivery Pipelines
- [x] I.1.1 — **Service Marketplace** — Sven deploys skills as paid API endpoints on sven.systems
- [x] I.1.2 — **Product Deployment** — Sven builds and deploys web apps/tools, charges users
- [x] I.1.3 — **Content Creation** — Blog posts, social media, video content (connect to Epic E)

#### I.2 — Infrastructure Self-Management
- [x] I.2.1 — Extend `compute-mesh` to manage sven.systems servers
- [x] I.2.2 — Implement infrastructure cost monitoring (hosting, bandwidth, compute)
- [x] I.2.3 — Implement auto-scaling decisions (when to add capacity based on demand)
- [x] I.2.4 — Implement infrastructure upgrade proposals (Sven proposes, user approves)
- [x] I.2.5 — Implement deployment to the47network.com for public-facing services

#### I.3 — Autonomous Decision Engine
- [x] I.3.1 — Implement ROI calculator for infrastructure investments
- [x] I.3.2 — Implement risk assessment for each activity
- [x] I.3.3 — Implement approval tiers: auto (< $X), notify ($X-$Y), require approval (> $Y)
- [x] I.3.4 — Implement daily/weekly summary reports to user
- [x] I.3.5 — Implement goal tracking (infrastructure goals, service uptime targets)

#### I.4 — Transparency Dashboard
- [x] I.4.1 — Admin UI: Infrastructure status (servers, capacity, costs)
- [x] I.4.2 — Admin UI: Investment proposals (pending approval, approved, completed)

#### I.5 — Security & Compliance
- [x] I.5.1 — All infrastructure operations audit-logged (immutable)
- [x] I.5.2 — Rate limits on autonomous operations
- [x] I.5.3 — Emergency stop: user can freeze all autonomous activity instantly

#### I.6 — Tests
- [x] I.6.1 — Unit test: approval threshold logic
- [x] I.6.2 — Integration test: service deployment pipeline
- [x] I.6.3 — Test emergency stop functionality

---

## Dependency Map & Suggested Order

```
Phase 1 — Foundation (do these first, they enable everything else)
├── Epic A: LLM Council          [2-3 weeks] — upgrades all AI output quality
├── Epic C: Persistent Memory    [1-2 weeks] — reduces token costs, improves continuity  
└── Epic G: Local Model Fleet    [1 week]    — reduces API costs, enables sovereignty

Phase 2 — Intelligence (build on Phase 1)
├── Epic B: ASI-Evolve           [3-4 weeks] — self-improvement (uses Council + Local Models)
└── Epic F: Skills Expansion     [2-3 weeks] — breadth of capabilities (uses Memory)

Phase 3 — Autonomous Ops & Growth (build on Phase 1+2)
├── Epic I: Infrastructure Mgmt  [4-6 weeks] — autonomous operations (uses all above)
└── Epic E: Video Generation     [1-2 weeks] — content creation

Phase 4 — Delight & Education
├── Epic D: Desktop Companion    [2-3 weeks] — UX/brand (independent)
└── Epic H: MicroGPT/Training   [1-2 weeks] — fine-tuning (uses G local models)
```

### Critical Path
```
G (Local Models) → A (Council uses local models) → B (ASI-Evolve uses Council)
                                                  → I (Infrastructure Mgmt uses all above)
C (Memory) → F (Skills use improved memory)
```

### Quick Wins (can start immediately, independent of others)
1. **Epic C.3.1** — "Remember this" command (small, high-impact)
2. **Epic F.1** — Document creation skills (docx, xlsx, pptx — useful immediately)
3. **Epic G.1.1** — Choose inference engine (decision unlocks entire Epic G)
4. **Epic A.1** — LLM Council skill (self-contained, immediate quality boost)

---

## Resolved Decisions

> All 7 open questions resolved 2026-04-15. Decisions documented below.

### Decision 1 — GPU Inventory ✅

**Source:** `deploy/multi-vm/docker-compose.vm5-ai.yml` + `deploy/multi-vm/RUNBOOK.md` + `skills/ai-agency/self-knowledge/handler.ts`

| Node | GPU(s) | VRAM | Arch | Role | Status |
|------|--------|------|------|------|--------|
| VM5/VM9 (sven-ai) | AMD RX 9070 XT + AMD RX 6750 XT | 15.9 + 12 = **28 GiB** | RDNA4 (gfx1201) + RDNA2 (gfx1031) | Primary AI inference — llama-server tensor-split across both GPUs | Running qwen2.5-coder:32b (Q4_K_M, 18.5 GiB) |
| VM13 (kaldorei) | NVIDIA RTX 3060 | **12 GiB** | Ampere (sm_86) | Fast inference — Ollama | Running qwen2.5:7b |
| S24 Ultra Mobile | Adreno 750 | ~4 GiB | Mobile | On-device mobile inference | Available |
| **Total cluster** | — | **~40 GiB** | — | — | — |

**Notes:**
- VM5 IP: 10.47.47.9, llama-server on port 8080 (OpenAI compat), Ollama optional on 11434/11435
- VM13 IP: 10.47.47.13, Ollama on port 11434
- ROCm required for AMD GPUs; vendor-reset DKMS module for RX 6750 XT PSP mode1 reset
- Ollama and llama-server compete for VRAM on VM5 — do NOT run both simultaneously

**Qwen model allocation:**
- **RX 9070 XT + RX 6750 XT (VM5, 28 GiB combined)**: Qwen3-32B Q4_K_M (~18 GiB) via tensor-split — flagship. Or Qwen3-30B-A3B MoE for coding.
- **RTX 3060 (VM13, 12 GiB)**: Qwen3-8B FP8 (~6 GiB) — fast inference workhorse, upgrade from current qwen2.5:7b. Or Qwen3-14B Q4 (~8 GiB) if quantized.
- **S24 Ultra (4 GiB)**: Qwen3-4B Q4 (~2 GiB) for on-device inference via NNAPI/QNN

### Decision 2 — Video Generation (Remotion Alternative) ✅

**Decision:** Use free tooling now, Remotion later if needed.
- **Phase 1:** ffmpeg + Canvas API + Puppeteer for programmatic video generation
- **Phase 2:** Google Wisk + Google Flow (user has Google Pro subscription)
- **Phase 3:** Remotion Company License ($500/yr) — evaluate when budget allows
- **Rationale:** Zero upfront cost. ffmpeg is production-grade for composition. Google Pro tools cover UI/prototyping.

### Decision 3 — Server Infrastructure ✅

**Source:** Compute mesh device registry + docker-compose configs + nginx deploy configs.

| Host | IP | Role | Specs |
|------|-----|------|-------|
| VM4 (Platform) | 10.47.47.8 | Sven platform — PG, NATS, gateway, agents, nginx | 12–16 cores, 16–32 GB RAM, 200–500 GB NVMe |
| VM5/VM9 (AI & Voice) | 10.47.47.9 | Primary AI inference — llama-server, LiteLLM, voice | 12–16 cores, 32–64 GB RAM, **AMD RX 9070 XT (16 GiB) + AMD RX 6750 XT (12 GiB)** |
| VM6 (Data & Obs.) | 10.47.47.10 | OpenSearch, RAG, SearXNG, OTEL, Prometheus, Grafana, Loki | 12–16 cores, 16–32 GB RAM, 500 GB–1 TB NVMe |
| VM7 (Adapters) | 10.47.47.11 | 20+ channel adapters, Cloudflared | 8 cores, 16 GB RAM, 50–100 GB SSD |
| VM12 | 10.47.47.12 | Rocket.Chat (talk.sven.systems) | — |
| VM13 (kaldorei) | 10.47.47.13 | GPU fallback — Ollama fast inference | 8 cores, 32 GB RAM, **NVIDIA RTX 3060 (12 GiB)** |
| VM14 (Daedalus) | 10.47.47.14 | 47network website | — |

**Network:** WireGuard mesh, 10.47.47.0/24 subnet, trusted proxy range.

### Decision 4 — Phase Execution Order ✅

**Decision:** Modified execution order — start autonomous infrastructure (Epic I) earlier.

```
Phase 1 — Sovereignty & Foundation [Weeks 1-3]
├── Epic G: Local Model Fleet      [Week 1]     — hardware ready, deploy immediately
├── Epic C: Persistent Memory      [Week 2]     — reduces costs, improves context
└── Epic A: LLM Council            [Weeks 2-3]  — quality upgrade using local models

Phase 2 — Autonomous Ops [Weeks 3-8, parallel with Phase 1 tail]
├── Epic I: Infrastructure Mgmt    [Weeks 3-8]  — autonomous operations
│   ├── I.1: Service Delivery [Weeks 3-4]
│   ├── I.2-I.3: Infra + Decisions [Weeks 5-6]
│   └── I.4-I.6: Dashboard + Security [Weeks 7-8]
└── Epic F: Skills Expansion        [Weeks 4-6] — more capabilities

Phase 3 — Intelligence & Growth [Weeks 8-12]
├── Epic B: ASI-Evolve              [Weeks 8-11] — self-improvement loop
└── Epic E: Video Generation        [Weeks 10-11] — content creation

Phase 4 — Delight [Weeks 12-15]
├── Epic D: Desktop Companion       [Weeks 12-14]
└── Epic H: MicroGPT/Training      [Weeks 13-15]
```

**Rationale:** Epic G first because the hardware is sitting idle. Epic I promoted to Phase 2 (from Phase 3) to enable autonomous infrastructure management early.

---

## Total Scope Estimate

| Epic | Checklist Items | New Files (est.) | New DB Migrations |
|------|----------------|-------------------|-------------------|
| A — LLM Council | 20 | ~10 | 1 |
| B — ASI-Evolve | 20 | ~15 | 3 |
| C — Persistent Memory | 16 | ~8 | 3 |
| D — Desktop Companion | 16 | ~12 | 0 |
| E — Video Generation | 14 | ~10 | 1 |
| F — Skills Expansion | 18 | ~30+ | 0 |
| G — Local Models | 17 | ~8 | 1 |
| H — MicroGPT | 10 | ~6 | 1 |
| I — Infrastructure Mgmt | 17 | ~12 | 1 |
| **TOTAL** | **131** | **~99** | **~10** |

---

*This checklist is a living document. Update as decisions are made and implementation progresses.*
