import pg from 'pg';
import type { ToolRunRequestEvent } from '@sven/shared';

export interface ApprovalValidationResult {
  valid: boolean;
  reason?: string;
}

interface ApprovalRow {
  id: string;
  chat_id: string;
  requester_user_id: string;
  tool_name: string;
  scope: string;
  status: string;
  expires_at: string | null;
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return true;
  return ts <= Date.now();
}

export async function validateRunApproval(
  pool: pg.Pool,
  event: ToolRunRequestEvent,
  options: { requiredScopes?: string[] } = {},
): Promise<ApprovalValidationResult> {
  const approvalId = typeof event.approval_id === 'string' ? event.approval_id.trim() : '';
  if (!approvalId) {
    return { valid: false, reason: 'missing approval_id' };
  }

  const res = await pool.query(
    `SELECT id, chat_id, requester_user_id, tool_name, scope, status, expires_at
       FROM approvals
      WHERE id = $1
      LIMIT 1`,
    [approvalId],
  );
  if (res.rows.length === 0) {
    return { valid: false, reason: 'approval not found' };
  }

  const row = res.rows[0] as ApprovalRow;
  if (row.status !== 'approved') {
    return { valid: false, reason: `approval status ${row.status}` };
  }
  if (isExpired(row.expires_at)) {
    return { valid: false, reason: 'approval expired' };
  }
  if (row.chat_id !== event.chat_id) {
    return { valid: false, reason: 'approval chat mismatch' };
  }
  if (row.requester_user_id !== event.user_id) {
    return { valid: false, reason: 'approval requester mismatch' };
  }
  if (row.tool_name !== event.tool_name) {
    return { valid: false, reason: 'approval tool mismatch' };
  }

  const requiredScopes = Array.isArray(options.requiredScopes) ? options.requiredScopes : [];
  if (requiredScopes.length > 0) {
    const scope = String(row.scope || '').trim().toLowerCase();
    const allowed = new Set(requiredScopes.map((entry) => entry.trim().toLowerCase()));
    if (!allowed.has(scope)) {
      return { valid: false, reason: 'approval scope mismatch' };
    }
  }

  return { valid: true };
}

