---
name: risk-assessment
description: Evaluate pre-trade risk rules, calculate position sizing, check circuit breakers, and assess portfolio exposure. Enforces all risk limits before any trade.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [check_signal, position_size, circuit_breakers, exposure, drawdown, full_assessment]
    symbol:
      type: string
    direction:
      type: string
      enum: [long, short, close]
    strength:
      type: number
    entry_price:
      type: number
    stop_loss:
      type: number
    capital:
      type: number
    risk_pct:
      type: number
    win_rate:
      type: number
    avg_win:
      type: number
    avg_loss:
      type: number
    equity_curve:
      type: array
      items:
        type: number
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# risk-assessment

Pre-trade risk checks, position sizing calculations, circuit breaker evaluation, and portfolio exposure analysis. Enforces all risk limits.
