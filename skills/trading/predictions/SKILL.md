---
name: predictions
description: Generate, query, and evaluate trading predictions using Kronos BSQ models, MiroFish simulations, and ensemble voting across multiple time horizons.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [predict, evaluate, ensemble, multi_horizon, accuracy, tokenize]
    symbol:
      type: string
    horizon:
      type: string
      enum: ['5m', '15m', '1h', '4h', '1d']
    direction:
      type: string
      enum: [up, down, neutral]
    actual_direction:
      type: string
      enum: [up, down, neutral]
    prediction_id:
      type: string
    confidence:
      type: number
    candle:
      type: object
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# predictions

Generate multi-horizon trading predictions using Kronos BSQ tokenization, MiroFish consensus, and weighted ensemble voting. Track accuracy over time.
