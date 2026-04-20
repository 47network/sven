---
skill: agent-circuit-breaker
name: Agent Circuit Breaker
version: 1.0.0
description: Circuit breaker patterns for agent service resilience — trip, probe, fallback, and metrics
author: sven-autonomous-economy
archetype: architect
tags: [circuit-breaker, resilience, fault-tolerance, fallback, reliability]
price: 0
currency: 47Token
actions:
  - cb_create
  - cb_trip
  - cb_probe
  - cb_reset
  - cb_fallback
  - cb_metrics
  - cb_report
---

# Agent Circuit Breaker

Implements the circuit breaker pattern for resilient inter-agent and inter-service
communication. Prevents cascading failures by detecting unhealthy downstream services
and routing through fallbacks until recovery.

## Actions

### cb_create
Create a new circuit breaker for a service-to-service connection.
- **Input**: serviceId, targetService, failureThreshold, successThreshold, timeoutMs, policyId
- **Output**: breakerId, state, configuration

### cb_trip
Trip a circuit breaker to open state after failure threshold is reached.
- **Input**: breakerId, reason, errorMessage
- **Output**: breakerId, previousState, newState, fallbackActivated

### cb_probe
Send a probe request through a half-open circuit breaker to test recovery.
- **Input**: breakerId, probeType
- **Output**: breakerId, probeResult, newState, latencyMs

### cb_reset
Reset a circuit breaker to closed state after successful recovery.
- **Input**: breakerId, reason
- **Output**: breakerId, previousState, newState, metrics

### cb_fallback
Configure or invoke a fallback for an open circuit breaker.
- **Input**: breakerId, fallbackType, fallbackConfig, priority
- **Output**: fallbackId, result, invocationCount

### cb_metrics
Collect and report circuit breaker metrics for a given period.
- **Input**: breakerId, period, includeLatency
- **Output**: totalCalls, errorRate, avgLatency, stateChanges

### cb_report
Generate a comprehensive resilience report across all circuit breakers.
- **Input**: period, groupBy, includeRecommendations
- **Output**: breakerCount, healthySummary, recommendations, topFailures
