# Mobile UX Phase 15: Assistant Cards and Reveal Animation

Date: 2026-02-13  
Scope: Push chat presentation toward assistant-native UX quality.

## Implemented

- Assistant response card variants:
  - `Code` style card when message contains fenced code,
  - `Tasks` style card for checklist/list-like messages,
  - `Insight` style card for long-form assistant responses.
- Assistant badge metadata shown on assistant cards (`Reply/Code/Tasks/Insight`).
- New-message reveal animation on latest timeline bubble.
- Highlight treatment for latest message to improve stream readability.

Primary file:
- `apps/companion-mobile/App.tsx`

## Validation

- `npx tsc --noEmit` in `apps/companion-mobile` (pass).
