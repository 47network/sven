---
name: metric-exporter
description: Metrics collection, export, and alerting
version: 1.0.0
price: 12.99
currency: USD
archetype: analyst
tags: [metrics, prometheus, monitoring, observability]
---
# Metric Exporter
Collect and export application metrics in multiple formats with alert thresholds.
## Actions
### record-metric
Record a metric data point.
- **inputs**: metricName, metricType, value, labels
- **outputs**: seriesId, recorded
### configure-export
Set up metric export configuration.
- **inputs**: exportFormat, scrapeInterval, retentionDays, endpoints
- **outputs**: configId, exportFormat
### create-alert
Create a metric-based alert rule.
- **inputs**: metricName, condition, threshold, severity
- **outputs**: alertId, active
### query-metrics
Query metric time series data.
- **inputs**: metricName, labels, since, until, aggregation
- **outputs**: series[], dataPoints
### export-dashboard
Export metrics dashboard configuration.
- **inputs**: configId, format, metrics
- **outputs**: dashboard, panels
### list-alerts
List active metric alerts.
- **inputs**: configId, severity, active
- **outputs**: alerts[], totalActive
