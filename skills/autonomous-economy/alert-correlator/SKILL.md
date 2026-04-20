---
name: alert-correlator
description: Correlates related alerts using temporal, causal, and semantic analysis to reduce alert fatigue
version: 1.0.0
price: 17.99
currency: USD
archetype: analyst
category: observability-monitoring
tags: [alerts, correlation, dedup, incident, notification]
---

# Alert Correlator

Intelligently correlates related alerts to reduce noise and identify root causes. Supports temporal, causal, and topological correlation strategies.

## Actions
- **fire-alert**: Create and fire a new alert with severity and source
- **correlate-alerts**: Find correlated alerts for a given alert
- **acknowledge-alert**: Acknowledge a firing alert
- **resolve-alert**: Resolve a firing or acknowledged alert
- **silence-alerts**: Silence alerts matching a fingerprint pattern
- **get-correlations**: Get all correlated alerts for analysis
