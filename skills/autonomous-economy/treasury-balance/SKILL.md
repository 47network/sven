---
name: treasury-balance
description: Reads a treasury account's balance and recent transactions from the Sven treasury service (port 9477). Read-only — transfers require a separate approval-gated skill.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [get, list-transactions]
    accountId:
      type: string
    orgId:
      type: string
    limit:
      type: number
    treasuryApi:
      type: string
  required: [action]
outputs_schema:
  type: object
---

# treasury-balance

Lookup current balance and last N transactions for a treasury account.
`action=get` requires `accountId`. `action=list-transactions` accepts either
`accountId` or `orgId`.
