# Sven Companion Desktop (Tauri)

Production desktop target replacing Electron for Windows/Linux.

## Core Features

- Device auth bootstrap (`/v1/auth/device/start`, `/v1/auth/device/token`)
- Session refresh rotation (`/v1/auth/refresh`)
- Chat send (`/v1/chats/:chat_id/messages`)
- Approval polling (`/v1/approvals?status=pending`)
- Secure token storage via OS keyring (`keyring` crate)

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
