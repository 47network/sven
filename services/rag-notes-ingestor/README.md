# rag-notes-ingestor

**RAG Notes Ingestor**

Ingests notes from supported apps: Apple Notes (macOS only), Obsidian (vault path), Bear (local SQLite), Notion (API). All sources normalised to plain Markdown before indexing.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

NATS, RAG Indexer, platform APIs

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
NOTES_SOURCE (apple|obsidian|bear|notion), NOTION_API_KEY, OBSIDIAN_VAULT_PATH
NOTES_INGEST_INTERVAL_MS (positive integer milliseconds; invalid values fail startup)
```

## Running

```bash
# Via Docker Compose
docker compose up -d rag-notes-ingestor

# Bare metal
npm --workspace services/rag-notes-ingestor run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
