# D5.3 Voice Emotion Detection - Phase 1 (2026-02-22)

## Scope

Implemented first-slice voice emotion detection and tone adaptation:

- Heuristic emotion inference from voice transcripts.
- Persisted emotion signals for audit/analytics.
- Emotion metadata propagation to runtime.
- Runtime tone adaptation prompt hints from emotion metadata.
- Canvas wake-word route can pass client emotion hints (setting-gated).

## Backend changes

- Migration:
  - `services/gateway-api/src/db/migrations/129_voice_emotion_detection.sql`
  - Rollback:
  - `services/gateway-api/src/db/rollbacks/129_voice_emotion_detection.sql`

- STT worker:
  - `services/faster-whisper/src/index.ts`
  - Added:
    - `detectEmotionFromTranscript(...)` heuristic
    - `isEmotionDetectionEnabled(...)` setting/env gate
    - persistence into `voice_emotion_signals`
    - outbound `metadata.emotion` in transcribed inbound event

- Canvas route:
  - `services/gateway-api/src/routes/canvas.ts`
  - `POST /v1/chats/:chatId/wake-word` accepts:
    - `emotion_label`
    - `emotion_confidence`
  - Forwards emotion hint in metadata when `voice.emotionDetection.enabled=true`.

- Runtime:
  - `services/agent-runtime/src/index.ts`
  - Added `buildEmotionToneHint(...)`:
    - reads `metadata.emotion`
    - applies tone adaptation instructions when `voice.emotionDetection.adjustTone=true`

## Settings defaults

- `voice.emotionDetection.enabled = false`
- `voice.emotionDetection.adjustTone = true`

## Tests

- Added local verification test:
  - `services/gateway-api/src/__tests__/voice-emotion-detection.test.ts`
- Verifies:
  - gateway wake-word emotion fields + forwarding
  - STT emotion inference/persistence hooks
  - runtime tone adaptation hook
  - migration defaults/table
