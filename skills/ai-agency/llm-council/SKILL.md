---
name: llm-council
description: >
  Multi-model deliberation system. Sends queries to multiple LLMs simultaneously,
  has them peer-review each other's responses anonymously, then a chairman model
  synthesizes the best answer. Supports configurable council composition, voting
  strategies, and cost tracking.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [deliberate, configure_council, get_history, get_stats]
    query:
      type: string
      description: The question or prompt to deliberate on
    system_prompt:
      type: string
      description: Optional system prompt for all council members
    council_id:
      type: string
      description: Specific council configuration ID (uses default if omitted)
    session_id:
      type: string
      description: Session ID for retrieving history
    models:
      type: array
      items: { type: string }
      description: Override model list for this deliberation
    chairman:
      type: string
      description: Override chairman model for synthesis
    rounds:
      type: integer
      description: Number of peer review rounds (default 1)
    anonymize:
      type: boolean
      description: Strip model names during peer review (default true)
    strategy:
      type: string
      enum: [best_of_n, majority_vote, debate, weighted]
      description: Scoring strategy (default weighted)
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# llm-council

Multi-model deliberation system inspired by Karpathy's LLM Council concept.

## Stages

1. **First Opinions** — Query sent to N models in parallel
2. **Peer Review** — Each model reviews anonymized responses, ranks them
3. **Synthesis** — Chairman model compiles final answer from all inputs + rankings

## Usage

```
/council What is the best approach for implementing CRDT-based collaboration?
```
