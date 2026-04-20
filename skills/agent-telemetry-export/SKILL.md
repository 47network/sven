---
name: agent-telemetry-export
version: 1.0.0
archetype: infrastructure
price: 0.49 47T
status: active
---

# Agent Telemetry Export

Export agent metrics, traces, logs and events to external observability platforms.

## Actions

| Action | Description |
|--------|-------------|
| create-sink | Register a new telemetry sink (Prometheus, Grafana, Datadog, OTLP, etc.) |
| create-pipeline | Configure export pipeline with transforms and sampling |
| export-batch | Trigger manual batch export to all active sinks |
| sink-health | Check connectivity and health of all registered sinks |
| pipeline-stats | Get export statistics across all pipelines |
| rotate-credentials | Rotate authentication credentials for a sink |

## Inputs

- `sinkType` — Target platform (prometheus, grafana, datadog, otlp, cloudwatch, elasticsearch, custom)
- `endpointUrl` — Sink endpoint URL
- `signalType` — Signal to export (metrics, traces, logs, events)
- `samplingRate` — Sampling rate 0.0–1.0 (default 1.0)
- `batchSize` — Records per export batch (default 1000)
- `transformRules` — Optional transform pipeline rules

## Outputs

- `sinkId` — Created sink identifier
- `pipelineId` — Created pipeline identifier
- `exportCount` — Total records exported
- `errorRate` — Export error percentage
- `avgLatencyMs` — Average export latency
