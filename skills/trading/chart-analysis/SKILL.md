---
name: chart-analysis
description: Perform technical analysis on price charts — detect patterns, calculate indicators (SMA, RSI, MACD, Bollinger Bands), and identify support/resistance levels.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [indicators, patterns, support_resistance, trend, full_analysis]
    symbol:
      type: string
    timeframe:
      type: string
      enum: ['1m', '5m', '15m', '1h', '4h', '1d']
    prices:
      type: array
      items:
        type: number
    period:
      type: number
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# chart-analysis

Technical analysis toolkit — SMA, RSI, MACD, Bollinger Bands, support/resistance levels, candlestick pattern detection, and trend analysis.
