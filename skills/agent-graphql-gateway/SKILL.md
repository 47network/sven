---
skill: agent-graphql-gateway
version: 1.0.0
triggers:
  - graphql_publish_schema
  - graphql_register_operation
  - graphql_set_cache_rule
  - graphql_check_breaking
  - graphql_analyze_ops
  - graphql_report
intents:
  - manage GraphQL schema federation
  - track operation performance
  - configure query caching rules
outputs:
  - schema publication confirmations
  - breaking change detection alerts
  - operation analytics and latency reports
  - cache hit/miss statistics
---
# Agent GraphQL Gateway
Manages federated GraphQL schema composition, operation tracking with latency percentiles, and intelligent query caching with scope-aware TTLs.
