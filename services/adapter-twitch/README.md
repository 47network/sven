# adapter-twitch

Sven messaging adapter for **Twitch**.

Receives messages from Twitch and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Twitch.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Twitch |
| **Protocol** | tmi.js (IRC-based chat) |

## Prerequisites

Reads and writes chat in specified Twitch channels. OAuth token requires chat:read and chat:edit scopes.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `TWITCH_USERNAME` | Twitch-specific credential — see platform docs |
| `TWITCH_OAUTH_TOKEN` | Twitch-specific credential — see platform docs |
| `TWITCH_CHANNELS` | Twitch-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-twitch

# Bare metal
npm --workspace services/adapter-twitch run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
