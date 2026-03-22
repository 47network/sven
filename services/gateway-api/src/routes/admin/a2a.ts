import { FastifyInstance } from 'fastify';
import pg from 'pg';

function parseIsoTimestamp(value: string): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const epoch = Date.parse(raw);
  if (!Number.isFinite(epoch)) return null;
  return new Date(epoch).toISOString();
}

function parseA2AAuditLimit(raw: unknown): number | null {
  if (raw === undefined || raw === null) return 500;
  if (String(raw).trim() === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return Math.min(parsed, 5000);
}

function toSafeCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/^(\s*)([=+\-@])/, "$1'$2");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function registerA2AAdminRoutes(app: FastifyInstance, pool: pg.Pool) {
  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  // ─── GET /a2a/audit/export ───
  app.get('/a2a/audit/export', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }

    const query = request.query as {
      from?: string;
      to?: string;
      status?: string;
      request_id?: string;
      limit?: string;
      format?: string;
    };
    const fromIso = query.from ? parseIsoTimestamp(query.from) : null;
    if (query.from && !fromIso) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'from must be a valid ISO timestamp' },
      });
    }
    const toIso = query.to ? parseIsoTimestamp(query.to) : null;
    if (query.to && !toIso) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'to must be a valid ISO timestamp' },
      });
    }
    if (fromIso && toIso && Date.parse(toIso) < Date.parse(fromIso)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'to must be greater than or equal to from' },
      });
    }

    let sql = `SELECT id, organization_id, request_id, action, direction, status, trace_id, upstream_trace_id, peer_url, error_code, error_message, created_at
               FROM a2a_audit_log
               WHERE organization_id = $1`;
    const params: unknown[] = [orgId];

    if (fromIso) {
      params.push(fromIso);
      sql += ` AND created_at >= $${params.length}`;
    }
    if (toIso) {
      params.push(toIso);
      sql += ` AND created_at <= $${params.length}`;
    }
    if (query.status) {
      params.push(query.status);
      sql += ` AND status = $${params.length}`;
    }
    if (query.request_id) {
      params.push(query.request_id);
      sql += ` AND request_id = $${params.length}`;
    }

    const limit = parseA2AAuditLimit(query.limit);
    if (limit === null) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be a positive integer when provided' },
      });
    }
    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await pool.query(sql, params);
    const format = String(query.format || '').toLowerCase();

    if (format === 'csv') {
      const header = [
        'id',
        'organization_id',
        'request_id',
        'action',
        'direction',
        'status',
        'trace_id',
        'upstream_trace_id',
        'peer_url',
        'error_code',
        'error_message',
        'created_at',
      ];
      const rows = result.rows.map((row) =>
        header
          .map((col) => {
            const val = row[col];
            return toSafeCsvCell(val);
          })
          .join(','),
      );
      const csv = [header.join(','), ...rows].join('\n');
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="sven-a2a-audit-export.csv"');
      return reply.send(csv);
    }

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="sven-a2a-audit-export.json"');
    return reply.send({
      success: true,
      data: result.rows,
      exported_at: new Date().toISOString(),
    });
  });
}
