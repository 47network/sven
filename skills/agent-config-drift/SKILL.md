---
name: agent-config-drift
version: 1.0.0
description: Detect and remediate configuration drift across infrastructure resources
triggers:
  - drift_create_baseline
  - drift_run_scan
  - drift_list_drifts
  - drift_remediate
  - drift_lock_baseline
  - drift_report
pricing:
  model: per_scan
  base: 1.00
archetype: analyst
---
# Config Drift Detection Skill
Detects configuration drift by comparing current infrastructure state against stored baselines. Supports auto-remediation.
