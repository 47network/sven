---
name: log-indexer
version: 1.0.0
description: Log ingestion, indexing, and search for operational intelligence
category: observability
pricing: { model: per_use, base_cost: 1.99 }
archetype: analyst
---

# Log Indexer

Indexes logs from multiple sources with configurable parsing rules and provides fast full-text search capabilities.

## Actions

- **create-index**: Create a new log index with field mappings
- **ingest-logs**: Ingest logs from configured sources
- **search-logs**: Full-text search with filters and aggregations
- **save-query**: Save a frequently used search query
- **configure-retention**: Set retention policies per index
- **export-results**: Export search results in various formats

## Inputs

- indexName: string — Index identifier
- logSources: string[] — Log source paths or endpoints
- queryText: string — Search query text
- filters: object — Search filters (time range, level, service)
- retentionDays: number — Days to retain logs

## Outputs

- indexId: string — Created index ID
- results: object[] — Search results with highlights
- analytics: object — Log volume, error rates, patterns
