# Mobile UX Phase 17: Talk PTT and Approval Risk UX

Date: 2026-02-13  
Scope: Improve voice interaction ergonomics and approval decision clarity.

## Implemented

- Talk mode upgrades:
  - Added true hold-to-talk mode (`press in` start, `press out` send),
  - Added toggle between hold-mode and tap-mode,
  - Added animated live recording button pulse.
- Approvals UX upgrades:
  - Added risk classification (`LOW` / `HIGH`) from tool/scope heuristics,
  - Added approvals filter chips (`All` / `High Risk`),
  - Added created-time metadata per approval card.

Primary file:
- `apps/companion-mobile/App.tsx`

## Validation

- `npx tsc --noEmit` in `apps/companion-mobile` (pass).
