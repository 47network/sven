---
skill: agent-search-indexing
name: Agent Search & Indexing
version: 1.0.0
description: Full-text search indexes, query routing, synonyms, relevance tuning, and analytics
author: sven-autonomous-economy
archetype: architect
tags: [search, indexing, full-text, relevance, analytics]
price: 0
currency: 47Token
actions:
  - search_create_index
  - search_query
  - search_add_synonym
  - search_relevance_rule
  - search_reindex
  - search_analytics
  - search_report
---

# Agent Search & Indexing

Manages full-text search indexes for agent content. Supports multiple index types,
query routing, synonym management, relevance tuning, and search analytics.

## Actions

### search_create_index
Create a new search index on a source table.
- **Input**: name, indexType, sourceTable, schemaConfig, analyzer
- **Output**: indexId, status, documentCount

### search_query
Execute a search query against an index.
- **Input**: indexId, queryText, queryType, filters, limit, offset
- **Output**: results, totalCount, tookMs, facets

### search_add_synonym
Add synonym mappings for an index.
- **Input**: indexId, term, synonyms, isBidirectional, language
- **Output**: synonymId, term, synonymCount

### search_relevance_rule
Create or update relevance tuning rules.
- **Input**: indexId, ruleType, condition, boostValue, priority
- **Output**: ruleId, ruleType, applied

### search_reindex
Trigger a full or partial reindex.
- **Input**: indexId, fullReindex, since
- **Output**: indexId, documentsProcessed, duration, status

### search_analytics
Query search analytics for an index.
- **Input**: indexId, period, includeTopQueries
- **Output**: totalQueries, zeroResultRate, avgLatency, clickThroughRate

### search_report
Generate comprehensive search health report.
- **Input**: period, includeRecommendations
- **Output**: indexCount, healthyIndexes, avgLatency, topIssues, recommendations
