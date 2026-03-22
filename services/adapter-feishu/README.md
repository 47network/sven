# adapter-feishu

Sven messaging adapter for **Feishu / Lark**.

Receives messages from Feishu / Lark and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Feishu / Lark.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Feishu / Lark |
| **Protocol** | Feishu Bot API (webhook + long-poll) |

## Prerequisites

Works with both Feishu (China) and Lark (international) deployments.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `FEISHU_APP_ID` | Feishu / Lark-specific credential — see platform docs |
| `FEISHU_APP_SECRET` | Feishu / Lark-specific credential — see platform docs |
| `FEISHU_VERIFICATION_TOKEN` | Feishu / Lark-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-feishu

# Bare metal
npm --workspace services/adapter-feishu run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
