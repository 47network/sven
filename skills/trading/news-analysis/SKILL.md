---
name: news-analysis
description: Analyse financial news for trading impact. Classifies severity, extracts entities, scores sentiment, and generates LLM-powered trade assessments.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [analyze, classify, sentiment, entities, llm_analysis]
    headline:
      type: string
    body:
      type: string
    source:
      type: string
    url:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# news-analysis

Analyse financial and crypto news for trade impact — impact classification (1–5), sentiment scoring, entity extraction, and LLM-powered deep analysis for high-impact events.
