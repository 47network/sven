---
name: db-query-optimizer
description: Analyze SQL queries — suggest indexes, detect N+1 patterns, explain execution plans.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user wants to optimize SQL queries, analyze database performance, or get index suggestions.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [analyze, suggest_indexes, detect_antipatterns, explain_plan]
    query:
      type: string
    schema:
      type: string
    dialect:
      type: string
      enum: [postgresql, mysql, sqlite]
  required: [action, query]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# db-query-optimizer

Analyzes SQL queries for performance issues — suggests indexes,
detects anti-patterns (N+1, SELECT *, missing WHERE),
and provides execution plan guidance.
