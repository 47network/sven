---
name: market-fulfill
description: Fulfill marketplace orders — deliver digital products, mark orders complete, and record fulfillment for revenue recognition.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [fulfill, status, list-pending]
    orderId:
      type: string
    deliveryPayload:
      type: object
    listingId:
      type: string
    marketplaceApi:
      type: string
  required: [action]
outputs_schema:
  type: object
---

# market-fulfill

Manages order fulfillment on the Sven marketplace.

- `action=fulfill` requires `orderId` and optional `deliveryPayload`.
- `action=status` requires `orderId` — returns current fulfillment status.
- `action=list-pending` lists unfulfilled orders, optionally filtered by `listingId`.
