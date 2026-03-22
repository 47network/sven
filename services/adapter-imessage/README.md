# adapter-imessage

Sven messaging adapter for **iMessage**.

Receives messages from iMessage and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to iMessage.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | iMessage |
| **Protocol** | BlueBubbles REST API |

## Prerequisites

Requires a running BlueBubbles server on a macOS machine with Messages.app.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `BLUEBUBBLES_URL` | iMessage-specific credential — see platform docs |
| `BLUEBUBBLES_PASSWORD` | iMessage-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-imessage

# Bare metal
npm --workspace services/adapter-imessage run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
