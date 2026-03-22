# registry-worker

**Registry Worker**

Skill marketplace ingestion pipeline. Validates, quarantines, and indexes new skills submitted by agents or administrators. Manages versioning and approvals for the skill registry.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

NATS, PostgreSQL

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
REGISTRY_WORKER_PORT
REGISTRY_SCAN_INTERVAL_MS (integer milliseconds between 1000 and 86400000; invalid values fail startup)
```

## Running

```bash
# Via Docker Compose
docker compose up -d registry-worker

# Bare metal
npm --workspace services/registry-worker run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
