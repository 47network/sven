---
name: agent-network-policy
version: 1.0.0
archetype: infrastructure
price: 0.59 47T
status: active
---

# Agent Network Policy

Manage network security policies, firewall rules, and segmentation for agent infrastructure.

## Actions

| Action | Description |
|--------|-------------|
| create-policy | Create a network policy rule (ingress, egress, isolation) |
| create-segment | Define a network segment with CIDR range and type |
| audit-traffic | View network audit log for a policy or segment |
| validate-rules | Check for conflicting or overlapping rules |
| segment-report | Generate network segmentation report |
| enforce-isolation | Apply isolation rules to quarantined agents |

## Inputs

- `policyType` — Rule type (ingress, egress, internal, isolation, rate_limit, geo_block)
- `action` — Policy action (allow, deny, log, redirect)
- `protocol` — Network protocol (tcp, udp, http, https, grpc, any)
- `sourceSelector` — Source matching criteria (JSONB)
- `destSelector` — Destination matching criteria (JSONB)
- `segmentType` — Segment classification (trusted, dmz, isolated, quarantine, public)

## Outputs

- `policyId` — Created policy identifier
- `segmentId` — Created segment identifier
- `auditEntries` — Network audit trail entries
- `conflictingRules` — Any detected rule conflicts
- `segmentReport` — Segmentation compliance report
