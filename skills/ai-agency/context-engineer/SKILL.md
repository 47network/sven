---
name: context-engineer
description: Optimize prompts and context windows to reduce token usage while preserving quality.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user wants to optimize prompts, reduce context size, or improve token efficiency.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [optimize, analyze, chunk]
    text:
      type: string
    max_tokens:
      type: number
    strategy:
      type: string
      enum: [remove_redundancy, summarize_sections, prioritize_recent, extract_key_facts]
  required: [action, text]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# context-engineer

Optimizes prompts and context windows for token efficiency.
Analyzes content for redundancy, prioritizes key information,
and restructures for maximum information density.
