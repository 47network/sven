# UI Preferences Sync Policy

Date: 2026-02-16
Scope: Flutter user app preference sync with backend profile.

## Policy

- Conflict strategy: server-wins on startup; client writes override on change.
- Safe defaults: cinematic visual mode, motion full, orb avatar.
- Client only sends documented fields: `visual_mode`, `avatar_mode`, `motion_enabled`.
- Client accepts `motion_level` if present and maps it to motion profile.

## Sync Flow

1. Load local preferences.
2. If authenticated, fetch `/v1/me/ui-preferences` and apply (server-wins).
3. On any local change, push to backend with `PUT /v1/me/ui-preferences`.

## Failure Handling

- Network errors do not block local changes.
- Server errors do not prevent UI updates; retry on next change.
