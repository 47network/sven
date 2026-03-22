# egress-proxy

**Egress Proxy**

Outbound HTTP allowlist proxy (Squid). All tool HTTP requests route through this proxy. Only explicitly allowlisted domains are reachable — raw IPs and unlisted domains are blocked.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

None (standalone)

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
SVEN_EGRESS_ALLOWLIST (domain list file path)
```

## Running

```bash
# Via Docker Compose
docker compose up -d egress-proxy

# Bare metal
npm --workspace services/egress-proxy run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
