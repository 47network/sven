---
name: market-data-query
description: Query market data — candles, ticks, orderbook snapshots, and instrument information across multiple exchanges and timeframes.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [candles, instruments, orderbook, validate, gap_detect, sentiment]
    symbol:
      type: string
    timeframe:
      type: string
      enum: ['1m', '5m', '15m', '1h', '4h', '1d', '1w']
    asset_class:
      type: string
      enum: [crypto, equity, forex, commodity, index]
    limit:
      type: number
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# market-data-query

Query live and historical market data. Lists instruments, retrieves candles at multiple timeframes, checks orderbook state, and detects data quality issues.
