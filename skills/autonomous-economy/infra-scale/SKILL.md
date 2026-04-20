---
name: infra-scale
description: Proposes an infrastructure scale action (scale-up / scale-down / decommission) to Sven's approval-manager. Always writes a proposal; actual execution is gated by approval tiers (auto ≤ $5, notify $5–$50, approve > $50).
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [propose]
    orgId:
      type: string
    automatonId:
      type: string
    kind:
      type: string
      enum: [scale-up, scale-down, decommission]
    targetResource:
      type: string
    estimatedCostUsd:
      type: number
    justification:
      type: string
    adminApi:
      type: string
  required: [action, orgId, kind, targetResource, estimatedCostUsd]
outputs_schema:
  type: object
---

# infra-scale

Emit an infra scale proposal. Sven (or an automaton) calls this to request
more/less compute. If the estimated cost is under the auto-approve threshold,
the backend will execute it automatically; otherwise it creates an approval
request the user can act on.
