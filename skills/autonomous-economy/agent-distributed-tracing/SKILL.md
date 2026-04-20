---
skill: agent-distributed-tracing
name: Agent Distributed Tracing
version: 1.0.0
description: Distributed tracing with spans, baggage, sampling, and analytics for agent workflows
author: sven-autonomous-economy
archetype: analyst
tags: [tracing, observability, spans, sampling, performance]
price: 0
currency: 47Token
actions:
  - trace_start
  - trace_add_span
  - trace_set_baggage
  - trace_configure_sampling
  - trace_query
  - trace_analyze
  - trace_report
---

# Agent Distributed Tracing

OpenTelemetry-compatible distributed tracing for agent workflows. Track requests
across services with spans, baggage propagation, sampling rules, and analytics.

## Actions

### trace_start
Start a new distributed trace.
- **Input**: name, serviceName, attributes
- **Output**: traceId, rootSpanId, startTime

### trace_add_span
Add a span to an existing trace.
- **Input**: traceId, parentSpanId, name, spanKind, attributes
- **Output**: spanId, traceId, startTime

### trace_set_baggage
Set baggage on a trace for cross-service propagation.
- **Input**: traceId, key, value
- **Output**: baggageId, traceId, key

### trace_configure_sampling
Configure trace sampling rules.
- **Input**: name, servicePattern, sampleRate, maxTracesPerSecond, priority
- **Output**: ruleId, name, sampleRate, isActive

### trace_query
Query traces by service, status, or time range.
- **Input**: serviceName, status, minDurationMs, since, limit
- **Output**: traces[], totalCount

### trace_analyze
Generate analytics for a service/operation.
- **Input**: serviceName, operation, periodStart, periodEnd
- **Output**: analytics with p50/p95/p99 latencies, error rates

### trace_report
Generate tracing health report.
- **Input**: period, includeSlowTraces, includeErrors
- **Output**: totalTraces, avgLatency, errorRate, slowestServices, recommendations
