# D5.1 Continuous Conversation Mode - Phase 1 (2026-02-22)

## Scope

Implemented first-slice continuous conversation mode for Canvas voice interactions:

- Time-bounded continuous voice sessions.
- Follow-up voice requests can skip wake-word while session is active.
- Session lifecycle APIs (start/status/stop).
- Org/global settings for enablement and TTL.

## Backend changes

- Migration:
  - `services/gateway-api/src/db/migrations/127_voice_continuous_conversation.sql`
  - Rollback:
  - `services/gateway-api/src/db/rollbacks/127_voice_continuous_conversation.sql`

- Canvas routes:
  - `services/gateway-api/src/routes/canvas.ts`
  - Added:
    - `POST /v1/chats/:chatId/voice/continuous/start`
    - `GET /v1/chats/:chatId/voice/continuous/status`
    - `POST /v1/chats/:chatId/voice/continuous/stop`
  - Updated:
    - `POST /v1/chats/:chatId/wake-word` now accepts `continuous_session_id`.
    - Session-aware behavior:
      - accepts wake-word as usual
      - if enabled and valid session is supplied, allows follow-up without wake-word
      - successful wake-word flow creates/refreshes session TTL

## Settings

- Added defaults in global settings:
  - `voice.continuousConversation.enabled = false`
  - `voice.continuousConversation.ttlSeconds = 180`

## Tests

- Added:
  - `services/gateway-api/src/__tests__/voice-continuous-conversation.e2e.ts`
- Scenario:
  - enable setting
  - create chat
  - start continuous session
  - verify status active
  - stop session
  - verify status inactive
