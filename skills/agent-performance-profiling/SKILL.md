---
name: agent-performance-profiling
version: 1.0.0
archetype: analyst
price: 0.79 47T
status: active
---

# Agent Performance Profiling

Profile agent CPU, memory, I/O, and network performance. Detect bottlenecks and suggest optimizations.

## Actions

| Action | Description |
|--------|-------------|
| start-profile | Start a performance profiling session for an agent |
| detect-bottlenecks | Analyze profile data for bottlenecks |
| set-baseline | Establish performance baselines for metrics |
| compare-baseline | Compare current performance against baselines |
| auto-optimize | Apply auto-fixable optimizations |
| trend-report | Generate performance trend report |

## Inputs

- `agentId` — Target agent to profile
- `profileType` — Type of profile (cpu, memory, io, network, latency, throughput)
- `durationMs` — Profiling duration in milliseconds
- `metricName` — Metric name for baseline comparison
- `windowHours` — Time window for trend analysis (default 24)

## Outputs

- `profileId` — Created profile identifier
- `hotSpots` — Performance hot spots with line/component info
- `bottlenecks` — Detected bottlenecks with severity and suggestions
- `flamegraphUrl` — URL to flamegraph visualization
- `baselineDeviation` — Deviation from baseline percentage
- `trend` — Performance trend (improving, stable, degrading, critical)
