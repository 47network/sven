# adapter-matrix

Sven messaging adapter for **Matrix**.

Receives messages from Matrix and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Matrix.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Matrix |
| **Protocol** | matrix-js-sdk (E2E encrypted) |

## Prerequisites

Supports E2E encrypted rooms. Uses a dedicated bot account on the homeserver.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `MATRIX_HOMESERVER_URL` | Matrix-specific credential — see platform docs |
| `MATRIX_ACCESS_TOKEN` | Matrix-specific credential — see platform docs |
| `MATRIX_USER_ID` | Matrix-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-matrix

# Bare metal
npm --workspace services/adapter-matrix run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
