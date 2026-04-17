import { getPool } from '../db/pool.js';
import { nanoid } from 'nanoid';

/**
 * Privacy and Data Retention Service
 * Handles retention policies, data export, deletion, and PII detection
 */

interface RetentionPolicy {
  id: string;
  type: 'global' | 'per_chat' | 'per_user';
  organizationId?: string;
  messageRetentionDays?: number;
  messageArtifactsDays?: number;
  messageLogsDays?: number;
  toolRunsDays?: number;
  voiceTranscriptsDays?: number;
  metadataRetentionDays?: number;
  autoDeleteExpired?: boolean;
  redactPIIBeforeStorage?: boolean;
}

interface ExportRequest {
  id: string;
  userId: string;
  chatId?: string;
  exportType: 'all' | 'messages' | 'artifacts' | 'metadata' | 'tool_runs' | 'voice' | 'custom';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileUri?: string;
  fileFormat: 'json' | 'csv' | 'parquet';
}

interface DeletionRequest {
  id: string;
  userId: string;
  chatId?: string;
  deletionType: 'soft_delete' | 'hard_delete' | 'anonymize' | 'purge';
  status: 'pending' | 'approved' | 'in_progress' | 'completed';
  scheduledFor?: Date;
}

const pool = getPool();
const DELETION_ACCESS_ERROR_MESSAGE = 'Deletion request not found or not accessible';
const DELETION_STATE_ERROR_MESSAGE = 'Deletion request not approved or not ready for execution';
const schemaColumnCache = new Map<string, boolean>();

async function publicTableHasColumn(tableName: string, columnName: string): Promise<boolean> {
  const cacheKey = `${tableName}.${columnName}`;
  if (schemaColumnCache.has(cacheKey)) {
    return schemaColumnCache.get(cacheKey) || false;
  }
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [tableName, columnName],
  );
  const exists = result.rows.length > 0;
  schemaColumnCache.set(cacheKey, exists);
  return exists;
}

export function isDeletionStateError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || '');
  return message.includes(DELETION_STATE_ERROR_MESSAGE);
}

async function loadAuthorizedDeletionRequest(
  requestId: string,
  actorUserId: string,
  actorOrgId?: string | null,
): Promise<Record<string, unknown>> {
  const requiredOrgId = String(actorOrgId || '').trim();
  if (!requiredOrgId) {
    throw new Error(DELETION_ACCESS_ERROR_MESSAGE);
  }
  const hasOrgColumn = await publicTableHasColumn('data_deletion_requests', 'organization_id');
  const result = hasOrgColumn
    ? await pool.query(
        `SELECT d.*
         FROM data_deletion_requests d
         JOIN organization_memberships actor_membership
           ON actor_membership.organization_id::text = d.organization_id::text
          AND actor_membership.user_id::text = $2::text
          AND actor_membership.status = 'active'
          AND actor_membership.role IN ('owner', 'admin')
         JOIN organization_memberships target_membership
           ON target_membership.organization_id::text = d.organization_id::text
          AND target_membership.user_id::text = d.user_id::text
          AND target_membership.status = 'active'
         WHERE d.id = $1
           AND d.organization_id::text = $3::text
         LIMIT 1`,
        [requestId, actorUserId, requiredOrgId],
      )
    : await pool.query(
        `SELECT d.*
         FROM data_deletion_requests d
         JOIN organization_memberships actor_membership
           ON actor_membership.organization_id::text = $3::text
          AND actor_membership.user_id::text = $2::text
          AND actor_membership.status = 'active'
          AND actor_membership.role IN ('owner', 'admin')
         JOIN organization_memberships target_membership
           ON target_membership.organization_id::text = $3::text
          AND target_membership.user_id::text = d.user_id::text
          AND target_membership.status = 'active'
         LEFT JOIN chats deletion_chat_scope
           ON deletion_chat_scope.id::text = d.chat_id::text
         WHERE d.id = $1
           AND (d.chat_id IS NULL OR deletion_chat_scope.organization_id::text = $3::text)
         LIMIT 1`,
        [requestId, actorUserId, requiredOrgId],
      );

  if (result.rows.length === 0) {
    throw new Error(DELETION_ACCESS_ERROR_MESSAGE);
  }

  return result.rows[0] as Record<string, unknown>;
}

/**
 * Get retention policy for a user or chat
 */
export async function getRetentionPolicy(
  context: { organizationId?: string; userId?: string; chatId?: string }
): Promise<RetentionPolicy | null> {
  try {
    const orgId = String(context.organizationId || '').trim();
    if (!orgId) {
      return null;
    }
    if (context.userId) {
      const membership = await pool.query(
        `SELECT 1
         FROM organization_memberships
         WHERE organization_id::text = $1::text
           AND user_id::text = $2::text
           AND status = 'active'
         LIMIT 1`,
        [orgId, String(context.userId)],
      );
      if (membership.rows.length === 0) {
        return null;
      }
    }

    const hasOrgColumn = await publicTableHasColumn('retention_policies', 'organization_id');
    let result;

    if (hasOrgColumn) {
      let query = `SELECT * FROM retention_policies WHERE organization_id::text = $1::text AND type = 'global'`;
      const params: any[] = [orgId];

      if (context.chatId) {
        query = `SELECT * FROM retention_policies WHERE organization_id::text = $1::text AND chat_id = $2 ORDER BY created_at DESC LIMIT 1`;
        params.push(context.chatId);
      } else if (context.userId) {
        query = `SELECT * FROM retention_policies WHERE organization_id::text = $1::text AND user_id = $2 ORDER BY created_at DESC LIMIT 1`;
        params.push(context.userId);
      }

      result = await pool.query(query, params);
      if (result.rows.length === 0 && (context.chatId || context.userId)) {
        result = await pool.query(
          `SELECT * FROM retention_policies WHERE organization_id::text = $1::text AND type = 'global' LIMIT 1`,
          [orgId],
        );
      }
    } else {
      let query = `SELECT * FROM retention_policies WHERE type = 'global'`;
      const params: any[] = [];
      if (context.chatId) {
        query = `SELECT * FROM retention_policies WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1`;
        params.push(context.chatId);
      } else if (context.userId) {
        query = `SELECT * FROM retention_policies WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`;
        params.push(context.userId);
      }
      result = await pool.query(query, params);
      if (result.rows.length === 0 && (context.chatId || context.userId)) {
        result = await pool.query(
          `SELECT * FROM retention_policies WHERE type = 'global' ORDER BY created_at DESC LIMIT 1`,
        );
      }
    }

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      type: row.type,
      organizationId: row.organization_id,
      messageRetentionDays: row.message_retention_days,
      messageArtifactsDays: row.message_artifacts_days,
      messageLogsDays: row.message_logs_days,
      toolRunsDays: row.tool_runs_days,
      voiceTranscriptsDays: row.voice_transcripts_days,
      metadataRetentionDays: row.metadata_retention_days,
      autoDeleteExpired: row.auto_delete_expired,
      redactPIIBeforeStorage: row.redact_pii_before_storage,
    };
  } catch (error) {
    console.error('Failed to get retention policy:', error);
    return null;
  }
}

/**
 * Create a data export request
 */
export async function createExportRequest(
  userId: string,
  chatId: string | null,
  exportType: ExportRequest['exportType']
): Promise<ExportRequest> {
  try {
    const result = await pool.query(
      `INSERT INTO data_export_requests (user_id, chat_id, export_type, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, chatId, exportType, 'pending']
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      chatId: row.chat_id,
      exportType: row.export_type,
      status: row.status,
      fileFormat: row.file_format,
    };
  } catch (error) {
    console.error('Failed to create export request:', error);
    throw error;
  }
}

/**
 * Get export request status
 */
export async function getExportRequest(requestId: string): Promise<ExportRequest | null> {
  try {
    const result = await pool.query('SELECT * FROM data_export_requests WHERE id = $1', [
      requestId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      chatId: row.chat_id,
      exportType: row.export_type,
      status: row.status,
      fileUri: row.file_uri,
      fileFormat: row.file_format,
    };
  } catch (error) {
    console.error('Failed to get export request:', error);
    return null;
  }
}

/**
 * Start data export processing
 * In production, this would be queued for async processing
 */
export async function startExport(
  requestId: string,
  userId: string
): Promise<{ success: boolean; recordCount: number }> {
  try {
    // Mark as processing
    await pool.query(
      `UPDATE data_export_requests SET status = 'processing', progress_percentage = 10 WHERE id = $1`,
      [requestId]
    );

    // Collect data by type
    const exportRequest = await getExportRequest(requestId);
    if (!exportRequest) {
      throw new Error('Export request not found');
    }

    let totalRecords = 0;

    // Export messages
    if (
      exportRequest.exportType === 'all' ||
      exportRequest.exportType === 'messages'
    ) {
      const result = await pool.query(
        exportRequest.chatId
          ? `SELECT * FROM messages WHERE chat_id = $1 AND sender_user_id = $2`
          : `SELECT * FROM messages WHERE sender_user_id = $1`,
        exportRequest.chatId ? [exportRequest.chatId, userId] : [userId]
      );
      totalRecords += result.rows.length;
    }

    // Export artifacts
    if (
      exportRequest.exportType === 'all' ||
      exportRequest.exportType === 'artifacts'
    ) {
      const result = await pool.query(
        exportRequest.chatId
          ? `SELECT * FROM artifacts WHERE chat_id = $1 AND created_by = $2`
          : `SELECT * FROM artifacts WHERE created_by = $1`,
        exportRequest.chatId ? [exportRequest.chatId, userId] : [userId]
      );
      totalRecords += result.rows.length;
    }

    // Mark as completed
    await pool.query(
      `UPDATE data_export_requests 
       SET status = 'completed', progress_percentage = 100, completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    // Log to audit
    await logRetentionAction(
      'export_completed',
      'export_request',
      requestId,
      userId,
      exportRequest.chatId || null,
      userId,
      null,
      { exported_records: totalRecords }
    );

    return { success: true, recordCount: totalRecords };
  } catch (error) {
    console.error('Failed to start export:', error);
    await pool.query(
      `UPDATE data_export_requests 
       SET status = 'failed', error_message = $1 
       WHERE id = $2`,
      [(error as Error).message, requestId]
    );
    throw error;
  }
}

/**
 * Create a data deletion request
 */
export async function createDeletionRequest(
  userId: string,
  organizationId: string,
  chatId: string | null,
  deletionType: DeletionRequest['deletionType'],
  reason?: string
): Promise<DeletionRequest> {
  try {
    const normalizedOrgId = String(organizationId || '').trim();
    if (!normalizedOrgId) {
      throw new Error('organizationId is required for deletion requests');
    }
    const actorMembership = await pool.query(
      `SELECT 1
       FROM organization_memberships
       WHERE user_id::text = $1::text AND organization_id::text = $2::text
       LIMIT 1`,
      [userId, normalizedOrgId],
    );
    if (actorMembership.rows.length === 0) {
      throw new Error('Deletion request user is not a member of active organization');
    }
    if (chatId) {
      const chatScope = await pool.query(
        `SELECT 1
         FROM chats
         WHERE id::text = $1::text AND organization_id::text = $2::text
         LIMIT 1`,
        [chatId, normalizedOrgId],
      );
      if (chatScope.rows.length === 0) {
        throw new Error('Deletion request chat is not in active organization');
      }
    }

    const hasOrgColumn = await publicTableHasColumn('data_deletion_requests', 'organization_id');
    const result = hasOrgColumn
      ? await pool.query(
          `INSERT INTO data_deletion_requests (user_id, organization_id, chat_id, deletion_type, reason, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [userId, normalizedOrgId, chatId, deletionType, reason || null, 'pending']
        )
      : await pool.query(
          `INSERT INTO data_deletion_requests (user_id, chat_id, deletion_type, reason, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [userId, chatId, deletionType, reason || null, 'pending']
        );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      chatId: row.chat_id,
      deletionType: row.deletion_type,
      status: row.status,
      scheduledFor: row.scheduled_for,
    };
  } catch (error) {
    console.error('Failed to create deletion request:', error);
    throw error;
  }
}

/**
 * Approve a deletion request (admin only)
 */
export async function approveDeletion(
  requestId: string,
  approverUserId: string,
  approverOrgId?: string | null,
  scheduleDays?: number
): Promise<{ success: boolean; scheduledFor?: Date }> {
  try {
    await loadAuthorizedDeletionRequest(requestId, approverUserId, approverOrgId);
    const scheduledFor = scheduleDays ? new Date(Date.now() + scheduleDays * 24 * 60 * 60 * 1000) : null;

    const approved = await pool.query(
      `UPDATE data_deletion_requests 
       SET status = 'approved', confirmed_by = $1, confirmation_timestamp = CURRENT_TIMESTAMP, scheduled_for = $2
       WHERE id = $3 AND status = 'pending'`,
      [approverUserId, scheduledFor, requestId]
    );
    if ((approved.rowCount || 0) === 0) {
      throw new Error(DELETION_STATE_ERROR_MESSAGE);
    }

    return { success: true, scheduledFor: scheduledFor || undefined };
  } catch (error) {
    console.error('Failed to approve deletion:', error);
    throw error;
  }
}

/**
 * Execute a deletion request (soft delete messages, hard delete if purge type)
 */
export async function executeDeletion(
  requestId: string,
  actorUserId: string,
  actorOrgId?: string | null,
): Promise<{ success: boolean; deletedCount: number }> {
  const client = await pool.connect();
  try {
    const authorized = await loadAuthorizedDeletionRequest(requestId, actorUserId, actorOrgId);
    const requestUserId = String(authorized.user_id || '').trim();
    const requestOrgId = String((authorized.organization_id || actorOrgId || '')).trim();
    const requestChatId = String(authorized.chat_id || '').trim();
    const requestDeletionType = String(authorized.deletion_type || '').trim();

    if (!requestUserId || !requestDeletionType || !requestOrgId) {
      throw new Error(DELETION_ACCESS_ERROR_MESSAGE);
    }

    await client.query('BEGIN');

    const hasOrgColumn = await publicTableHasColumn('data_deletion_requests', 'organization_id');
    const result = hasOrgColumn
      ? await client.query(
          `SELECT *
           FROM data_deletion_requests
           WHERE id = $1 AND user_id = $2 AND organization_id::text = $3::text
           FOR UPDATE`,
          [requestId, requestUserId, requestOrgId],
        )
      : await client.query(
          `SELECT *
           FROM data_deletion_requests
           WHERE id = $1 AND user_id = $2
           FOR UPDATE`,
          [requestId, requestUserId],
        );

    if (result.rows.length === 0) {
      throw new Error(DELETION_ACCESS_ERROR_MESSAGE);
    }
    const requestRow = result.rows[0] as Record<string, unknown>;
    const currentStatus = String(requestRow.status || '').trim();
    const scheduledForRaw = requestRow.scheduled_for ? new Date(String(requestRow.scheduled_for)) : null;
    if (currentStatus !== 'approved') {
      throw new Error(DELETION_STATE_ERROR_MESSAGE);
    }
    if (scheduledForRaw && Number.isFinite(scheduledForRaw.getTime()) && scheduledForRaw.getTime() > Date.now()) {
      throw new Error(DELETION_STATE_ERROR_MESSAGE);
    }
    const promoted = await client.query(
      `UPDATE data_deletion_requests
       SET status = 'in_progress'
       WHERE id = $1 AND status = 'approved'`,
      [requestId],
    );
    if ((promoted.rowCount || 0) === 0) {
      throw new Error(DELETION_STATE_ERROR_MESSAGE);
    }

    let deletedCount = 0;
    const hasIsDeletedColumnResult = await client.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'is_deleted'
       LIMIT 1`
    );
    const hasIsDeletedColumn = hasIsDeletedColumnResult.rows.length > 0;

    // Soft delete: mark messages as deleted but keep for audit
    if (requestDeletionType === 'soft_delete' || requestDeletionType === 'anonymize') {
      const sql = hasIsDeletedColumn
        ? `UPDATE messages m
           SET is_deleted = true
           FROM chats c
           WHERE m.sender_user_id = $1
             AND m.chat_id = c.id
             AND c.organization_id::text = $2::text
             ${requestChatId ? 'AND m.chat_id = $3' : ''}`
        : `UPDATE messages m
           SET text = '[deleted]'
           FROM chats c
           WHERE m.sender_user_id = $1
             AND m.chat_id = c.id
             AND c.organization_id::text = $2::text
             ${requestChatId ? 'AND m.chat_id = $3' : ''}`;
      const updateResult = await client.query(
        sql,
        requestChatId ? [requestUserId, requestOrgId, requestChatId] : [requestUserId, requestOrgId]
      );
      deletedCount = updateResult.rowCount || 0;
    }

    // Hard delete: remove messages completely
    if (requestDeletionType === 'hard_delete' || requestDeletionType === 'purge') {
      const deleteResult = await client.query(
        `DELETE FROM messages m
         USING chats c
         WHERE m.chat_id = c.id
           AND m.sender_user_id = $1
           AND c.organization_id::text = $2::text
           ${requestChatId ? 'AND m.chat_id = $3' : ''}`,
        requestChatId ? [requestUserId, requestOrgId, requestChatId] : [requestUserId, requestOrgId]
      );
      deletedCount = deleteResult.rowCount || 0;
    }

    // Update deletion request status
    await client.query(
      `UPDATE data_deletion_requests 
       SET status = 'completed', deleted_records_count = $1, completed_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = 'in_progress'`,
      [deletedCount, requestId]
    );

    await client.query('COMMIT');

    // Log to audit
    await logRetentionAction(
      'deletion_executed',
      'deletion_request',
      requestId,
      requestUserId,
      requestChatId || null,
      requestUserId,
      requestOrgId,
      { deleted_records: deletedCount, deletion_type: requestDeletionType }
    );

    return { success: true, deletedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to execute deletion:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Detect PII in text (regex-based)
 */
export async function detectPII(
  text: string
): Promise<Array<{ type: string; value: string; confidence: number }>> {
  const patterns = {
    email: /[\w.-]+@[\w.-]+\.\w+/g,
    phone: /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/g,
    ssn: /\d{3}-\d{2}-\d{4}/g,
    credit_card: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
    api_key: /(sk|pk|api)[_-]?[a-zA-Z0-9]{32,}/g,
  };

  const detected: Array<{ type: string; value: string; confidence: number }> = [];

  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const raw = match[0];
      const masked = raw.length <= 4
        ? '****'
        : raw.slice(0, 2) + '*'.repeat(Math.min(raw.length - 4, 20)) + raw.slice(-2);
      detected.push({
        type,
        value: masked,
        confidence: 0.95,
      });
    }
  }

  return detected;
}

/**
 * Flag detected PII in a message
 */
export async function flagPII(
  messageId: string,
  chatId: string,
  piiType: string,
  confidence: number,
  detectionMethod: string = 'regex'
): Promise<string> {
  try {
    const id = nanoid();

    await pool.query(
      `INSERT INTO pii_flags (id, message_id, chat_id, pii_type, confidence, detection_method, action_taken)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, messageId, chatId, piiType, confidence, detectionMethod, 'flagged']
    );

    return id;
  } catch (error) {
    console.error('Failed to flag PII:', error);
    throw error;
  }
}

/**
 * Apply redaction rules to text before storage
 */
export async function applyRedactionRules(text: string, context?: { userId?: string; chatId?: string }): Promise<string> {
  try {
    const result = await pool.query(
      `SELECT pattern, replacement FROM redaction_rules 
       WHERE enabled = true AND apply_globally = true
       ORDER BY created_at ASC`
    );

    let redactedText = text;

    for (const rule of result.rows) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        redactedText = redactedText.replace(regex, rule.replacement || '[REDACTED]');
      } catch (error) {
        console.error(`Invalid redaction pattern: ${rule.pattern}`, error);
      }
    }

    return redactedText;
  } catch (error) {
    console.error('Failed to apply redaction rules:', error);
    return text; // Return original text if redaction fails
  }
}

/**
 * Log a retention action to audit trail
 */
export async function logRetentionAction(
  action: string,
  resourceType: string,
  resourceId: string,
  targetUserId: string,
  targetChatId: string | null,
  actorUserId: string,
  organizationId: string | null,
  details?: any
): Promise<void> {
  try {
    const hasOrgColumn = await publicTableHasColumn('retention_audit_log', 'organization_id');
    if (hasOrgColumn) {
      await pool.query(
        `INSERT INTO retention_audit_log (action, resource_type, resource_id, target_user_id, target_chat_id, actor_user_id, organization_id, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [action, resourceType, resourceId, targetUserId, targetChatId, actorUserId, organizationId, JSON.stringify(details || {})]
      );
    } else {
      await pool.query(
        `INSERT INTO retention_audit_log (action, resource_type, resource_id, target_user_id, target_chat_id, actor_user_id, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [action, resourceType, resourceId, targetUserId, targetChatId, actorUserId, JSON.stringify(details || {})]
      );
    }
  } catch (error) {
    console.error('Failed to log retention action:', error);
  }
}

/**
 * Get retention audit log for a user/chat
 */
export async function getRetentionAudit(
  userId?: string,
  chatId?: string,
  organizationId?: string,
  limit: number = 50
): Promise<Array<{ action: string; resourceType: string; resourceId: string; createdAt: string; details: any }>> {
  try {
    const orgId = String(organizationId || '').trim();
    if (!orgId) {
      const err = new Error('organizationId is required for retention audit reads') as Error & { code?: string };
      err.code = 'RETENTION_AUDIT_ORG_REQUIRED';
      throw err;
    }
    const hasOrgColumn = await publicTableHasColumn('retention_audit_log', 'organization_id');
    const queryParts: string[] = [];

    queryParts.push(hasOrgColumn
      ? 'SELECT action, resource_type, resource_id, created_at, details FROM retention_audit_log WHERE organization_id::text = $1::text'
      : `SELECT action, resource_type, resource_id, created_at, details
         FROM retention_audit_log ral
         WHERE (
           EXISTS (
             SELECT 1 FROM organization_memberships actor_scope
             WHERE actor_scope.organization_id::text = $1::text
               AND actor_scope.user_id::text = ral.actor_user_id::text
               AND actor_scope.status = 'active'
           )
           OR EXISTS (
             SELECT 1 FROM organization_memberships target_user_scope
             WHERE target_user_scope.organization_id::text = $1::text
               AND target_user_scope.user_id::text = ral.target_user_id::text
               AND target_user_scope.status = 'active'
           )
           OR EXISTS (
             SELECT 1 FROM chats target_chat_scope
             WHERE target_chat_scope.organization_id::text = $1::text
               AND target_chat_scope.id::text = ral.target_chat_id::text
           )
         )`);
    const params: any[] = [orgId];
    const conditions: string[] = [];

    if (userId) {
      params.push(userId);
      conditions.push(`target_user_id = $${params.length}`);
    }

    if (chatId) {
      params.push(chatId);
      conditions.push(`target_chat_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryParts.push('AND ' + conditions.join(' AND '));
    }

    params.push(limit);
    queryParts.push(`ORDER BY created_at DESC LIMIT $${params.length}`);

    const result = await pool.query(queryParts.join(' '), params);

    return result.rows.map((r) => ({
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      createdAt: r.created_at,
      details: r.details,
    }));
  } catch (error) {
    console.error('Failed to get retention audit log:', error);
    if ((error as { code?: string })?.code === 'RETENTION_AUDIT_ORG_REQUIRED') {
      throw error;
    }
    const wrapped = new Error('Failed to get retention audit log') as Error & { code?: string };
    wrapped.code = 'RETENTION_AUDIT_QUERY_FAILED';
    throw wrapped;
  }
}

/**
 * Schedule automated cleanup job (runs daily)
 */
export async function scheduleRetentionCleanup(): Promise<{ cleaned: number; error: string | null }> {
  try {
    const hasOrgColumn = await publicTableHasColumn('retention_policies', 'organization_id');
    // Get all policies with auto-delete enabled
    const policies = await pool.query(
      hasOrgColumn
        ? `SELECT id, type, organization_id, user_id, chat_id,
                  message_retention_days, message_artifacts_days, message_logs_days, tool_runs_days,
                  voice_transcripts_days, metadata_retention_days
           FROM retention_policies
           WHERE auto_delete_expired = true
             AND organization_id IS NOT NULL`
        : `SELECT rp.id,
                  rp.type,
                  org_scope.organization_id,
                  rp.user_id,
                  rp.chat_id,
                  rp.message_retention_days,
                  rp.message_artifacts_days,
                  rp.message_logs_days,
                  rp.tool_runs_days,
                  rp.voice_transcripts_days,
                  rp.metadata_retention_days
           FROM retention_policies rp
           LEFT JOIN LATERAL (
             SELECT c.organization_id
             FROM chats c
             WHERE rp.chat_id IS NOT NULL
               AND c.id::text = rp.chat_id::text
             LIMIT 1
           ) AS chat_scope ON TRUE
           LEFT JOIN LATERAL (
             SELECT om.organization_id
             FROM organization_memberships om
             WHERE rp.user_id IS NOT NULL
               AND om.user_id::text = rp.user_id::text
               AND om.status = 'active'
             ORDER BY om.created_at ASC NULLS LAST, om.organization_id ASC
             LIMIT 1
           ) AS user_scope ON TRUE
           LEFT JOIN LATERAL (
             SELECT o.id AS organization_id
             FROM organizations o
             ORDER BY o.created_at ASC NULLS LAST, o.id ASC
             LIMIT 1
           ) AS default_scope ON TRUE
           CROSS JOIN LATERAL (
             SELECT COALESCE(chat_scope.organization_id, user_scope.organization_id, default_scope.organization_id) AS organization_id
           ) AS org_scope
           WHERE rp.auto_delete_expired = true
             AND org_scope.organization_id IS NOT NULL`
    );

    let totalCleaned = 0;

    const tableHasColumn = async (tableName: string, columnName: string): Promise<boolean> => {
      const result = await pool.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
         LIMIT 1`,
        [tableName, columnName],
      );
      return result.rows.length > 0;
    };

    const findFirstExistingColumn = async (
      tableName: string,
      candidates: string[],
    ): Promise<string | null> => {
      for (const candidate of candidates) {
        if (await tableHasColumn(tableName, candidate)) return candidate;
      }
      return null;
    };

    const buildScopePredicate = async (
      tableName: string,
      scope: { type?: string; organizationId?: string | null; userId?: string | null; chatId?: string | null },
      params: unknown[],
    ): Promise<{ sql: string; applicable: boolean }> => {
      const scopeType = String(scope.type || '').trim();
      const scopeOrgId = String(scope.organizationId || '').trim();
      const scopeUserId = String(scope.userId || '').trim();
      const scopeChatId = String(scope.chatId || '').trim();
      const predicates: string[] = [];
      const tableQualified = `"${tableName}"`;

      if (scopeOrgId) {
        const orgColumn = await findFirstExistingColumn(tableName, ['organization_id']);
        if (orgColumn) {
          params.push(scopeOrgId);
          predicates.push(`${orgColumn}::text = $${params.length}::text`);
        } else {
          const chatScopeColumn = await findFirstExistingColumn(tableName, ['chat_id', 'source_chat_id', 'target_chat_id']);
          if (chatScopeColumn) {
            params.push(scopeOrgId);
            predicates.push(
              `EXISTS (
                 SELECT 1
                 FROM chats cleanup_chat_scope
                 WHERE cleanup_chat_scope.id::text = ${tableQualified}."${chatScopeColumn}"::text
                   AND cleanup_chat_scope.organization_id::text = $${params.length}::text
               )`,
            );
          } else {
            const userScopeColumn = await findFirstExistingColumn(
              tableName,
              ['user_id', 'sender_user_id', 'created_by', 'target_user_id', 'actor_user_id'],
            );
            if (userScopeColumn) {
              params.push(scopeOrgId);
              predicates.push(
                `EXISTS (
                   SELECT 1
                   FROM organization_memberships cleanup_user_scope
                   WHERE cleanup_user_scope.user_id::text = ${tableQualified}."${userScopeColumn}"::text
                     AND cleanup_user_scope.organization_id::text = $${params.length}::text
                     AND cleanup_user_scope.status = 'active'
                 )`,
              );
            } else {
              return { sql: '1=0', applicable: false };
            }
          }
        }
      }

      if (scopeType === 'global') {
        return { sql: predicates.length > 0 ? predicates.join(' AND ') : '1=1', applicable: true };
      }

      if (scopeType === 'per_chat') {
        if (!scopeChatId) return { sql: '1=0', applicable: false };
        const chatColumn = await findFirstExistingColumn(tableName, [
          'chat_id',
          'source_chat_id',
          'target_chat_id',
        ]);
        if (!chatColumn) return { sql: '1=0', applicable: false };
        params.push(scopeChatId);
        predicates.push(`${chatColumn} = $${params.length}`);
        return { sql: predicates.join(' AND '), applicable: true };
      }

      if (scopeType === 'per_user') {
        if (!scopeUserId) return { sql: '1=0', applicable: false };
        const userColumn = await findFirstExistingColumn(tableName, [
          'user_id',
          'sender_user_id',
          'created_by',
          'target_user_id',
          'actor_user_id',
        ]);
        if (!userColumn) return { sql: '1=0', applicable: false };
        params.push(scopeUserId);
        predicates.push(`${userColumn} = $${params.length}`);
        return { sql: predicates.join(' AND '), applicable: true };
      }

      return { sql: predicates.length > 0 ? predicates.join(' AND ') : '1=1', applicable: true };
    };

    const cleanupByAge = async (
      tableName: string,
      ageDays: number,
      dateColumn: string = 'created_at',
      scope: { type?: string; organizationId?: string | null; userId?: string | null; chatId?: string | null } = { type: 'global' },
    ): Promise<number> => {
      if (ageDays <= 0) return 0;
      const hasTableDateColumn = await tableHasColumn(tableName, dateColumn);
      if (!hasTableDateColumn) return 0;
      const params: unknown[] = [ageDays];
      const scoped = await buildScopePredicate(tableName, scope, params);
      if (!scoped.applicable) return 0;
      const result = await pool.query(
        `DELETE FROM ${tableName}
         WHERE ${dateColumn} < CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
           AND ${scoped.sql}`,
        params,
      );
      return result.rowCount || 0;
    };

    const cleanupByExpiryColumn = async (
      tableName: string,
      expiryColumn: string = 'retention_expires_at',
      scope: { type?: string; organizationId?: string | null; userId?: string | null; chatId?: string | null } = { type: 'global' },
    ): Promise<number> => {
      const hasExpiryColumn = await tableHasColumn(tableName, expiryColumn);
      if (!hasExpiryColumn) return 0;
      const params: unknown[] = [];
      const scoped = await buildScopePredicate(tableName, scope, params);
      if (!scoped.applicable) return 0;
      const result = await pool.query(
        `DELETE FROM ${tableName}
         WHERE ${expiryColumn} <= NOW()
           AND ${scoped.sql}`,
        params,
      );
      return result.rowCount || 0;
    };

    for (const policy of policies.rows) {
      const policyScope = {
        type: String(policy.type || 'global'),
        organizationId: String(policy.organization_id || '').trim() || null,
        userId: String(policy.user_id || '').trim() || null,
        chatId: String(policy.chat_id || '').trim() || null,
      };

      // Message body timeline
      if (policy.message_retention_days > 0) {
        totalCleaned += await cleanupByAge('messages', policy.message_retention_days, 'created_at', policyScope);
      }

      // Artifacts attached/generated from chats.
      if (policy.message_artifacts_days > 0) {
        totalCleaned += await cleanupByAge('artifacts', policy.message_artifacts_days, 'created_at', policyScope);
      }

      // Tool run traces.
      if (policy.tool_runs_days > 0) {
        totalCleaned += await cleanupByAge('tool_runs', policy.tool_runs_days, 'created_at', policyScope);
      }

      // Voice data (honor explicit per-record expiry when available).
      if (policy.voice_transcripts_days > 0) {
        totalCleaned += await cleanupByExpiryColumn('voice_transcripts', 'retention_expires_at', policyScope);
        totalCleaned += await cleanupByExpiryColumn('voice_tts_generated', 'retention_expires_at', policyScope);
        totalCleaned += await cleanupByAge('voice_transcripts', policy.voice_transcripts_days, 'created_at', policyScope);
        totalCleaned += await cleanupByAge('voice_tts_generated', policy.voice_transcripts_days, 'created_at', policyScope);
      }

      // Operational message logs.
      if (policy.message_logs_days > 0) {
        totalCleaned += await cleanupByAge('outbox', policy.message_logs_days, 'created_at', policyScope);
        totalCleaned += await cleanupByAge('notifications', policy.message_logs_days, 'created_at', policyScope);
      }

      // Metadata/audit trails.
      if (policy.metadata_retention_days > 0) {
        totalCleaned += await cleanupByAge('canvas_events', policy.metadata_retention_days, 'created_at', policyScope);
        totalCleaned += await cleanupByAge('webhook_events', policy.metadata_retention_days, 'created_at', policyScope);
        totalCleaned += await cleanupByAge('browser_audit_logs', policy.metadata_retention_days, 'created_at', policyScope);
      }
    }

    return { cleaned: totalCleaned, error: null };
  } catch (error) {
    console.error('Failed to schedule retention cleanup:', error);
    return { cleaned: 0, error: (error as Error).message };
  }
}
