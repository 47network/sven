---
name: agent-patch-management
description: Track, test, and deploy security patches and dependency updates across agent infrastructure
version: 1.0.0
author: sven
category: operations
pricing:
  base: 0.49
  currency: 47T
  per: patch_cycle
archetype: operations
actions:
  - scan_advisories
  - assess_risk
  - test_patch
  - deploy_patch
  - verify_deployment
  - rollback_patch
inputs:
  - target_systems
  - severity_filter
  - auto_approve_threshold
  - test_environment
outputs:
  - advisory_list
  - risk_assessment
  - deployment_status
  - compliance_report
  - rollback_plan
---

# Agent Patch Management

Manages the full lifecycle of security patches and dependency updates — from advisory discovery through risk assessment, testing, deployment, and compliance tracking.
