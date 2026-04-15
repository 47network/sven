---
name: evolution-engine
description: >
  Self-improving research loop based on ASI-Evolve.
  3-agent pipeline (Researcher → Engineer → Analyzer) that autonomously
  evolves algorithms: trading strategies, routing policies, RAG retrieval,
  scheduling heuristics, and prompt engineering.
version: 1.0.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts

inputs_schema:
  action:
    type: string
    required: true
    enum:
      - start_evolution
      - stop_evolution
      - get_run
      - list_runs
      - get_best
      - inject_knowledge
      - list_templates
      - get_stats
  run_id:
    type: string
    description: Evolution run ID (for get_run, stop, get_best, inject_knowledge)
  domain:
    type: string
    enum: [trading_strategy, rag_retrieval, model_routing, prompt_engineering, scheduling, custom]
  experiment:
    type: object
    description: Experiment template override (for start_evolution)
  config:
    type: object
    description: Evolution config override (maxGenerations, populationSize, etc.)
  title:
    type: string
    description: Knowledge title (for inject_knowledge)
  content:
    type: string
    description: Knowledge content (for inject_knowledge)

outputs_schema:
  result:
    type: object
    description: Action-specific result payload

when-to-use: >
  Use when the user wants Sven to autonomously improve an algorithm,
  strategy, or configuration through iterative evolution. Supports
  trading strategies, RAG retrieval tuning, model routing optimization,
  prompt engineering, and workflow scheduling.
---

# Evolution Engine Skill

Self-improving research loop that evolves algorithms through iterative
experimentation. Based on the ASI-Evolve Learn → Design → Experiment → Analyze
paradigm.

## Architecture

Three-agent pipeline per evolution step:
1. **Researcher** — scans cognition store for prior art, formulates research brief
2. **Engineer** — generates candidate solution based on research + parent code
3. **Analyzer** — evaluates results, extracts insights for cognition store

## Sampling Strategies

- **UCB1** — Upper Confidence Bound, balances exploration/exploitation
- **Greedy** — always picks highest-scoring parent
- **Random** — uniform random parent selection
- **MAP-Elites** — quality-diversity, selects from under-represented cells

## Pre-Built Experiment Domains

| Domain | Evaluator | Metrics |
|--------|-----------|---------|
| Trading Strategy | Backtest P&L | Sharpe, drawdown |
| RAG Retrieval | Accuracy test set | MRR, NDCG |
| Model Routing | Quality + latency + cost | Judge score, p95, $/query |
| Prompt Engineering | Task completion | Accuracy, format compliance |
| Scheduling | Workload throughput | Throughput, fairness, deadline % |

## Actions

### start_evolution
Start a new evolution run with a domain template or custom experiment.

### stop_evolution
Stop a running evolution. The run can be resumed later.

### get_run
Get full details of an evolution run including nodes, cognition, and config.

### list_runs
List recent evolution runs with status and best scores.

### get_best
Get the best-scoring node from a completed run.

### inject_knowledge
Add domain knowledge to a running evolution's cognition store.

### list_templates
List available pre-built experiment templates.

### get_stats
Get aggregate evolution statistics.
