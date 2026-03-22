# adapter-discord

Sven messaging adapter for **Discord**.

Receives messages from Discord and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Discord.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Discord |
| **Protocol** | discord.js (Gateway WebSocket) |

## Prerequisites

Supports DMs and guild channels. Enable the Message Content intent in the Discord developer portal.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `DISCORD_BOT_TOKEN` | Discord-specific credential — see platform docs |
| `DISCORD_CLIENT_ID` | Discord-specific credential — see platform docs |
| `DISCORD_GUILD_ID` | Discord-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-discord

# Bare metal
npm --workspace services/adapter-discord run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
