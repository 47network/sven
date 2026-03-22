# adapter-webchat

Sven messaging adapter for **WebChat (Embeddable Widget)**.

Receives messages from WebChat (Embeddable Widget) and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to WebChat (Embeddable Widget).

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | WebChat (Embeddable Widget) |
| **Protocol** | Gateway API WebSocket (direct) |

## Prerequisites

Ships a standalone embed script. Drop into any webpage with a single script tag.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `WEBCHAT_ALLOWED_ORIGINS` | WebChat (Embeddable Widget)-specific credential — see platform docs |
| `WEBCHAT_AGENT_ID` | WebChat (Embeddable Widget)-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-webchat

# Bare metal
npm --workspace services/adapter-webchat run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
