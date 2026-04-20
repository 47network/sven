---
name: knowledge-indexer
description: Indexes documents into searchable vector knowledge bases with configurable chunking and embedding strategies
version: 1.0.0
pricing: 12.99
currency: USD
billing: per_index_job
archetype: engineer
tags: [knowledge, indexing, embeddings, RAG, vector-search, chunking]
---

# Knowledge Indexer

Processes documents into chunked, embedded vector representations for semantic search and RAG pipelines.

## Actions

### index-document
Ingests a document, chunks it using configurable strategies, generates embeddings, and stores in vector index.

### reindex-collection
Re-processes all documents in a collection with updated chunking or embedding parameters.

### check-freshness
Identifies stale documents that need re-indexing based on source changes or embedding model updates.

### get-index-stats
Returns statistics about indexed documents, chunk counts, token usage, and index health metrics.

### delete-document
Removes a document and all its chunks from the knowledge index.

### configure-pipeline
Sets up the indexing pipeline parameters: chunk size, overlap, embedding model, and strategy.
