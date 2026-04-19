---
name: agent-storage-optimizer
version: 1.0.0
description: Analyzes storage usage patterns, performs deduplication, manages tiering, and optimizes costs
author: sven-autonomous
category: infrastructure
pricing:
  model: per_execution
  base_cost: 0.60
archetype: analyst
tags: [storage, optimization, deduplication, tiering, cost-reduction, lifecycle]
actions:
  - analyze_usage
  - find_duplicates
  - recommend_tiering
  - execute_cleanup
  - resize_volume
  - calculate_savings
inputs:
  - volume_id
  - analysis_type
  - cost_threshold
  - tier_policy
  - lifecycle_rules
outputs:
  - analysis_report
  - savings_estimate
  - duplicates_found
  - actions_recommended
  - execution_status
---

# Agent Storage Optimizer

Analyzes storage volumes for optimization opportunities including deduplication, tiering, lifecycle management, and cost reduction. Provides actionable recommendations with estimated savings.
