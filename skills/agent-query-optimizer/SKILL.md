---
name: agent-query-optimizer
version: 1.0.0
description: SQL query analysis, optimization suggestions, and plan caching
archetype: analyst
pricing: 0.03 per analysis
---

# Query Optimizer

Analyze SQL queries, generate optimization suggestions, and cache execution plans.

## Actions

### analyze-query
Analyze a query's execution plan and performance characteristics

### suggest-optimizations
Generate optimization suggestions (indexes, rewrites, partitioning, etc.)

### cache-plan
Store an optimized execution plan for reuse

### apply-suggestion
Apply an optimization suggestion to the target database

### view-slow-queries
List queries sorted by execution time for optimization prioritization
