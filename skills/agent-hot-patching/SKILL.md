---
name: agent-hot-patching
description: Live patching of agent behavior without restart
version: 1.0.0
archetype: operations
pricing:
  amount: 1.99
  currency: '47T'
  per: patch-operation
actions:
  - create-patch
  - apply-patch
  - rollback-patch
  - create-chain
  - test-patch
  - audit-history
inputs:
  - name: target
    type: enum
    values: [prompt, config, skill, workflow, handler, filter]
  - name: operation
    type: enum
    values: [replace, append, prepend, delete, merge, wrap]
  - name: patchData
    type: object
outputs:
  - name: patchId
    type: string
  - name: applied
    type: boolean
  - name: rollbackAvailable
    type: boolean
---

# Agent Hot Patching

Enables live modification of agent behavior without service restart. Supports atomic
patch operations with automatic rollback capability, chain execution for coordinated
changes, and full audit trail of all modifications.
