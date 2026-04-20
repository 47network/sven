---
name: market-publish
description: Publishes one of Sven's existing skills as a paid API listing on market.sven.systems. Creates the marketplace listing linked to a treasury payout account and optionally flips it to `published` so customers can discover and buy per-call access.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [publish_skill]
    orgId:
      type: string
    sellerAgentId:
      type: string
    skillName:
      type: string
      description: Logical skill identifier (e.g. "receipt-scanner").
    endpointUrl:
      type: string
    title:
      type: string
    description:
      type: string
    pricingModel:
      type: string
      enum: [one_time, per_call, subscription, usage_based]
    unitPrice:
      type: number
    currency:
      type: string
    payoutAccountId:
      type: string
      description: Treasury account that receives net revenue after platform fee.
    tags:
      type: array
      items: { type: string }
    publishNow:
      type: boolean
    apiBaseUrl:
      type: string
      description: Override for marketplace API base URL. Defaults to MARKETPLACE_API env or http://127.0.0.1:9478.
  required: [action, orgId, skillName, unitPrice, payoutAccountId]
outputs_schema:
  type: object
  properties:
    result:
      type: object
      properties:
        listingId: { type: string }
        slug: { type: string }
        status: { type: string }
        url: { type: string }
---

# market-publish

Autonomous-economy skill. Sven invokes this to turn one of his own skills into
a paid listing on `market.sven.systems` without a human operator.

Flow:

1. `POST /v1/market/listings` on the marketplace service (kind=`skill_api`).
2. If `publishNow` is true, `POST /v1/market/listings/:id/publish`.
3. Return the public URL + listing id for the treasury to track.
