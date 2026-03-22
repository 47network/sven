# adapter-voice-call

Sven messaging adapter for **Voice Call**.

Receives messages from Voice Call and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Voice Call.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Voice Call |
| **Protocol** | SIP / provider HTTP API |

## Prerequisites

Supports inbound and outbound voice calls. Routes call audio through the Whisper STT and Piper TTS services.

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `VOICE_CALL_PROVIDER` | Voice Call-specific credential — see platform docs |
| `VOICE_CALL_API_KEY` | Voice Call-specific credential — see platform docs |
| `VOICE_CALL_FROM` | Voice Call-specific credential — see platform docs |
| `VOICE_CALL_PUBLIC_BASE_URL` | Voice Call-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-voice-call

# Bare metal
npm --workspace services/adapter-voice-call run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
