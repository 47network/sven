# Sven Companion Desktop (Tauri)

## Current live status

- Native build: passes locally
- Live API contract: verified for device login, chat send, timeline fetch, and approval vote
- Rendered desktop shell: launches and renders on Linux
- Session restore: resilient on Linux via OS keyring plus local fallback mirror for environments where Secret Service is flaky under automation

## Linux launch note

If you start the companion from a Snap-hosted shell (for example VS Code
Insiders from Snap), Snap GTK/glibc paths can leak into the Tauri process and
cause native symbol errors even though Sven itself is healthy.

Use the clean launcher from the app root:

```bash
./run-clean.sh
```

The clean launcher preserves `DBUS_SESSION_BUS_ADDRESS` and `XDG_RUNTIME_DIR`
so Sven can still access the user session bus and secure storage while avoiding
Snap GTK/glibc leakage.

If the binary does not exist yet, build it first:

```bash
cd src-tauri
cargo build
```

Production desktop target replacing Electron for Windows/Linux.

## Core Features

- Device auth bootstrap (`/v1/auth/device/start`, `/v1/auth/device/token`)
- Session refresh rotation (`/v1/auth/refresh`)
- Chat send (`/v1/chats/:chat_id/messages`)
- Approval polling (`/v1/approvals?status=pending`)
- Secure token storage via OS keyring (`keyring` crate) with local fallback mirror for restore resilience

## Security Controls

- Gateway URL policy:
  - HTTPS required for non-local hosts
  - Local insecure URLs allowed only for local development
- Webview navigation lock:
  - Allows only `tauri://*`, `http://localhost`, `http://127.0.0.1`
  - Blocks external navigation at runtime
- Minimal capability set in `src-tauri/capabilities/default.json`
- No shell/plugin escalation by default

## Development

```bash
npm --prefix apps/companion-desktop-tauri install
npm --prefix apps/companion-desktop-tauri run tauri:dev
```

## Build

```bash
npm --prefix apps/companion-desktop-tauri run tauri:build
```

## Notes

- In production, use HTTPS gateway host.
- For local HTTP testing, keep to localhost/private network endpoints.
- If non-local HTTP is required in test infrastructure, set `SVEN_DESKTOP_ALLOW_INSECURE=1` explicitly.
