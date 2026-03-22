# Desktop Migration Plan: Electron -> Tauri

Date: 2026-02-13

## Goal

Replace `apps/companion-desktop` (Electron) with a Tauri desktop app while preserving:
- device auth flow
- approvals polling/notifications
- chat send + status surfaces
- Windows/Linux packaging

## Phases

1. Scaffold Tauri app shell
- Create `apps/companion-desktop-tauri`.
- Reuse existing renderer UX concepts, but with stricter webview permissions.

2. Port core features
- Config storage in secure OS-backed store.
- Device flow start/poll.
- Approval polling + local notifications.
- Chat send and conversation state.

3. Security hardening
- Restrict allowed commands in `tauri.conf`.
- Restrict external URL navigation and protocol handling.
- Disable unneeded plugins/APIs.
- Add signed build pipeline and release provenance.

4. Packaging and rollout
- Produce Windows/Linux artifacts.
- Beta rollout behind feature flag.
- Deprecate Electron app after parity confirmation.

## Security Acceptance Criteria

- No plaintext tokens in app files.
- Least privilege for filesystem/network access.
- CSP and origin allowlist enforced.
- Signed binaries and verifiable release metadata.
- Security smoke tests pass in CI.

## Exit Criteria

- Feature parity with current companion desktop.
- Better cold start and memory footprint than Electron baseline.
- Pass `docs/security/ui-app-security-baseline.md` controls.
