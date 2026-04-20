---
name: failure-injector
version: 1.0.0
description: Chaos engineering failure injection for resilience testing
category: observability
pricing: { model: per_use, base_cost: 7.99 }
archetype: analyst
---

# Failure Injector

Injects controlled failures into services to test resilience, recovery, and fault tolerance mechanisms.

## Actions

- **create-experiment**: Design a failure injection experiment with hypothesis
- **run-experiment**: Execute the failure injection against target service
- **abort-experiment**: Safely abort a running experiment
- **analyze-results**: Analyze experiment results against hypothesis
- **generate-report**: Create detailed resilience report with findings
- **schedule-gameday**: Schedule a full game day with multiple experiments

## Inputs

- targetService: string — Service to inject failures into
- failureType: FailureType — latency, error, crash, packet_loss, resource_exhaustion
- parameters: object — Failure-specific parameters (duration, error rate, etc.)
- hypothesis: string — Expected behavior under failure
- safetyLimits: object — Abort conditions and limits

## Outputs

- experimentId: string — Experiment identifier
- results: object — Detailed results with metrics
- report: FailureReport — Full resilience report
