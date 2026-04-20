---
name: memory-remember
version: 1.0.0
description: >
  Persistent cross-session memory management. Store, retrieve, compress,
  and forget memories across conversation sessions. Three-tier hierarchy
  (working → episodic → semantic) with automatic decay, reinforcement,
  and compression for 95%+ token savings.
author: sven-system
license: proprietary
archetype: operator
pricing:
  base: 0.00
  unit: per-operation
  currency: EUR
inputs:
  - name: action
    type: enum
    required: true
    values: [remember, recall, compress, forget, reinforce, stats]
    description: Memory operation to perform
  - name: content
    type: string
    required: false
    description: >
      Content to remember (for 'remember' action).
      Query string (for 'recall' action).
  - name: category
    type: enum
    required: false
    values: [preference, decision, pattern, constraint, architecture, correction, convention, fact, relationship, project_state, learning]
    description: Memory category for filtering or classification
  - name: tier
    type: enum
    required: false
    values: [working, episodic, semantic]
    description: Target tier for storage or retrieval filtering
  - name: method
    type: enum
    required: false
    values: [keyword, semantic, recency, hybrid]
    description: Retrieval method (for 'recall' action)
  - name: topK
    type: integer
    required: false
    default: 10
    description: Maximum number of memories to return on recall
  - name: memoryId
    type: string
    required: false
    description: Specific memory ID (for 'reinforce' or 'forget' actions)
  - name: sourceTier
    type: enum
    required: false
    values: [working, episodic]
    description: Source tier for compression
  - name: keywords
    type: array
    required: false
    description: Explicit keywords to tag the memory with
outputs:
  - name: memoryId
    type: string
    description: ID of stored or affected memory
  - name: memories
    type: array
    description: Retrieved memories (for 'recall' action)
  - name: tokensInjected
    type: integer
    description: Number of tokens injected into context
  - name: compressionResult
    type: object
    description: Compression job outcome (sourceCount, outputCount, tokensSaved, ratio)
  - name: stats
    type: object
    description: Memory stats (counts per tier, total tokens, decay distribution)
actions:
  - name: remember
    description: >
      Store a new memory in the working tier. Automatically categorized
      and keyword-tagged. Detects "remember this" / "remember that" natural
      language patterns. Deduplicates against existing memories via Jaccard
      similarity.
  - name: recall
    description: >
      Retrieve relevant memories for a query. Uses hybrid retrieval by default:
      keyword matching + recency weighting + semantic tier boosting. Returns
      ranked list with effective confidence scores.
  - name: compress
    description: >
      Trigger compression of aged working memories into episodic summaries,
      or aged episodic memories into semantic facts. Achieves 5:1 to 20:1
      compression ratios. Tracks compression jobs for audit.
  - name: forget
    description: >
      Remove a specific memory by ID, or bulk-forget by category/tier
      with optional confidence threshold. Respects memory consent settings.
  - name: reinforce
    description: >
      Boost a memory's confidence and reset its decay timer. Used when a
      memory proves useful or is re-confirmed by the user.
  - name: stats
    description: >
      Return memory statistics: counts per tier and category, total token
      usage, average decay, compression history, retrieval effectiveness.
tags:
  - memory
  - persistence
  - context
  - compression
  - retrieval
  - cross-session
  - token-efficiency
---

# Memory Remember Skill

Manages Sven's persistent cross-session memory using a three-tier hierarchy:

1. **Working** (7-day TTL): Full-detail recent memories — raw extractions from conversations
2. **Episodic** (90-day TTL): Compressed summaries of related working memories
3. **Semantic** (permanent): Distilled core facts, preferences, and decisions

## Memory Lifecycle

```
User conversation → Extract (MemoryExtractor) → Working tier
Working tier (aged 7+ days) → Compress → Episodic tier
Episodic tier (aged 90+ days) → Compress → Semantic tier
```

## Compression Strategy

- Groups related working memories by category + keyword overlap
- Summarizes groups into single episodic memories (5:1 ratio typical)
- Further distills episodic memories into atomic semantic facts (20:1 ratio)
- Target: 95%+ token reduction for context injection

## Retrieval

Hybrid retrieval combines:
- **Keyword matching**: Fast exact word overlap (Jaccard similarity)
- **Recency weighting**: Exponential decay favoring recent access
- **Tier boosting**: Semantic memories get 1.5× relevance boost
- **Confidence gating**: Only memories above minEffectiveConfidence threshold

## Auto-Injection

When `memory.retrieval.auto_inject` is enabled, relevant memories are
automatically injected into new conversation contexts, giving Sven continuity
across sessions without manual "remember this" commands.

## Token Budget

The system respects a per-conversation token budget for memory injection,
preventing context overflow while maximizing useful recall.
