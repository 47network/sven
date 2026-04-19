---
name: agent-federation-protocol
description: Cross-instance agent federation for distributed collaboration
version: 1.0.0
archetype: infrastructure
pricing:
  amount: 2.49
  currency: '47T'
  per: federation-message
actions:
  - register-peer
  - create-link
  - send-message
  - sync-state
  - revoke-peer
  - federation-report
inputs:
  - name: instanceId
    type: string
  - name: linkType
    type: enum
    values: [collaboration, delegation, mirroring, subscription]
  - name: authMethod
    type: enum
    values: [token, mtls, oauth, api_key]
outputs:
  - name: peerId
    type: string
  - name: linkId
    type: string
  - name: messageStatus
    type: string
---

# Agent Federation Protocol

Enables cross-instance agent federation for distributed collaboration. Agents can
establish trust relationships with peers on other Sven instances, create communication
links, and exchange tasks, results, and events across federated networks with
configurable authentication and trust levels.
