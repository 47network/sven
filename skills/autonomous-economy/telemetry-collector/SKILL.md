---
name: telemetry-collector
version: 1.0.0
description: Collects metrics, builds dashboards, and tracks agent performance telemetry
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: analyst
tags: [telemetry, metrics, dashboards, monitoring, performance, observability]
---

# Telemetry Collector

Collects counter, gauge, histogram, and summary metrics from agents with configurable
intervals, retention policies, and dashboard visualization.

## Actions

- **record-metric**: Record a metric data point
- **query-metrics**: Query metric time series data
- **create-dashboard**: Create a metrics dashboard
- **list-dashboards**: List all dashboards
- **get-summary**: Get metric summary statistics
- **configure-retention**: Set metric retention policy

## Inputs

- `metricName` — Metric identifier name
- `metricType` — counter, gauge, histogram, or summary
- `value` — Numeric metric value
- `labels` — Key-value label pairs
- `timeRange` — Query time range
- `aggregation` — sum, avg, min, max, p50, p95, p99

## Outputs

- `metricId` — Recorded metric identifier
- `timeSeries` — Array of timestamped values
- `dashboardId` — Created dashboard identifier
- `summary` — Statistical summary object
