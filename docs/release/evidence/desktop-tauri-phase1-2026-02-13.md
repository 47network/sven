# Desktop Tauri Phase 1 (2026-02-13)

## Scope

Implemented `apps/companion-desktop-tauri` as a production-capable desktop app foundation with core v1 flows and security controls.

## Delivered

- New Tauri desktop app:
  - `apps/companion-desktop-tauri/package.json`
  - `apps/companion-desktop-tauri/src/App.tsx`
  - `apps/companion-desktop-tauri/src/lib/api.ts`
  - `apps/companion-desktop-tauri/src-tauri/src/main.rs`
  - `apps/companion-desktop-tauri/src-tauri/tauri.conf.json`
  - `apps/companion-desktop-tauri/src-tauri/capabilities/default.json`
  - `apps/companion-desktop-tauri/README.md`
- Root script wiring:
  - `package.json` (`dev:desktop:tauri`, `build:desktop:tauri`)

## Core Features Ported

- Device auth bootstrap (`/v1/auth/device/start`, `/v1/auth/device/token`)
- Session rotation (`/v1/auth/refresh`)
- Chat send (`/v1/chats/:chat_id/messages`)
- Approval polling (`/v1/approvals?status=pending`)
- Desktop notifications for newly-seen approvals

## Security Controls

- Secure token storage via OS keyring (`keyring` crate) with command-only access.
- Local config persisted separately from credentials.
- Gateway URL guard:
  - HTTPS required for non-local hosts.
  - Local HTTP allowed for dev/local network.
- Restrictive Tauri capabilities (`core:*` default set only).
- CSP in `tauri.conf.json`.
- UI-level external navigation guard (`window.open` override + blocked non-local anchors).

## Validation

- `npm --prefix apps/companion-desktop-tauri run typecheck`
- `cargo check --manifest-path apps/companion-desktop-tauri/src-tauri/Cargo.toml`

Both commands passed on 2026-02-13.

## Remaining (Section G)

- Signed packaging/release pipeline for Windows/Linux artifacts.
- Electron deprecation execution after parity soak.
- Fresh-machine installer verification and signed artifact validation.
