# adapter-google-chat

Sven messaging adapter for **Google Chat**.

Receives messages from Google Chat and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Google Chat.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Google Chat |
| **Protocol** | Google Chat API (webhook or bot) |

## Prerequisites

Requires a Google Cloud project with the Chat API enabled and a service account.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `GOOGLE_CHAT_PROJECT_ID` | Google Chat-specific credential — see platform docs |
| `GOOGLE_CHAT_SERVICE_ACCOUNT_KEY` | Google Chat-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-google-chat

# Bare metal
npm --workspace services/adapter-google-chat run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
