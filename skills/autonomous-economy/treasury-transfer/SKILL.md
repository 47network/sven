---
name: treasury-transfer
description: Transfer funds between treasury accounts. Uses approval tiers (auto ≤$5, notify $5–$50, approve >$50). Supports credits, debits, and inter-account transfers.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [transfer, credit, debit]
    fromAccountId:
      type: string
    toAccountId:
      type: string
    amount:
      type: number
    currency:
      type: string
      enum: [USD, ETH]
    kind:
      type: string
    source:
      type: string
    treasuryApi:
      type: string
  required: [action, amount]
outputs_schema:
  type: object
---

# treasury-transfer

Moves funds between treasury accounts or credits/debits a single account.

- `action=transfer` requires both `fromAccountId` and `toAccountId`.
- `action=credit` credits `toAccountId`.
- `action=debit` debits `fromAccountId`.

All operations respect approval tiers: auto ≤$5, notify $5–$50, approve >$50.
