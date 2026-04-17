# Sven v0.2.0 — Expansion Master Plan

> Extracted from 11 video transcripts + user vision on 2026-04-11.
> Each pillar has its own spec file with granular checklists.

---

## Overview

This plan transforms Sven from a self-healing AI assistant into a **full-spectrum autonomous intelligence platform** spanning 8 pillars. Every capability must be **real executable code** — no stubs, no placeholders, no theater.

---

## Pillar Map

| # | Pillar | Source | Spec File | Priority | Complexity |
|---|--------|--------|-----------|----------|------------|
| 1 | **Design Intelligence** | Video 1 | `PILLAR_01_DESIGN_INTELLIGENCE.md` | HIGH | Medium |
| 2 | **Multi-Model & AI Agency** | Videos 2, 3, 11 | `PILLAR_02_MULTI_MODEL_AGENCY.md` | HIGH | Very High |
| 3 | **OCR & Document Intelligence** | Video 4 | `PILLAR_03_OCR_DOCUMENT_INTELLIGENCE.md` | MEDIUM | Medium |
| 4 | **Quantum Computing Exploration** | Video 5 | `PILLAR_04_QUANTUM_EXPLORATION.md` | LOW | Very High |
| 5 | **Autonomous Security & Defense** | Video 6 | `PILLAR_05_SECURITY_DEFENSE.md` | CRITICAL | Very High |
| 6 | **Trading Platform & Financial AI** | Videos 7, 8, 9 | `PILLAR_06_TRADING_PLATFORM.md` | HIGH | Extreme |
| 7 | **Marketing & Business Intelligence** | Video 10 | `PILLAR_07_MARKETING_INTELLIGENCE.md` | MEDIUM | Medium |
| 8 | **Distributed Compute Mesh** | User vision | `PILLAR_08_DISTRIBUTED_COMPUTE.md` | HIGH | Very High |

---

## Architecture Integration

All pillars integrate into the existing Sven monorepo:

```
thesven_v0.1.0/
├── services/
│   ├── gateway-api/          — REST/WS API, auth, chat
│   ├── agent-runtime/        — LLM orchestration, tool dispatch
│   ├── skill-runner/         — Tool execution, self-healing
│   ├── trading-engine/       — NEW: Trading platform backend
│   ├── model-router/         — NEW: Multi-model routing & local inference
│   ├── compute-mesh/         — NEW: Distributed compute coordinator
│   └── prediction-engine/    — NEW: MiroFish-style simulation engine
├── apps/
│   ├── admin-ui/             — Admin dashboard
│   ├── canvas-ui/            — Chat + canvas interface
│   ├── trading-ui/           — NEW: Trading platform frontend (trading.sven.systems)
│   └── companion-user-flutter/ — Mobile + device compute
├── packages/
│   ├── shared/               — Shared types, utilities
│   ├── design-system/        — NEW: Sven's design intelligence library
│   ├── market-data/          — NEW: Market data ingestion + normalization
│   └── ml-inference/         — NEW: Local model inference wrappers
├── models/                   — NEW: Local model weights & configs
│   ├── kronos/               — Kronos financial prediction model
│   ├── glm-ocr/              — GLM-OCR document processing
│   └── gemma4/               — Existing Gemma 4 integration
├── skills/                   — Sven skill definitions
│   ├── design/               — NEW: Design intelligence skills
│   ├── trading/              — NEW: Trading-related skills
│   ├── security/             — NEW: Security scanning skills
│   └── prediction/           — NEW: Prediction/simulation skills
└── agents/                   — NEW: Specialized autonomous agents
    ├── code-reviewer/        — Parallel code review agent
    ├── market-analyst/       — Market analysis agent
    ├── security-scanner/     — Autonomous vulnerability hunter
    ├── news-aggregator/      — Real-time news impact analyzer
    └── prediction-simulator/ — MiroFish-style multi-agent simulator
```

---

## Infrastructure Requirements

### Existing (Already Available)
- **VM4** — Platform services (gateway-api, agent-runtime, skill-runner)
- **VM5** — AI services (dual AMD GPUs, model inference)
- **VM6** — Data & Observability (Postgres, Prometheus, Grafana, Loki)
- **VM7** — Adapter services
- **VM12** — Rocket.Chat federation
- **VM13** — GPU fallback
- **WireGuard mesh** connecting all VMs

### New Requirements
- **VM-TRADE** — Trading engine + market data feeds (dedicated, low-latency)
- **VM-COMPUTE** — Distributed compute coordinator + local model hosting
- **Additional GPU capacity** on VM5/VM13 for Kronos + prediction models
- **DNS**: `trading.sven.systems` → VM-TRADE
- **Market data API subscriptions** (exchange feeds, news APIs)
- **Device compute agents** deployed to user devices (S24 Ultra, desktop companions)

---

## Currency & Token System

- **Token Name**: TBD by user (suggestions: 47Coin, SvenToken, NeuralCoin, FortySevenToken)
- **Purpose**: Internal platform currency for Sven's trading ecosystem
- **Initial Allocation**: Starting allowance for Sven to trade and learn
- **Visibility**: External users see "DEMO" watermark; internal users trade real platform tokens
- **No real money initially** — paper trading with live market data, graduating to real positions

---

## Phased Rollout

### Phase A — Foundation (Weeks 1-4)
- Pillar 1: Design Intelligence (self-contained, low dependency)
- Pillar 5: Security & Defense (extends existing self-healing)
- Pillar 7: Marketing Intelligence (skill-based, minimal infra)

### Phase B — Intelligence Layer (Weeks 5-10)
- Pillar 2: Multi-Model & AI Agency (model-router service, local inference)
- Pillar 3: OCR & Document Intelligence (GLM-OCR integration)
- Pillar 8: Distributed Compute Mesh (compute-mesh service)

### Phase C — Trading Platform (Weeks 11-20)
- Pillar 6: Trading Platform & Financial AI (full stack: engine + UI + Kronos)
- Integration of prediction engine with trading decisions
- Sven autonomous trading loops with live market data

### Phase D — Frontier (Weeks 21+)
- Pillar 4: Quantum Computing Exploration (research + prototype)
- Cross-pillar integration (prediction → trading → security → marketing)
- Federation of trading capabilities across Sven instances

---

## Key Design Principles

1. **Self-Contained** — Every capability owned by Sven, no external dependency on other repos
2. **Self-Improving** — Sven uses these capabilities to improve himself
3. **Real Execution** — No proposals, no theater — working code that runs in production
4. **Admin-Gated** — All privileged operations restricted to the 47 administrator
5. **Observable** — Every new capability has telemetry, logging, and health checks
6. **Federated** — Capabilities extend across the 47Network federation
7. **Incremental** — Each pillar delivers value independently before cross-integration

---

## Cross-References

- Existing self-healing v9: `services/skill-runner/src/index.ts`
- Existing Soul: `services/gateway-api/src/db/seed.ts`
- Existing evolution roadmap: `docs/features/` + `docs/architecture/`
- Master checklist: `docs/features/EXPANSION_MASTER_CHECKLIST.md`
