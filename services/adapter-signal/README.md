# adapter-signal

Sven messaging adapter for **Signal**.

Receives messages from Signal and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Signal.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Signal |
| **Protocol** | signal-cli REST API bridge |

## Prerequisites

Requires a running signal-cli instance linked to a registered Signal number.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `SIGNAL_CLI_URL` | Signal-specific credential — see platform docs |
| `SIGNAL_PHONE_NUMBER` | Signal-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-signal

# Bare metal
npm --workspace services/adapter-signal run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
