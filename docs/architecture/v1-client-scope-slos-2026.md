# Sven v1 Client Scope + SLOs (2026)

Date: 2026-02-13

## 1) v1 Scope by Client

### Mobile (`apps/companion-mobile`)
- Device auth bootstrap and session restore.
- Chat timeline read + message send.
- Approval queue read + approve/deny actions.
- Voice capture path and push token registration.
- Basic camera capture flow.

Out of v1:
- Local Bonjour discovery production path.
- Multi-account switching.

### Web Admin (`apps/admin-ui`)
- Admin auth/session.
- Governance and controls: users/chats/channels/policies/model governance.
- Operational views: performance, incidents, backups, workflow runs.
- Knowledge graph management and analytics.

Out of v1:
- Full offline-admin capability.

### Web Canvas (`apps/canvas-ui`)
- Primary conversation/timeline + canvas rendering.
- Stream-oriented assistant interaction.
- Basic command/control surface integration.

Out of v1:
- Advanced collaborative multiplayer editing.

### Desktop (`apps/companion-desktop-tauri`, planned)
- Device auth.
- Chat send/read.
- Approval polling + notifications.
- Secure local config and token storage.

Out of v1:
- Full plugin marketplace.

### CLI (`packages/cli`)
- Interactive session mode with streaming output.
- Non-interactive script mode with stable exit codes.
- Profile/env switching and auth bootstrap.

Out of v1:
- Remote multi-agent orchestration UX parity with web admin.

## 2) Supported Platform Matrix (Release Target)

### Mobile
- iOS: latest 2 major versions.
- Android: API 29+ (Android 10+), focus on 31+ for primary QA.

### Web
- Chrome (latest stable + previous).
- Edge (latest stable + previous).
- Safari (latest stable + previous).
- Firefox (latest stable + previous) for admin read workflows.

### Desktop
- Windows 11 (primary), Windows 10 (best-effort).
- Ubuntu 22.04+ (primary Linux reference).

### CLI
- Windows (PowerShell/CMD).
- Linux (bash/sh).
- macOS (zsh/bash).

## 3) Performance SLO Targets

### Mobile
- Cold start p95 <= 2.5s on reference devices.
- Warm start p95 <= 1.0s.
- First token stream render p95 <= 1.5s after send (healthy backend).
- Crash-free sessions >= 99.5%.

### Web (Admin + Canvas)
- Initial route interactive p95 <= 2.0s on broadband.
- API action response feedback <= 300ms for optimistic UI updates.
- Dashboard data refresh p95 <= 1.0s for primary cards.

### Desktop
- App launch p95 <= 2.0s.
- Notification delivery latency p95 <= 2.0s from backend event.

### CLI
- Command startup p95 <= 500ms for local help/status commands.
- Streaming first token p95 <= 1.2s in healthy backend conditions.

## 4) Reliability/Safety SLO Targets

- Approval action end-to-end success rate >= 99.9%.
- Device auth completion success >= 99.5% (excluding user cancellation/timeouts).
- Token refresh failure rate <= 0.1% on healthy identity provider.
- Client-side unauthorized state recovery (forced re-auth) < 3 user actions.

