# adapter-line

Sven messaging adapter for **Line**.

Receives messages from Line and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Line.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Line |
| **Protocol** | Line Messaging API (webhook) |

## Prerequisites

Requires a Line Developers account and a Messaging API channel.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `LINE_CHANNEL_ACCESS_TOKEN` | Line-specific credential — see platform docs |
| `LINE_CHANNEL_SECRET` | Line-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-line

# Bare metal
npm --workspace services/adapter-line run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
