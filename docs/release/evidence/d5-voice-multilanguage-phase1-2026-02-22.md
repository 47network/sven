# D5.4 Multi-language Voice - Phase 1 (2026-02-22)

## Scope

Implemented first-slice multi-language voice behavior:

- STT auto-detect language metadata capture.
- Propagation of detected language through inbound audio metadata.
- Runtime prompt hint to respond in the same language for voice turns.
- Settings defaults for feature control.

## Changes

- Migration:
  - `services/gateway-api/src/db/migrations/130_voice_multilanguage_settings.sql`
  - Rollback:
  - `services/gateway-api/src/db/rollbacks/130_voice_multilanguage_settings.sql`

- STT script:
  - `services/faster-whisper/transcribe.py`
  - emits `detected_language` and `language_probability`.

- STT worker:
  - `services/faster-whisper/src/index.ts`
  - stores `language_detected` / `language_probability` in transcript metadata.
  - forwards language metadata in inbound event payload.
  - honors `voice.multiLanguage.autoDetect` setting.

- Runtime:
  - `services/agent-runtime/src/index.ts`
  - adds `buildVoiceLanguageHint(...)`.
  - if enabled and a voice message includes detected language, instructs model to respond in that language.
  - gated by `voice.multiLanguage.enabled` + `voice.multiLanguage.respondInKind`.

## Defaults

- `voice.multiLanguage.enabled = true`
- `voice.multiLanguage.autoDetect = true`
- `voice.multiLanguage.respondInKind = true`

## Tests

- Added local verification test:
  - `services/gateway-api/src/__tests__/voice-multilanguage.test.ts`
- Verifies:
  - transcribe script outputs detected language fields
  - STT worker propagates language metadata
  - runtime includes respond-in-kind hook
  - migration contains setting defaults
