# Mobile UX Phase 18: First-Run Onboarding and Session Setup

Date: 2026-02-13  
Scope: Improve first-run usability and setup flow clarity.

## Implemented

- Added first-run onboarding card in Session tab:
  - guided 3-step flow (`preset -> confirm -> secure sign-in guidance`)
  - persistent completion state in local storage.
- Added environment presets for faster setup:
  - `Glyph Production`
  - `Sven Domain`
  - `Local Dev`
- Added cleaner session setup messaging and setup completion action.

Primary file:
- `apps/companion-mobile/App.tsx`

## Validation

- `npx tsc --noEmit` in `apps/companion-mobile` (pass).
