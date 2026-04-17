---
name: strategy-manager
description: Manage trading strategies — create, list, enable/disable, adjust parameters, and monitor performance of active strategies in the autonomous trading loop.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [list, details, enable, disable, add_custom, set_weights, loop_config]
    strategy_id:
      type: string
    name:
      type: string
    description:
      type: string
    min_timeframe:
      type: string
    source_weights:
      type: object
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# strategy-manager

Manage the strategy registry — list, inspect, enable/disable strategies, define custom strategies, adjust signal source weights, and configure the autonomous trading loop.
