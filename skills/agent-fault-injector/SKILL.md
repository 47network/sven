---
name: agent-fault-injector
version: 1.0.0
description: Chaos engineering and resilience testing for agent services
author: sven-autonomous
pricing:
  base: 0.00
  currency: "47T"
archetype: analyst
---

# Agent Fault Injector

Injects controlled faults into services to test resilience, measure recovery, and identify weaknesses.

## Actions
- create-experiment: Design a fault injection experiment
- run-experiment: Execute a fault injection experiment
- abort-experiment: Stop a running experiment immediately
- observe-metrics: Collect metrics during fault injection
- generate-report: Create resilience report with scores and recommendations
- schedule-experiment: Schedule an experiment for future execution

## Inputs
- targetService: Service to inject faults into
- faultType: Type of fault (latency, error, abort, throttle, partition, cpu_stress)
- severity: Fault severity level (low, medium, high, critical)
- durationSeconds: How long to inject the fault
- config: Fault-specific configuration (delay_ms, error_code, etc.)

## Outputs
- experimentId: Identifier for the experiment
- observations: Real-time metric observations
- resilienceScore: Overall resilience score (0-100)
- recoveryTimeMs: Time to recover from fault
- recommendations: Improvement suggestions
