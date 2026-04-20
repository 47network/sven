---
name: agent-log-correlation
description: Correlates logs across services to identify patterns and cascading failures
version: "1.0"
category: operations
archetype: analyst
pricing:
  base: 1.19
  currency: 47T
actions:
  - create_rule
  - correlate_logs
  - investigate_incident
  - build_timeline
  - resolve_incident
  - export_analysis
inputs:
  - ruleName
  - patternType
  - patternConfig
  - correlationWindow
  - minOccurrences
outputs:
  - rules
  - incidents
  - entries
  - timeline
  - rootCauseAnalysis
---
# Agent Log Correlation

Analyzes logs across services using regex, keyword, structured, ML model,
anomaly detection, and sequence pattern matching. Identifies cascade failures,
error storms, latency spikes, resource exhaustion, and security events.
