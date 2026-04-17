# Pillar 2 — Multi-Model & AI Agency

> Source: Videos 2 (AI News Roundup), 3 (MIMO V2 Pro), 11 (AirLLM)
> User directives:
> - "From here I want as many as we can and able to"
> - "Find all we can about it and if we can install it/make it available to Sven"
> - "Can't we make Sven able to send processing stuff to all the devices he has access to"

---

## Goal

Sven breaks free from single-model dependency. He routes inference across multiple local and remote models, hosts open-weight models on-premise, and runs specialized models for specific tasks. He can spin up 120+ autonomous sub-agents for parallel work — an "AI workforce."

---

## Feature Breakdown

### 2.1 Model Router Service

**What**: A new service that routes inference requests to the optimal model based on task type, latency requirements, cost, and availability.

**Models to Support**:
| Model | Size | Purpose | Where |
|-------|------|---------|-------|
| Gemma 4 | Various | General reasoning (already integrated) | VM5 |
| Nemotron 3 Super | 120B | Complex reasoning, analysis | VM5 (quantized) |
| Qwen 3.5 | Various | Multilingual, coding, vision | VM5 |
| MIMO V2 Pro | TBD | Xiaomi's multimodal (vision + text) | VM5 |
| GLM-OCR | 0.9B | Document OCR (see Pillar 3) | VM5 or edge |
| Kronos | TBD | Financial time-series (see Pillar 6) | VM5 |
| Local small models | 1-7B | Fast responses, device-side inference | Edge devices |

**Capabilities**:
- [ ] Model registry (name, size, quantization, VRAM requirement, supported tasks)
- [ ] Task classification (reasoning, coding, vision, OCR, translation, summarization, financial)
- [ ] Routing logic (match task → best available model by quality/latency/cost)
- [ ] Failover (if primary model OOM or slow, fall back to secondary)
- [ ] Load balancing across GPU instances (VM5, VM13, edge devices)
- [ ] Model warm/cold management (preload frequently used, evict idle models)
- [ ] Quantization awareness (GGUF, GPTQ, AWQ, INT4/INT8 selection)
- [ ] Context window management (auto-split for models with smaller context)
- [ ] Streaming responses with model identification headers
- [ ] Telemetry: tokens/sec, latency p50/p95/p99, model utilization per GPU

**Implementation**:
- New service: `services/model-router/`
- Stack: Node.js/TypeScript, gRPC for inter-service, REST for admin
- Backend runners: llama.cpp, vLLM, or Ollama (whichever is already in use)
- Config: model manifests in YAML, hot-reloadable

### 2.2 Local Model Hosting

**What**: Download, configure, and serve open-weight models locally on Sven's infrastructure.

**Capabilities**:
- [ ] Model download manager (HuggingFace Hub, direct URLs, integrity verification)
- [ ] GGUF/GPTQ/AWQ quantization selection per model
- [ ] VRAM budget management (track available VRAM, prevent OOM)
- [ ] Auto-offload layers to CPU/RAM when VRAM insufficient
- [ ] Model versioning (keep previous versions, rollback mechanism)
- [ ] Health checks per loaded model (inference test, latency baseline)
- [ ] Admin UI panel: model catalog, download status, VRAM usage, inference stats
- [ ] Scheduled model updates (check HuggingFace for new versions weekly)
- [ ] License compliance tracking (model license type, usage restrictions)
- [ ] Disk space management for model weights (auto-prune unused models)

**Implementation**:
- Directory: `models/` at repo root for weight storage
- Download orchestrator in model-router service
- Integration with Ollama (if already used) or direct llama.cpp server

### 2.3 Agency System (120+ Autonomous Agents)

**What**: Sven can spin up specialized sub-agents that work in parallel. Inspired by "Agency Agents" — 120+ AI employees that handle specific tasks autonomously.

**Agent Types**:

#### Code & Engineering Agents
- [ ] `code-reviewer` — Reviews PRs, suggests improvements, catches bugs
- [ ] `test-writer` — Generates test suites from function signatures
- [ ] `refactorer` — Identifies and executes safe refactoring patterns
- [ ] `dependency-auditor` — Scans deps for CVEs, license issues, updates
- [ ] `migration-writer` — Generates DB migrations from schema diffs
- [ ] `api-designer` — Designs REST/GraphQL/gRPC contracts from specs
- [ ] `perf-analyzer` — Profiles code, identifies bottlenecks
- [ ] `doc-writer` — Generates documentation from code analysis

#### Research & Analysis Agents
- [ ] `news-aggregator` — Monitors tech news, AI papers, competitor moves
- [ ] `paper-reader` — Reads and summarizes arXiv papers
- [ ] `market-researcher` — Analyzes market trends, competitor products
- [ ] `data-analyst` — Runs statistical analysis on datasets
- [ ] `web-scraper` — Extracts structured data from web sources

#### Operations Agents
- [ ] `deploy-manager` — Orchestrates deployments across VMs
- [ ] `incident-responder` — Triages alerts, suggests fixes
- [ ] `log-analyzer` — Parses logs, identifies anomalies
- [ ] `capacity-planner` — Monitors resource usage, recommends scaling
- [ ] `backup-verifier` — Tests backup integrity on schedule

#### Communication Agents
- [ ] `email-drafter` — Drafts professional emails from intent
- [ ] `report-generator` — Generates status reports, summaries
- [ ] `translator` — Multi-language translation for communications
- [ ] `social-media` — Drafts social media content (see Pillar 7)

**Architecture**:
- [ ] Agent spawner (create agent with: role, model, tools, memory, timeout)
- [ ] Agent registry (track all running agents, their status, resource usage)
- [ ] Agent communication bus (agents can message each other, share findings)
- [ ] Agent supervision (parent agent monitors children, handles failures)
- [ ] Agent memory (per-agent context window + shared knowledge base)
- [ ] Agent resource limits (max VRAM, max tokens, max duration per agent)
- [ ] Agent output aggregation (collect results from parallel agents)
- [ ] Agent lifecycle management (spawn, run, checkpoint, resume, terminate)
- [ ] Admin UI: agent dashboard showing all active agents and their progress

**Implementation**:
- Extend `services/agent-runtime/` with multi-agent orchestration
- New directory: `agents/` for agent role definitions
- Communication via Redis pub/sub or internal message queue
- Each agent runs as a lightweight context with its own tool permissions

### 2.4 Model Benchmarking & Auto-Selection

**What**: Sven continuously benchmarks his models and automatically selects the best one for each task type.

**Capabilities**:
- [ ] Benchmark suite (reasoning, coding, vision, OCR, translation, math)
- [ ] Automated benchmark runs on model load or update
- [ ] ELO-style ranking per task category
- [ ] A/B testing framework (route % of requests to challenger model)
- [ ] Cost tracking (tokens consumed, GPU time, energy estimate)
- [ ] Quality regression detection (model update degraded performance)
- [ ] Benchmark results stored in DB, visualized in admin UI

**Implementation**:
- Part of model-router service
- Benchmark definitions in `packages/ml-inference/benchmarks/`

---

## Technical Dependencies

| Dependency | Purpose | Status |
|-----------|---------|--------|
| llama.cpp / vLLM / Ollama | Model inference backend | Check existing |
| HuggingFace Hub API | Model download | Available |
| Redis or NATS | Agent communication bus | Check existing |
| GPU monitoring (nvidia-smi / rocm-smi) | VRAM tracking | Available on VMs |

---

## Integration Points

- **Skill Runner**: Route tool calls through model-router for optimal model selection
- **Agent Runtime**: Agency system extends existing agent loop
- **Gateway API**: Expose model status and agent dashboard to admin
- **Trading Engine** (Pillar 6): Financial models routed through model-router
- **Distributed Compute** (Pillar 8): Edge inference coordinated via model-router

---

## Checklist

### Model Router (2.1)
- [ ] Create `services/model-router/` service scaffold
- [ ] Implement model registry with YAML config
- [ ] Implement task classifier (input → task type)
- [ ] Implement routing logic (task type + constraints → model selection)
- [ ] Implement failover and fallback chain
- [ ] Implement load balancer across GPU instances
- [ ] Implement warm/cold model manager
- [ ] Add streaming response proxy with model headers
- [ ] Add telemetry (tokens/sec, latency histograms, utilization)
- [ ] Integration tests: task → correct model selected
- [ ] Load test: concurrent requests routed without OOM

### Local Model Hosting (2.2)
- [ ] Implement model download manager with integrity verification
- [ ] Implement VRAM budget tracker
- [ ] Implement auto-offload logic (GPU layers → CPU when tight)
- [ ] Implement model version manager
- [ ] Implement health check per loaded model
- [ ] Admin UI: model catalog page with download/status/stats
- [ ] License compliance checker for each model
- [ ] Disk space manager for model weights

### Agency System (2.3)
- [ ] Implement agent spawner (role, model, tools, memory, timeout)
- [ ] Implement agent registry and lifecycle manager
- [ ] Implement agent communication bus (Redis pub/sub or NATS)
- [ ] Implement agent supervision (parent monitors children)
- [ ] Implement agent memory (per-agent context + shared knowledge)
- [ ] Implement resource limits per agent (VRAM, tokens, duration)
- [ ] Implement output aggregation from parallel agents
- [ ] Define 20+ agent roles with tool permissions
- [ ] Admin UI: agent dashboard (active agents, status, resource usage)
- [ ] Integration test: spawn 5 agents → parallel work → aggregated result
- [ ] Stress test: 20 concurrent agents without resource exhaustion

### Benchmarking (2.4)
- [ ] Implement benchmark suite (6 task categories)
- [ ] Implement automated benchmark on model load
- [ ] Implement ELO ranking system
- [ ] Implement A/B testing framework
- [ ] Store results in DB, expose via admin API
- [ ] Admin UI: model leaderboard visualization

### Model Integrations
- [ ] Download and configure Nemotron 3 Super (128B, quantized to fit VM5)
- [ ] Download and configure Qwen 3.5 (appropriate size for available VRAM)
- [ ] Research MIMO V2 Pro availability (Xiaomi release status)
- [ ] Verify all model licenses permit commercial/internal use
- [ ] Benchmark all models on the standard suite
- [ ] Document VRAM requirements and recommended quantizations

---

## Success Criteria

1. Sven routes requests to the optimal model without manual intervention
2. At least 3 open-weight models hosted locally and benchmarked
3. Agency system can run 10+ parallel agents for a complex task
4. Model failover happens automatically in <2 seconds
5. Admin UI shows real-time model utilization and agent activity
6. No single model failure causes Sven to become unresponsive
7. VRAM budget management prevents OOM crashes
