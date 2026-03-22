# adapter-whatsapp

Sven messaging adapter for **WhatsApp**.

Receives messages from WhatsApp and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to WhatsApp.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | WhatsApp |
| **Protocol** | WhatsApp Business API |

## Prerequisites

Requires a Meta Business account and a verified WhatsApp Business phone number.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `WHATSAPP_API_URL` | WhatsApp-specific credential — see platform docs |
| `WHATSAPP_API_TOKEN` | WhatsApp-specific credential — see platform docs |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp-specific credential — see platform docs |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-whatsapp

# Bare metal
npm --workspace services/adapter-whatsapp run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
