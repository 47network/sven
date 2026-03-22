# Soft vs Hard Delete Policy (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

Policy for deletion behavior used by GDPR/right-to-erasure flows in Sven.

## Request Types

1. `soft_delete`
- Target: `messages`
- Behavior:
  - if `messages.is_deleted` exists: set `is_deleted = true`
  - otherwise: overwrite `text` with `[deleted]`
- Purpose: preserve auditability while removing user-visible content.

2. `anonymize`
- Target: `messages`
- Behavior: same execution path as `soft_delete` in current service.
- Purpose: remove direct content while preserving message rows/structure.

3. `hard_delete`
- Target: `messages`
- Behavior: `DELETE FROM messages ...`
- Purpose: permanent removal of message rows for stronger erasure.

4. `purge`
- Target: `messages`
- Behavior: same execution path as `hard_delete`.
- Purpose: strict permanent erasure.

## Implementation Reference

- Service: `services/gateway-api/src/services/PrivacyService.ts`
- Function: `executeDeletion(requestId)`
- Deletion request model: `data_deletion_requests.deletion_type`

## Operational Guardrails

1. Deletion requests start as `pending` and require explicit approval step.
2. Approved requests are auditable through `retention_audit_log`.
3. Scheduled and executed events are persisted in `data_deletion_requests`.
