# Voice Call Adapter (Twilio/Telnyx/Plivo/Mock)

The `adapter-voice-call` service provides a provider-agnostic call surface and bridges call events into Sven chat timelines.

## Supported providers

- `mock` (default, local testing)
- `twilio`
- `telnyx`
- `plivo`

## Start with Docker profile

```bash
docker compose --profile voice-call up -d adapter-voice-call
```

## Required env vars

- `SVEN_ADAPTER_TOKEN` (gateway adapter auth)
- `VOICE_CALL_PROVIDER` (`mock|twilio|telnyx|plivo`)
- `VOICE_CALL_PUBLIC_BASE_URL` (public URL for provider webhooks)
- `VOICE_CALL_API_KEY` (protect outbound call API)
- `VOICE_CALL_REQUIRE_APPROVAL` (`true` by default)

Provider-specific:
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_TWIML_URL`
- Telnyx: `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`
- Plivo: `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_ANSWER_URL`

## API

### Outbound call

`POST /v1/calls/outbound` (header `x-voice-api-key`)

Body:

```json
{
  "provider": "mock",
  "to": "+15555550100",
  "from": "+15555550999",
  "approval_id": "approval-uuid",
  "chat_id": "chat-uuid",
  "sender_identity_id": "identity-uuid",
  "metadata": {
    "ticket": "inc-42"
  }
}
```

If `VOICE_CALL_REQUIRE_APPROVAL=true`, `approval_id` must be an approved record matching:
- `tool_name = voice.call.place`
- `scope = voice.write`

### Provider webhook

`POST /v1/providers/:provider/webhook`

Adapter normalizes webhook payloads and forwards:
- transcript -> `/v1/events/message`
- recording URL -> `/v1/events/audio` with `transcribe=true`

This keeps approvals/audit/timeline behavior consistent with existing channel adapters.
