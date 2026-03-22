# rag-nas-ingestor

**RAG NAS Ingestor**

Indexes files from a network-attached storage (NAS) or local filesystem path. Supports watch mode for continuous ingestion as files change.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

NATS, RAG Indexer, NAS mount

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
RAG_NAS_PATH, RAG_NAS_WATCH_INTERVAL_MS, RAG_NAS_FILE_EXTENSIONS
NAS_INGEST_INTERVAL_MS (positive integer milliseconds; invalid values fail startup)
```

## Running

```bash
# Via Docker Compose
docker compose up -d rag-nas-ingestor

# Bare metal
npm --workspace services/rag-nas-ingestor run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
