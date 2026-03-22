# D5 Voice Call Integration (Phase 1) — 2026-02-22

## Scope
- Add a local, testable gateway path to place outbound phone calls through `adapter-voice-call`.
- Keep receive path aligned with existing adapter webhook ingestion.

## Implemented
- Canvas API route:
  - `POST /v1/chats/:chatId/voice/calls/outbound`
  - File: `services/gateway-api/src/routes/canvas.ts`
  - Behavior:
    - Requires authenticated chat membership.
    - Requires active org context.
    - Gated by `voice.call.enabled`.
    - Resolves canvas identity and forwards outbound request to adapter.
    - Relays adapter errors (including approval-required/approval-invalid) to caller.
- Settings + tool migration:
  - File: `services/gateway-api/src/db/migrations/132_voice_call_integration.sql`
  - Adds `voice.call.enabled` default (`false`).
  - Registers `voice.call.place` with `voice.write` permission scope.
- Local verification test:
  - File: `services/gateway-api/src/__tests__/voice-call-integration.test.ts`

## Local Validation
- Command:
  - `npm run test -- --runTestsByPath src/__tests__/voice-call-integration.test.ts`
  - (run in `services/gateway-api`)
- Result:
  - `PASS src/__tests__/voice-call-integration.test.ts`
  - `3 passed, 0 failed`

## Notes
- Adapter receive path already exists in:
  - `services/adapter-voice-call/src/index.ts`
  - `POST /v1/providers/:provider/webhook` normalizes inbound provider events and emits chat/audio events into gateway.
- Phase 2 can add end-to-end provider simulation and UI controls for initiating calls.
