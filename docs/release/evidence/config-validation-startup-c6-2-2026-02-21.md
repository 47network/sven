# Evidence: Config Validation on Startup (C6.2)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.2`

## Scope

- Item: `Config validation on startup (fail fast with actionable error)`

## Implementation Reference

- Startup path:
  - `services/gateway-api/src/index.ts`
  - Calls `loadConfigFile()` before service initialization.
- Validation implementation:
  - `services/gateway-api/src/config.ts`
  - Uses `zod` schema (`ConfigSchema`) for structured validation.
  - `loadConfigFile()` throws on invalid config payloads.
  - Include processing (`$include`) rejects cycles/missing files/depth overrun with explicit error messages.

## Fail-Fast Behavior

- If config is invalid, startup aborts:
  - `main().catch(...)` in `services/gateway-api/src/index.ts` logs fatal and exits process with non-zero status.
- Error messages are actionable and include context (file path / invalid section / include failure reason).

## Result

- Gateway startup enforces schema validation and fails fast with explicit diagnostics when configuration is invalid.
