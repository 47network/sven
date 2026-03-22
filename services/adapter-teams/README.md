# adapter-teams

Sven messaging adapter for **Microsoft Teams**.

Receives messages from Microsoft Teams and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Microsoft Teams.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Microsoft Teams |
| **Protocol** | Bot Framework (Bot Builder SDK) |

## Prerequisites

Supports personal chats and team channels. Requires a Bot registration in Azure.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `MICROSOFT_APP_ID` | Microsoft Teams-specific credential — see platform docs |
| `MICROSOFT_APP_PASSWORD` | Microsoft Teams-specific credential — see platform docs |
| `TEAMS_TENANT_ID` | Microsoft Teams-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-teams

# Bare metal
npm --workspace services/adapter-teams run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
