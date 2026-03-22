# Web Admin UX Phase 4: High-Risk Confirmation and Persistent Audit Trail

Date: 2026-02-13  
Scope: Close Section F DoD requirement for confirmation + audit data on high-risk approval actions.

## Implemented

### 1. Backend audit persistence for approval votes

Files:
- `services/gateway-api/src/routes/admin/approvals.ts`
- `services/gateway-api/src/db/migrations/046_approval_vote_audit_fields.sql`

Changes:
- `POST /admin/approvals/:id/vote` now requires:
  - `vote` (`approve|deny`)
  - `reason` (required)
  - `confirm_phrase` (required)
- Stored in `approval_votes`:
  - `reason`
  - `confirm_phrase`
- Also stamps approval metadata in `approvals.details`:
  - `last_vote_reason`
  - `last_vote_confirm_phrase`
  - `last_vote_by`
  - `last_vote_at`

### 2. Admin UI payload + history visibility

Files:
- `apps/admin-ui/src/lib/api.ts`
- `apps/admin-ui/src/lib/hooks.ts`
- `apps/admin-ui/src/app/approvals/page.tsx`

Changes:
- Vote request now sends required `reason` and `confirm_phrase`.
- History table includes a `Reason` column (from persisted approval details).
- Existing confirmation phrase UX and reason prompts now feed backend audit fields.

## Validation

- `npm --prefix apps/admin-ui run typecheck` (pass)
- `npm --prefix services/gateway-api run build` (pass)

## Outcome

- High-risk approval actions now have:
  - explicit confirmation requirement,
  - required reason,
  - persisted audit metadata in backend state.
