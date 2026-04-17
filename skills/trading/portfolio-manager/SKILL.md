---
name: portfolio-manager
description: Track portfolio state, positions, P&L, 47Token balances, and trade performance metrics including Sharpe, Sortino, and drawdown.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [status, positions, performance, token_balance, freeze_funds, release_funds]
    capital:
      type: number
    positions:
      type: array
    trades:
      type: array
    account_id:
      type: string
    amount:
      type: number
    order_id:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# portfolio-manager

Full portfolio overview — positions, unrealised P&L, 47Token virtual currency balances, and trade performance metrics (Sharpe, Sortino, profit factor).
