---
name: agent-patch-manager
version: 1.0.0
description: Manages software patch policies, rollouts, CVE remediation, and compliance tracking across infrastructure
author: sven-autonomous
category: infrastructure
pricing:
  model: per_execution
  base_cost: 0.50
archetype: operator
tags: [patches, security, compliance, CVE, rollout, vulnerability]
actions:
  - create_policy
  - approve_release
  - rollout_patch
  - check_compliance
  - rollback_release
  - scan_vulnerabilities
inputs:
  - policy_config
  - patch_release
  - target_hosts
  - severity_filter
  - cve_ids
outputs:
  - policy_id
  - release_status
  - compliance_report
  - patched_count
  - rollback_status
---

# Agent Patch Manager

Manages software patch lifecycle from discovery through deployment to compliance verification. Tracks CVE remediation, enforces maintenance windows, and provides automated rollback on failure.
