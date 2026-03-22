import { FastifyInstance, FastifyRequest } from 'fastify';
import pg from 'pg';
import {
  getRetentionPolicy,
  createExportRequest,
  getExportRequest,
  startExport,
  createDeletionRequest,
  approveDeletion,
  executeDeletion,
  isDeletionStateError,
  detectPII,
  flagPII,
  applyRedactionRules,
  logRetentionAction,
  getRetentionAudit,
} from '../../services/PrivacyService.js';

const SENSITIVE_KEY_PATTERN = /(password|passwd|secret|token|api[_-]?key|authorization|cookie|session|otp|totp)/i;
const PII_VALUE_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: 'email', pattern: /[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g },
  { type: 'phone', pattern: /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g },
  { type: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'credit_card', pattern: /\b(?:\d[ -]*?){13,16}\b/g },
];
const ALLOWED_EXPORT_TYPES = ['all', 'messages', 'artifacts', 'metadata', 'tool_runs', 'voice', 'custom'] as const;
const ALLOWED_DELETION_TYPES = ['soft_delete', 'hard_delete', 'anonymize', 'purge'] as const;
type ExportType = (typeof ALLOWED_EXPORT_TYPES)[number];
type DeletionType = (typeof ALLOWED_DELETION_TYPES)[number];

function maskStringValue(value: string): string {
  let masked = value;
  for (const { type, pattern } of PII_VALUE_PATTERNS) {
    masked = masked.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
  }
  return masked;
}

function sanitizeAuditDetails(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeAuditDetails(item));
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = '[REDACTED_SECRET]';
        continue;
      }
      out[key] = sanitizeAuditDetails(value);
    }
    return out;
  }
  if (typeof input === 'string') {
    return maskStringValue(input);
  }
  return input;
}

function parseExportTypeInput(raw: unknown): { ok: true; value: ExportType } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: 'all' };
  }
  if (typeof raw !== 'string') {
    return { ok: false, message: `exportType must be one of: ${ALLOWED_EXPORT_TYPES.join(', ')}` };
  }
  const value = raw.trim() as ExportType;
  if (!ALLOWED_EXPORT_TYPES.includes(value)) {
    return { ok: false, message: `exportType must be one of: ${ALLOWED_EXPORT_TYPES.join(', ')}` };
  }
  return { ok: true, value };
}

function parseDeletionTypeInput(raw: unknown): { ok: true; value: DeletionType } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: 'soft_delete' };
  }
  if (typeof raw !== 'string') {
    return { ok: false, message: `deletionType must be one of: ${ALLOWED_DELETION_TYPES.join(', ')}` };
  }
  const value = raw.trim() as DeletionType;
  if (!ALLOWED_DELETION_TYPES.includes(value)) {
    return { ok: false, message: `deletionType must be one of: ${ALLOWED_DELETION_TYPES.join(', ')}` };
  }
  return { ok: true, value };
}

/**
 * Privacy and Data Retention REST API Routes (Admin Panel)
 */
export async function registerPrivacyRoutes(app: FastifyInstance, pool: pg.Pool) {
  function isDeletionAccessError(error: unknown): boolean {
    const message = String((error as { message?: string })?.message || '');
    return message.includes('Deletion request not found or not accessible');
  }

  function parsePrivacyAuditLimit(raw: unknown): number | null {
    if (raw === undefined || raw === null || raw === '') return 50;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
      return null;
    }
    return parsed;
  }

  function normalizePrivacyBody<T extends object>(
    body: unknown
  ): { ok: true; value: Partial<T> } | { ok: false; message: string } {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { ok: false, message: 'request body must be a JSON object' };
    }
    return { ok: true, value: body as Partial<T> };
  }

  // ─── GET /privacy/retention-policy ───
  app.get('/privacy/retention-policy', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;
      const orgId = (request as any).orgId || null;
      if (!userId) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'userId required' } });
      }
      if (!orgId) {
        return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      }

      const policy = await getRetentionPolicy({ organizationId: String(orgId), userId: String(userId) });
      if (!policy) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No retention policy found' } });
      }

      return reply.send({ success: true, data: policy });
    } catch (error) {
      console.error('Failed to get retention policy:', error);
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get retention policy' } });
    }
  });

  // ─── POST /privacy/export-request ───
  app.post('/privacy/export-request', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;
      const body = normalizePrivacyBody<{ chatId?: unknown; exportType?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: body.message } });
      }
      const { chatId, exportType } = body.value;
      const exportTypeInput = parseExportTypeInput(exportType);
      if (!exportTypeInput.ok) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: exportTypeInput.message } });
      }
      const exportRequest = await createExportRequest(userId, chatId ? String(chatId) : null, exportTypeInput.value);

      // Start async export processing in background
      startExport(exportRequest.id, userId).catch((err) =>
        console.error(`Failed to process export ${exportRequest.id}:`, err)
      );

      await logRetentionAction(
        'export_requested',
        'export_request',
        exportRequest.id,
        userId,
        chatId ? String(chatId) : null,
        userId,
        null,
        { export_type: exportTypeInput.value }
      );

      return reply.status(202).send({
        success: true,
        data: {
          requestId: exportRequest.id,
          status: 'pending',
          message: 'Export queued for processing',
        },
      });
    } catch (error) {
      console.error('Failed to create export:', error);
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create export' } });
    }
  });

  // ─── GET /privacy/export-request/:requestId ───
  app.get('/privacy/export-request/:requestId', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;
      const { requestId } = request.params as any;

      const exportRequest = await getExportRequest(requestId);
      if (!exportRequest) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Export request not found' } });
      }

      // Verify ownership or admin access
      if (exportRequest.userId !== userId) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot access other user export' } });
      }

      return reply.send({ success: true, data: exportRequest });
    } catch (error) {
      console.error('Failed to get export request:', error);
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get export request' } });
    }
  });

  // ─── POST /privacy/deletion-request ───
  app.post('/privacy/deletion-request', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;
      const orgId = (request as any).orgId || null;
      if (!orgId) {
        return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      }
      const body = normalizePrivacyBody<{ chatId?: unknown; deletionType?: unknown; reason?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: body.message } });
      }
      const { chatId, deletionType, reason } = body.value;
      const deletionTypeInput = parseDeletionTypeInput(deletionType);
      if (!deletionTypeInput.ok) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: deletionTypeInput.message } });
      }
      const reasonText = reason === undefined || reason === null ? undefined : String(reason);

      const deletion = await createDeletionRequest(userId, String(orgId), chatId ? String(chatId) : null, deletionTypeInput.value, reasonText);

      await logRetentionAction(
        'deletion_requested',
        'deletion_request',
        deletion.id,
        userId,
        chatId ? String(chatId) : null,
        userId,
        String(orgId),
        { deletion_type: deletionTypeInput.value, reason: reasonText }
      );

      return reply.status(202).send({
        success: true,
        data: {
          requestId: deletion.id,
          status: 'pending',
          message: 'Deletion request received. Pending admin approval.',
        },
      });
    } catch (error) {
      console.error('Failed to create deletion request:', error);
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create deletion request' } });
    }
  });

  // ─── POST /privacy/deletion-request/:requestId/approve ───
  app.post('/privacy/deletion-request/:requestId/approve', async (request: FastifyRequest, reply) => {
    try {
      const { requestId } = request.params as any;
      const body = normalizePrivacyBody<{ scheduleDays?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: body.message } });
      }
      const { scheduleDays = 7 } = body.value;
      const adminId = (request as any).userId;
      const adminOrgId = (request as any).orgId || null;

      const scheduleDaysValue = Number.isFinite(Number(scheduleDays)) ? Number(scheduleDays) : 7;
      const result = await approveDeletion(requestId, adminId, adminOrgId, scheduleDaysValue);

      return reply.send({
        success: true,
        data: {
          requestId,
          scheduledFor: result.scheduledFor,
          message: `Deletion approved. Scheduled to execute in ${scheduleDaysValue} days.`,
        },
      });
    } catch (error) {
      if (isDeletionAccessError(error)) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Deletion request not found or not accessible' } });
      }
      if (isDeletionStateError(error)) {
        return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Deletion request not approved or not ready for execution' } });
      }
      console.error('Failed to approve deletion:', error);
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to approve deletion' } });
    }
  });

  // ─── POST /privacy/deletion-request/:requestId/execute ───
  app.post('/privacy/deletion-request/:requestId/execute', async (request: FastifyRequest, reply) => {
    try {
      const { requestId } = request.params as any;
      const actorUserId = (request as any).userId;
      const actorOrgId = (request as any).orgId || null;

      const result = await executeDeletion(requestId, actorUserId, actorOrgId);

      return reply.send({
        success: true,
        data: {
          requestId,
          deletedRecords: result.deletedCount,
          message: `Deletion executed. ${result.deletedCount} records removed.`,
        },
      });
    } catch (error) {
      if (isDeletionAccessError(error)) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Deletion request not found or not accessible' } });
      }
      if (isDeletionStateError(error)) {
        return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Deletion request not approved or not ready for execution' } });
      }
      console.error('Failed to execute deletion:', error);
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to execute deletion' } });
    }
  });

  // ─── POST /privacy/detect-pii ───
  app.post('/privacy/detect-pii', async (request: FastifyRequest, reply) => {
    try {
      const body = normalizePrivacyBody<{ text?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: body.message } });
      }
      const { text } = body.value;
      if (!text) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text required' } });
      }

      const textValue = String(text);
      const detected = await detectPII(textValue);

      return reply.send({
        success: true,
        data: {
          piiDetected: detected.length > 0,
          elements: detected,
          count: detected.length,
        },
      });
    } catch (error) {
      console.error('Failed to detect PII:', error);
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to detect PII' } });
    }
  });

  // ─── POST /privacy/redact-text ───
  app.post('/privacy/redact-text', async (request: FastifyRequest, reply) => {
    try {
      const body = normalizePrivacyBody<{ text?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: body.message } });
      }
      const { text } = body.value;
      if (!text) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text required' } });
      }

      const textValue = String(text);
      const redacted = await applyRedactionRules(textValue);

      return reply.send({
        success: true,
        data: {
          original: textValue,
          redacted,
          changed: textValue !== redacted,
        },
      });
    } catch (error) {
      console.error('Failed to redact text:', error);
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to redact text' } });
    }
  });

  // ─── GET /privacy/audit-log ───
  app.get('/privacy/audit-log', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;
      const orgId = (request as any).orgId || null;
      if (!orgId) {
        return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      }
      const { chatId, limit = 50 } = request.query as any;
      const parsedLimit = parsePrivacyAuditLimit(limit);
      if (parsedLimit === null) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'limit must be an integer between 1 and 500 when provided' },
        });
      }

      const audit = await getRetentionAudit(userId, chatId || undefined, String(orgId), parsedLimit);
      const sanitizedAudit = audit.map((entry) => ({
        ...entry,
        details: sanitizeAuditDetails(entry.details),
      }));

      return reply.send({
        success: true,
        data: {
          userId,
          chatId: chatId || null,
          auditLog: sanitizedAudit,
          total: sanitizedAudit.length,
        },
      });
    } catch (error) {
      console.error('Failed to get audit log:', error);
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get audit log' } });
    }
  });
}
