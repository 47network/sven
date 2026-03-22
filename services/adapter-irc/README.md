# adapter-irc

Sven messaging adapter for **IRC**.

Receives messages from IRC and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to IRC.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | IRC |
| **Protocol** | irc.js |

## Prerequisites

Connects to any IRC network. Supports SASL authentication and TLS.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `IRC_SERVER` | IRC-specific credential — see platform docs |
| `IRC_PORT` | IRC-specific credential — see platform docs |
| `IRC_NICKNAME` | IRC-specific credential — see platform docs |
| `IRC_CHANNELS` | IRC-specific credential — see platform docs |
| `IRC_PASSWORD` | IRC-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-irc

# Bare metal
npm --workspace services/adapter-irc run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
