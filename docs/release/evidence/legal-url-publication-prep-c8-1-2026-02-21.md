# Evidence: Legal URL Publication Prep (C8.1)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C8.1` legal URL items

## Implemented

- Added Canvas UI legal pages:
  - `apps/canvas-ui/src/app/privacy/page.tsx` -> `/privacy`
  - `apps/canvas-ui/src/app/terms/page.tsx` -> `/terms`
- Updated Flutter privacy settings links to production app host:
  - `apps/companion-user-flutter/lib/features/settings/privacy_page.dart`
  - Privacy URL: `https://app.sven.example.com/privacy`
  - Terms URL: `https://app.sven.example.com/terms`

## Validation Status

- Code/config is in place for legal URL publication on next deployment.
- Live URL publication is **not** marked complete in checklist until post-deploy HTTP 200 verification is captured.

