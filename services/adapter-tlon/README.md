# adapter-tlon

Sven messaging adapter for **Tlon / Urbit**.

Receives messages from Tlon / Urbit and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Tlon / Urbit.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Tlon / Urbit |
| **Protocol** | Urbit Eyre HTTP API |

## Prerequisites

Connects to a running Urbit ship via the Eyre HTTP interface. URBIT_CODE is the +code from the ship.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `URBIT_URL` | Tlon / Urbit-specific credential — see platform docs |
| `URBIT_CODE` | Tlon / Urbit-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-tlon

# Bare metal
npm --workspace services/adapter-tlon run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
