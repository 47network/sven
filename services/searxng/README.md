# searxng

**SearXNG**

Self-hosted privacy-respecting meta search engine. Used by the web-fetch tool for private web search. No queries are logged or leaked to external services. The egress proxy routes all search engine requests outbound.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

Egress Proxy

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
SEARXNG_SECRET_KEY, SEARXNG_BASE_URL
```

## Running

```bash
# Via Docker Compose
docker compose up -d searxng

# Bare metal
npm --workspace services/searxng run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
