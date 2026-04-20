---
name: semantic-searcher
description: Performs intelligent semantic search across knowledge bases with reranking and hybrid retrieval
version: 1.0.0
pricing: 0.05
currency: USD
billing: per_query
archetype: analyst
tags: [search, semantic, retrieval, RAG, reranking, hybrid-search]
---

# Semantic Searcher

Executes semantic, keyword, and hybrid searches across indexed knowledge bases with optional reranking for optimal relevance.

## Actions

### search
Performs a semantic search query against one or more knowledge indices, returning ranked results with similarity scores.

### hybrid-search
Combines semantic vector search with keyword BM25 search for comprehensive retrieval coverage.

### rerank-results
Re-scores existing search results using a cross-encoder reranking model for improved precision.

### find-similar
Given a document or chunk, finds semantically similar content across the knowledge base.

### search-with-filters
Performs filtered semantic search with metadata constraints (date range, source, category).

### explain-ranking
Provides explanations for why results were ranked in a particular order.
