# rag-git-ingestor

**RAG Git Ingestor**

Clones and indexes Git repositories for agent context. Supports public and private repos, incremental updates (new commits only), and configurable file type filters.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

NATS, RAG Indexer, Git

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
RAG_GIT_REPOS (JSON array of repo configs)
GIT_INGEST_INTERVAL_MS (positive integer milliseconds; invalid values fail startup)
```

Private remote repos are authenticated using Git HTTP authorization headers (not tokenized clone URLs) to avoid credential leakage in command/error paths.

## Running

```bash
# Via Docker Compose
docker compose up -d rag-git-ingestor

# Bare metal
npm --workspace services/rag-git-ingestor run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
