# Desktop Tauri Phase 5 Evidence: Parity Actions and Secure Store Gate

Date: 2026-02-13  
Scope: Close core desktop parity gaps (timeline + approval actions) and add explicit secure-store release evidence.

## Implemented

### 1. Tauri backend parity commands

File: `apps/companion-desktop-tauri/src-tauri/src/main.rs`

- Added `fetch_timeline` command:
  - `GET /v1/chats/:chatId/messages?limit=...`
  - authenticated with bearer token.
- Added `vote_approval` command:
  - `POST /v1/approvals/:id/vote`
  - body `{ decision: "approve" | "deny" }`.
- Registered both commands in `tauri::generate_handler!`.

### 2. Desktop frontend parity wiring

Files:
- `apps/companion-desktop-tauri/src/lib/api.ts`
- `apps/companion-desktop-tauri/src/App.tsx`
- `apps/companion-desktop-tauri/src/styles.css`

Changes:
- Added API wrappers and types for:
  - timeline fetch (`fetchTimeline`)
  - approval voting (`voteApproval`)
- Added timeline panel in UI with refresh action and periodic polling.
- Added approval row actions (Approve/Deny) with in-flight state handling.
- Added post-send timeline refresh and sign-out timeline reset.

### 3. Desktop secure-store release gate

Files:
- `scripts/desktop-tauri-securestore-check.cjs`
- `package.json` (`desktop:tauri:securestore:check`)

Output artifacts:
- `docs/release/status/desktop-tauri-securestore-check-latest.json`
- `docs/release/status/desktop-tauri-securestore-check-latest.md`

Gate result:
- `status=pass` (6/6 checks).

## Validation

- `npm --prefix apps/companion-desktop-tauri run typecheck` (pass)
- `cargo check` in `apps/companion-desktop-tauri/src-tauri` (pass)
- `node scripts/desktop-tauri-securestore-check.cjs` (pass)
