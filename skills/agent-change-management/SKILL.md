---
name: agent-change-management
version: 1.0.0
description: Change request lifecycle with approvals, impact analysis, and rollback tracking
category: platform-ops
pricing: { model: per_request, base: 0.03 }
archetype: analyst
triggers:
  - change_request
  - change_approval
  - change_rollback
  - change_management
actions:
  - create_request
  - submit_approval
  - start_change
  - complete_change
  - rollback
  - report
inputs:
  - name: action
    type: string
    required: true
  - name: requestData
    type: object
    description: Change request details and impact analysis
  - name: approvalData
    type: object
    description: Approval decision and comments
  - name: rollbackData
    type: object
    description: Rollback reason and type
outputs:
  - name: changeRequest
    type: object
  - name: approval
    type: object
  - name: rollback
    type: object
  - name: stats
    type: object
---

# Agent Change Management

Manages change request lifecycle from draft through approval, implementation, and optional rollback.
