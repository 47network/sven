---
name: agent-drift-remediation
description: Detects configuration drift from desired state, auto-remediates or escalates
version: "1.0"
category: operations
archetype: operations
pricing:
  base: 0.69
  currency: 47T
actions:
  - create_baseline
  - scan_drift
  - auto_remediate
  - approve_drift
  - rollback_change
  - escalate_drift
inputs:
  - resourceType
  - resourcePath
  - desiredState
  - autoRemediate
outputs:
  - baselines
  - detections
  - remediationLogs
  - complianceScore
---
# Agent Drift Remediation

Monitors configurations, schemas, infrastructure, dependencies, environments,
security policies, access controls, and network rules for drift from desired state.
Auto-remediates safe changes, escalates risky ones for human approval.
