# rag-indexer

**RAG Indexer**

Core vector indexing engine. Embeds text chunks using the LiteLLM embedding endpoint, writes to OpenSearch (BM25 + kNN), and handles incremental re-indexing. Used by all RAG ingestors.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

NATS, OpenSearch, LiteLLM

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
OPENSEARCH_URL, LITELLM_API_BASE, RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP
```

TLS note:
- By default OpenSearch TLS certificate verification is enforced.
- For self-signed development endpoints only, set `OPENSEARCH_TLS_INSECURE=true` to use a Node fetch dispatcher with disabled certificate verification.

## Running

```bash
# Via Docker Compose
docker compose up -d rag-indexer

# Bare metal
npm --workspace services/rag-indexer run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
