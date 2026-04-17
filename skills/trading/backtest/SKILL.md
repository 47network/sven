---
name: backtest
description: Run strategy backtests against historical candle data. Computes trade log, P&L curve, Sharpe/Sortino ratios, and risk-adjusted performance metrics.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [run, list_strategies, config, summary]
    strategy_id:
      type: string
    symbol:
      type: string
    timeframe:
      type: string
      enum: ['1m', '5m', '15m', '1h', '4h', '1d']
    capital:
      type: number
    risk_pct:
      type: number
    candle_count:
      type: number
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# backtest

Run strategy backtests against historical data. Returns full trade log, equity curve, drawdown analysis, and risk-adjusted performance metrics.
