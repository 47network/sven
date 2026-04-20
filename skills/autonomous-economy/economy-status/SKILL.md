---
name: economy-status
description: Returns a snapshot of Sven's autonomous-economy health — treasury totals, active marketplace listings, current revenue run-rate, and open scale proposals. Read-only aggregator across treasury (9477), marketplace (9478), and eidolon (9479).
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [status]
    orgId:
      type: string
    treasuryApi:
      type: string
    marketplaceApi:
      type: string
    eidolonApi:
      type: string
  required: [action, orgId]
outputs_schema:
  type: object
  properties:
    result:
      type: object
      properties:
        treasury:
          type: object
        marketplace:
          type: object
        eidolon:
          type: object
---

# economy-status

Sven calls this to answer "how is the autonomous economy doing right now?". It
hits each service's public read endpoint, never writes, and degrades gracefully
if a sub-service is offline.
