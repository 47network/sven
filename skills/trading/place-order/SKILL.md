---
name: place-order
description: Submit, cancel, and manage trading orders through the OMS. Supports market, limit, stop, and trailing stop orders with automatic risk checks.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [create, cancel, status, list, fill_simulate]
    symbol:
      type: string
    side:
      type: string
      enum: [buy, sell]
    order_type:
      type: string
      enum: [market, limit, stop, stop_limit, trailing_stop]
    quantity:
      type: number
    price:
      type: number
    stop_price:
      type: number
    trail_pct:
      type: number
    strategy_id:
      type: string
    order_id:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# place-order

Submit and manage trading orders. Supports multiple order types with mandatory risk checks before submission. Paper trading mode by default.
