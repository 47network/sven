# adapter-nostr

Sven messaging adapter for **Nostr**.

Receives messages from Nostr and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Nostr.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Nostr |
| **Protocol** | nostr-tools relay connection |

## Prerequisites

Publishes and subscribes to kind-1 events on configured relays. NOSTR_PRIVATE_KEY must be a hex nsec.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `NOSTR_PRIVATE_KEY` | Nostr-specific credential — see platform docs |
| `NOSTR_RELAY_URLS` | Nostr-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-nostr

# Bare metal
npm --workspace services/adapter-nostr run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
