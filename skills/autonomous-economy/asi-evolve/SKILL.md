---
name: asi-evolve
version: "1.0"
description: >
  Self-improvement engine for Sven. Implements the Learn → Design → Experiment
  → Analyze loop so Sven can continuously improve his own skills, prompts,
  workflows, and routing strategies through evolutionary search and A/B testing.
archetype: researcher
pricing:
  amount: 0
  currency: "47Token"
  unit: "per cycle"
actions:
  - id: propose
    label: Propose Improvement
    description: >
      Learn phase — analyze recent task outcomes, identify weak areas,
      and generate an improvement proposal with expected impact, rollback
      plan, and confidence score.
    inputs:
      - name: domain
        type: string
        required: true
        description: "Area to improve: skill, prompt, workflow, routing, scheduling, retrieval, custom"
      - name: recentOutcomes
        type: array
        required: false
        description: "Array of recent task outcome objects { taskId, score, metrics }"
      - name: focusArea
        type: string
        required: false
        description: "Specific sub-area to focus on (e.g., 'translation quality', 'response latency')"
    outputs:
      - name: proposalId
        type: string
      - name: title
        type: string
      - name: expectedImpact
        type: number
      - name: confidence
        type: number
      - name: requiresHumanApproval
        type: boolean

  - id: experiment
    label: Run A/B Experiment
    description: >
      Experiment phase — create and run an A/B test comparing the current
      approach (variant A) with the proposed improvement (variant B).
      Tracks wins, scores, and statistical significance.
    inputs:
      - name: proposalId
        type: string
        required: true
        description: "ID of the improvement proposal to experiment with"
      - name: targetSamples
        type: number
        required: false
        description: "Number of samples to collect before concluding (default: 100)"
    outputs:
      - name: experimentId
        type: string
      - name: status
        type: string
      - name: winner
        type: string
      - name: significance
        type: number

  - id: rollback
    label: Rollback Improvement
    description: >
      Safety mechanism — rollback a previously applied improvement if
      regression is detected or human requests reversal.
    inputs:
      - name: proposalId
        type: string
        required: true
        description: "ID of the applied proposal to roll back"
      - name: reason
        type: string
        required: true
        description: "Reason for rollback"
      - name: triggeredBy
        type: string
        required: false
        description: "Who triggered: system, human, safety_guard, regression"
    outputs:
      - name: rollbackId
        type: string
      - name: restoredState
        type: object
      - name: regressionDelta
        type: number

  - id: status
    label: Evolution Status
    description: >
      Get current status of the self-improvement engine — active proposals,
      running experiments, recent rollbacks, improvement rate.
    inputs:
      - name: domain
        type: string
        required: false
        description: "Filter by domain (optional)"
      - name: includeHistory
        type: boolean
        required: false
        description: "Include completed/rejected proposals in response"
    outputs:
      - name: activeProposals
        type: number
      - name: runningExperiments
        type: number
      - name: totalImprovements
        type: number
      - name: totalRollbacks
        type: number
      - name: improvementRate
        type: number

  - id: analyze
    label: Analyze Results
    description: >
      Analyze phase — evaluate experiment results, determine if improvement
      is significant, auto-apply winners or reject losers. Feed learnings
      back into the cognition store.
    inputs:
      - name: experimentId
        type: string
        required: true
        description: "ID of the completed experiment to analyze"
    outputs:
      - name: winner
        type: string
      - name: significance
        type: number
      - name: applied
        type: boolean
      - name: learnings
        type: array
---

# ASI-Evolve — Self-Improvement Engine

Sven's self-improvement loop, inspired by ASI-Evolve (Apache-2.0). Continuously
identifies areas for improvement, proposes changes, A/B tests them in sandboxed
environments, and auto-applies winners while maintaining rollback capability.

## Loop Phases

1. **Learn** — Analyze recent task outcomes across all domains. Identify patterns
   in failures, slow responses, low quality scores. Generate improvement proposals.

2. **Design** — The evolution engine (Researcher → Engineer → Analyzer pipeline)
   generates candidate improvements. Each proposal includes expected impact,
   confidence score, and a rollback plan.

3. **Experiment** — A/B test the proposed improvement against the current approach.
   Track wins, scores, and statistical significance across real workloads.

4. **Analyze** — Evaluate experiment results. If the improvement is statistically
   significant and positive, auto-apply. If regressive, reject. Feed learnings
   back into the cognition store for future proposals.

## Safety Guardrails

- **Human approval**: Changes with expected impact ≥ 0.7 require human approval
- **Regression detection**: Auto-rollback if applied change causes regression > 5%
- **Concurrent limit**: Max 3 simultaneous A/B experiments
- **Rollback history**: Full audit trail of every rollback with before/after state
