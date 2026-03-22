# Mobile UX Phase 16: Composer Command Picker and Attachment Tray

Date: 2026-02-13  
Scope: Improve composer intelligence, attachment ergonomics, and send affordance clarity.

## Implemented

- Added slash-command picker in composer:
  - live filtered command suggestions while typing `/...`,
  - tap to insert command.
- Expanded command set:
  - `/summarize`, `/analyze`, `/next`, `/translate`, `/tasks`
- Improved attachment tray:
  - dedicated card container,
  - attachment count header,
  - `Clear all` action.
- Polished send affordance:
  - disabled/active state based on composer readiness,
  - contextual send label (`Compose first`, `Send message`, `Sending...`).

Primary file:
- `apps/companion-mobile/App.tsx`

## Validation

- `npx tsc --noEmit` in `apps/companion-mobile` (pass).
