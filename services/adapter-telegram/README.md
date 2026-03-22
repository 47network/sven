# adapter-telegram

Sven messaging adapter for **Telegram**.

Receives messages from Telegram and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Telegram.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Telegram |
| **Protocol** | grammY (polling or webhook) |

## Prerequisites

Works in polling mode locally. Set TELEGRAM_WEBHOOK_URL for production.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `TELEGRAM_BOT_TOKEN` | Telegram-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-telegram

# Bare metal
npm --workspace services/adapter-telegram run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
