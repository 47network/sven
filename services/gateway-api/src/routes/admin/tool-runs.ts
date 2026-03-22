import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { parsePaginationQuery } from './pagination.js';

export async function registerToolRunRoutes(app: FastifyInstance, pool: pg.Pool) {
  const TOOL_RUN_PUBLIC_SELECT = `tr.id,
                                  tr.tool_name,
                                  tr.chat_id,
                                  tr.user_id,
                                  tr.approval_id,
                                  tr.status,
                                  tr.duration_ms,
                                  tr.created_at,
                                  tr.completed_at,
                                  tr.prev_hash,
                                  tr.run_hash,
                                  tr.canonical_io_sha256`;

  function projectToolRunRow(row: Record<string, unknown>) {
    return {
      id: row.id,
      tool_name: row.tool_name,
      chat_id: row.chat_id,
      user_id: row.user_id,
      approval_id: row.approval_id,
      status: row.status,
      duration_ms: row.duration_ms,
      created_at: row.created_at,
      completed_at: row.completed_at,
      prev_hash: row.prev_hash,
      run_hash: row.run_hash,
      canonical_io_sha256: row.canonical_io_sha256,
    };
  }

  function parseIsoTimestamp(value: string | undefined, field: 'from' | 'to'): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      throw new Error(`${field} must be a valid ISO-8601 timestamp`);
    }
    return parsed.toISOString();
  }

  const AUDIT_SENSITIVE_KEYS = new Set([
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'password',
    'secret',
    'api_key',
    'apikey',
    'cookie',
  ]);

  function redactAuditValue(value: unknown, keyHint?: string): unknown {
    const key = String(keyHint || '').trim().toLowerCase();
    if (key && (AUDIT_SENSITIVE_KEYS.has(key) || key.endsWith('_token') || key.endsWith('_secret') || key.endsWith('_password'))) {
      return '[REDACTED]';
    }
    if (Array.isArray(value)) {
      return value.map((item) => redactAuditValue(item));
    }
    if (value && typeof value === 'object') {
      const output: Record<string, unknown> = {};
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        output[nestedKey] = redactAuditValue(nestedValue, nestedKey);
      }
      return output;
    }
    return value;
  }

  function redactAuditError(raw: unknown): string | null {
    if (typeof raw !== 'string' || !raw) return null;
    return raw
      .replace(/(bearer\s+)[^\s]+/ig, '$1[REDACTED]')
      .replace(/sk-[a-z0-9_-]+/ig, '[REDACTED]')
      .replace(/(token=)[^&\s]+/ig, '$1[REDACTED]');
  }

  function projectAuditExportRow(row: Record<string, unknown>) {
    return {
      id: row.id,
      run_id: row.run_id,
      event_type: row.event_type,
      tool_name: row.tool_name,
      chat_id: row.chat_id,
      user_id: row.user_id,
      user_username: row.user_username,
      status: row.status,
      inputs: redactAuditValue(row.inputs),
      outputs: redactAuditValue(row.outputs),
      error: redactAuditError(row.error),
      file_changes: row.file_changes,
      prev_hash: row.prev_hash,
      entry_hash: row.entry_hash,
      created_at: row.created_at,
    };
  }

  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  // ─── GET /runs ───
  app.get('/runs', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const query = request.query as {
      page?: string;
      per_page?: string;
      tool_name?: string;
      status?: string;
      chat_id?: string;
    };
    const pagination = parsePaginationQuery(query, { defaultPage: 1, defaultPerPage: 20, maxPerPage: 100 });
    if (!pagination.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: pagination.message },
      });
    }
    const { page, perPage, offset } = pagination;

    let sql = `SELECT ${TOOL_RUN_PUBLIC_SELECT}
               FROM tool_runs tr
               JOIN chats c ON c.id = tr.chat_id
               WHERE c.organization_id = $1`;
    const params: unknown[] = [orgId];

    if (query.tool_name) { params.push(query.tool_name); sql += ` AND tr.tool_name = $${params.length}`; }
    if (query.status) { params.push(query.status); sql += ` AND tr.status = $${params.length}`; }
    if (query.chat_id) { params.push(query.chat_id); sql += ` AND tr.chat_id = $${params.length}`; }

    let countSql = `SELECT COUNT(*)::int AS count
                    FROM tool_runs tr
                    JOIN chats c ON c.id = tr.chat_id
                    WHERE c.organization_id = $1`;
    const countParams: unknown[] = [orgId];
    if (query.tool_name) {
      countParams.push(query.tool_name);
      countSql += ` AND tr.tool_name = $${countParams.length}`;
    }
    if (query.status) {
      countParams.push(query.status);
      countSql += ` AND tr.status = $${countParams.length}`;
    }
    if (query.chat_id) {
      countParams.push(query.chat_id);
      countSql += ` AND tr.chat_id = $${countParams.length}`;
    }
    const countRes = await pool.query(countSql, countParams);
    const total: number = countRes.rows[0].count;

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(perPage, offset);

    const result = await pool.query(sql, params);

    reply.send({
      success: true,
      data: result.rows.map((row) => projectToolRunRow(row as Record<string, unknown>)),
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    });
  });

  // ─── GET /runs/:id ───
  app.get('/runs/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT ${TOOL_RUN_PUBLIC_SELECT}
       FROM tool_runs tr
       JOIN chats c ON c.id = tr.chat_id
       WHERE tr.id = $1 AND c.organization_id = $2`,
      [id, orgId],
    );
    if (result.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Run not found' } });
      return;
    }
    reply.send({ success: true, data: projectToolRunRow(result.rows[0] as Record<string, unknown>) });
  });

  // ─── GET /audit/export ───
  app.get('/audit/export', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { from, to } = request.query as { from?: string; to?: string };
    let fromIso: string | null = null;
    let toIso: string | null = null;
    try {
      fromIso = parseIsoTimestamp(from, 'from');
      toIso = parseIsoTimestamp(to, 'to');
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: err instanceof Error ? err.message : 'Invalid date range' },
      });
    }

    let sql = `SELECT al.id,
                      al.run_id,
                      al.event_type,
                      al.tool_name,
                      al.chat_id,
                      al.user_id,
                      al.status,
                      al.inputs,
                      al.outputs,
                      al.error,
                      al.file_changes,
                      al.prev_hash,
                      al.entry_hash,
                      al.created_at,
                      u.username as user_username
               FROM tool_execution_audit_log al
               LEFT JOIN users u ON al.user_id = u.id
               JOIN chats c ON c.id = al.chat_id
               WHERE c.organization_id = $1`;
    const params: unknown[] = [orgId];

    if (fromIso) { params.push(fromIso); sql += ` AND al.created_at >= $${params.length}`; }
    if (toIso) { params.push(toIso); sql += ` AND al.created_at <= $${params.length}`; }

    sql += ' ORDER BY al.created_at ASC, al.id ASC';

    const result = await pool.query(sql, params);

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="sven-audit-export.json"');
    reply.send({
      success: true,
      data: result.rows.map((row) => projectAuditExportRow(row as Record<string, unknown>)),
      exported_at: new Date().toISOString(),
    });
  });
}
