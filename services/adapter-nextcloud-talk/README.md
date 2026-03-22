# adapter-nextcloud-talk

Sven messaging adapter for **Nextcloud Talk**.

Receives messages from Nextcloud Talk and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Nextcloud Talk.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Nextcloud Talk |
| **Protocol** | Talk API (polling) |

## Prerequisites

Connects to a self-hosted Nextcloud instance with the Talk app installed.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `NEXTCLOUD_URL` | Nextcloud Talk-specific credential — see platform docs |
| `NEXTCLOUD_USERNAME` | Nextcloud Talk-specific credential — see platform docs |
| `NEXTCLOUD_PASSWORD` | Nextcloud Talk-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-nextcloud-talk

# Bare metal
npm --workspace services/adapter-nextcloud-talk run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
