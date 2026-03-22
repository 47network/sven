# D5.5 Voice Shortcuts - Phase 1 (2026-02-22)

## Scope

Implemented first-slice direct voice shortcuts to Home Assistant actions without full LLM round-trip.

## Changes

- Runtime parser + shortcut handling:
  - `services/agent-runtime/src/voice-shortcuts.ts`
  - `services/agent-runtime/src/index.ts` (`maybeHandleVoiceShortcut`)
  - Supported intents:
    - lights off/on
    - switch off/on
  - Directly publishes `tool.run.request` for `ha.call_service` when allowed.

- Policy and approval path:
  - Shortcut execution still runs through policy evaluation (`ha.write`).
  - If approval is required, approval is created and user gets approval guidance.

- Settings defaults:
  - `services/gateway-api/src/db/migrations/131_voice_shortcuts_settings.sql`
  - Rollback:
  - `services/gateway-api/src/db/rollbacks/131_voice_shortcuts_settings.sql`
  - Keys:
    - `voice.shortcuts.enabled` (default `false`)
    - `voice.shortcuts.allowedServices` (allowlisted HA services)

## Local verification

- Added test:
  - `services/gateway-api/src/__tests__/voice-shortcuts.test.ts`
- Confirms:
  - runtime includes shortcut handler before LLM flow
  - parser includes core shortcut intents
  - migration provides settings defaults
