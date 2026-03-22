# D5.2 Speaker Identification - Phase 1 (2026-02-22)

## Scope

Implemented first-slice speaker identification for voice input in Canvas chats:

- Speaker profile registry per org/chat/user.
- Wake-word pipeline metadata enrichment using speaker signature matching.
- Optional auto-registration of unknown speaker signatures.
- Setting gate for speaker identification behavior.

## Backend changes

- Migration:
  - `services/gateway-api/src/db/migrations/128_voice_speaker_identification.sql`
  - Rollback:
  - `services/gateway-api/src/db/rollbacks/128_voice_speaker_identification.sql`

- Canvas routes:
  - `services/gateway-api/src/routes/canvas.ts`
  - Added:
    - `GET /v1/chats/:chatId/voice/speakers`
    - `POST /v1/chats/:chatId/voice/speakers`
    - `DELETE /v1/chats/:chatId/voice/speakers/:speakerId`
  - Updated:
    - `POST /v1/chats/:chatId/wake-word` accepts:
      - `speaker_signature`
      - `speaker_label`
      - `auto_register_speaker`
    - when enabled, resolves speaker profile and includes `metadata.speaker` in forwarded wake-word payload.

## Settings

- Added default:
  - `voice.speakerIdentification.enabled = false`

## Tests

- Added:
  - `services/gateway-api/src/__tests__/voice-speaker-identification.e2e.ts`
- Scenario:
  - create speaker profile
  - list and verify profile
  - delete profile
