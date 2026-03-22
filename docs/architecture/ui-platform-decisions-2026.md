# UI Platform Decisions (2026)

Date: 2026-02-13  
Scope: Sven user-facing apps (mobile, web UI, desktop, CLI)

## Final Engine Choices

1. Mobile (iOS + Android): React Native + Expo
- Keep and harden existing `apps/companion-mobile`.
- Reason: fastest path with current codebase, strong performance with RN New Architecture, mature native integration surface, and good security controls.

2. Web UI + Admin UI: Next.js + React + TypeScript
- Keep and harden existing `apps/admin-ui` and `apps/canvas-ui`.
- Reason: best fit for complex admin controls, observability dashboards, policy/governance panels, and role-based UX.

3. Desktop (Windows + Linux, optional macOS): Tauri (direct)
- Migrate from Electron companion to Tauri-first desktop runtime.
- Reason: lower attack surface, better memory footprint, tighter OS permission model, and premium native feel.

4. CLI: Node.js + TypeScript (`packages/cli`)
- Keep `sven` CLI and upgrade UX to Gemini-class interaction patterns.
- Reason: fastest integration with existing JS/TS services and shared types; straightforward cross-platform distribution.

## Why Not Other Engines (Current Context)

- Flutter: excellent renderer, but migration cost is high relative to current React/TS code and shared package reuse.
- Kotlin Multiplatform / SwiftUI + Jetpack Compose split: best native purity, worst delivery speed for this monorepo.
- Capacitor/Ionic: good web reuse, weaker native-first UX target for premium assistant interactions.

## Premium UX Target (Product Direction)

- Conversational-first layouts with streaming responses and latency masking.
- Native-feel gesture navigation and interaction density tuned for one-hand usage.
- Real-time status surfaces: approvals, tool runs, channel health, incidents.
- Memory-aware UX: session continuity, device handoff, and fast resume.
- Consistent design language across mobile, web, desktop, and CLI.

## Security Requirements (Binding)

All UI clients must follow `docs/security/ui-app-security-baseline.md`.

Non-negotiables:
- Device OAuth / PKCE-style flows; no static privileged tokens in client bundles.
- OS secure storage for tokens/keys.
- Strict transport security and certificate validation.
- Principle-of-least-privilege permissions (camera/mic/files/notifications).
- Signed builds and release provenance for desktop/mobile binaries.

## Execution Order

1. Harden mobile baseline (`apps/companion-mobile`) for premium UX + security.
2. Elevate web/admin interaction quality while preserving existing controls and stats.
3. Introduce Tauri desktop app and phase out Electron companion.
4. Upgrade CLI to interactive premium mode with safer defaults.

Execution checklist:
- `docs/architecture/production-readiness-checklist-2026.md`
- `docs/architecture/v1-client-scope-slos-2026.md`
- `docs/architecture/api-contract-boundaries-2026.md`
- `docs/architecture/premium-ux-patterns-2026.md`
