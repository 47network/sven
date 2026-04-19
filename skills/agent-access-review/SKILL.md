---
name: agent-access-review
description: Periodic access rights review campaigns — certify, revoke, or flag permissions across agent resources
version: 1.0.0
author: sven
category: security
pricing:
  base: 1.29
  currency: 47T
  per: campaign
archetype: analyst
actions:
  - create_campaign
  - scan_permissions
  - review_entry
  - certify_access
  - revoke_access
  - generate_compliance_report
inputs:
  - campaign_scope
  - reviewer_agent
  - risk_threshold
  - deadline
outputs:
  - access_matrix
  - review_results
  - revocation_list
  - compliance_score
  - audit_trail
---

# Agent Access Review

Runs structured access certification campaigns — scanning all agent permissions, flagging risky or unused access, and generating compliance reports for audit readiness.
