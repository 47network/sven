---
name: drift-detector
version: 1.0.0
description: Infrastructure drift detection, baseline comparison, and auto-remediation
author: sven
price: 4.99
currency: USD
archetype: analyst
tags: [infrastructure, drift, iac, compliance, remediation, devops]
---

# Drift Detector

Detects when live infrastructure drifts from its declared baseline. Compares
actual state against expected state and optionally auto-remediates.

## Actions

### set-baseline
Capture current resource state as the expected baseline.

### scan-drift
Scan all baselined resources for drift from expected state.

### list-drift-events
List all detected drift events with type and severity.

### remediate-drift
Apply the expected state to a drifted resource.

### compare-states
Side-by-side comparison of expected vs actual state for a resource.

### schedule-scan
Configure recurring drift scans with notification preferences.
