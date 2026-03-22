# adapter-zalo

Sven messaging adapter for **Zalo**.

Receives messages from Zalo and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Zalo.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Zalo |
| **Protocol** | Zalo Official Account API |

## Prerequisites

Requires a verified Zalo Official Account.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `ZALO_APP_ID` | Zalo-specific credential — see platform docs |
| `ZALO_APP_SECRET` | Zalo-specific credential — see platform docs |
| `ZALO_OA_TOKEN` | Zalo-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-zalo

# Bare metal
npm --workspace services/adapter-zalo run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
