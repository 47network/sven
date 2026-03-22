# adapter-mattermost

Sven messaging adapter for **Mattermost**.

Receives messages from Mattermost and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Mattermost.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Mattermost |
| **Protocol** | Mattermost Bot API |

## Prerequisites

Works with any self-hosted Mattermost instance v7+.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `MATTERMOST_URL` | Mattermost-specific credential — see platform docs |
| `MATTERMOST_BOT_TOKEN` | Mattermost-specific credential — see platform docs |
| `MATTERMOST_TEAM_ID` | Mattermost-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-mattermost

# Bare metal
npm --workspace services/adapter-mattermost run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
