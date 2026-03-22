import http from 'http';
import pg from 'pg';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

type ApiResult = {
  statusCode: number;
  data: unknown;
};

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  opts?: { bearer?: string; cookie?: string },
): Promise<ApiResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${API_BASE}${endpoint}`);
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(Buffer.byteLength(payload));
    }
    if (opts?.bearer) headers.authorization = `Bearer ${opts.bearer}`;
    if (opts?.cookie) headers.cookie = opts.cookie;

    const req = http.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += String(chunk);
        });
        res.on('end', () => {
          let parsedBody: unknown = {};
          try {
            parsedBody = raw ? JSON.parse(raw) : {};
          } catch {
            parsedBody = { raw };
          }
          resolve({
            statusCode: res.statusCode || 0,
            data: parsedBody,
          });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getBearerFromSessionCookie(cookie: string): Promise<string> {
  const started = await apiCall('POST', '/v1/auth/device/start', {
    client_name: `recovery-playbook-${Date.now()}`,
    client_type: 'ci',
    scope: 'integration recovery playbook',
  });
  expect(started.statusCode).toBe(200);
  const deviceCode = String((started.data as { data?: { device_code?: unknown } })?.data?.device_code || '');
  const userCode = String((started.data as { data?: { user_code?: unknown } })?.data?.user_code || '');
  expect(deviceCode).toBeTruthy();
  expect(userCode).toBeTruthy();

  const confirmed = await apiCall('POST', '/v1/auth/device/confirm', { user_code: userCode }, { cookie });
  expect(confirmed.statusCode).toBe(200);

  const tokenResp = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
  expect(tokenResp.statusCode).toBe(200);
  const token = String((tokenResp.data as { data?: { access_token?: unknown } })?.data?.access_token || '');
  expect(token).toBeTruthy();
  return token;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const PLAYBOOK_LOCK_NAMESPACE = 0x49525042;

function toSignedInt32(value: number): number {
  const normalized = value >>> 0;
  return normalized > 0x7fffffff ? normalized - 0x100000000 : normalized;
}

function derivePlaybookLockKeys(orgId: string): [number, number] {
  const cleaned = String(orgId || '').trim().toLowerCase().replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/.test(cleaned)) {
    throw new Error('invalid org id for advisory lock');
  }
  const partA = Number.parseInt(cleaned.slice(0, 8), 16);
  const partB = Number.parseInt(cleaned.slice(8, 16), 16);
  return [toSignedInt32(partA ^ PLAYBOOK_LOCK_NAMESPACE), toSignedInt32(partB)];
}

describe('integration recovery playbook API', () => {
  it('runs server-side recovery flow and reports summary', async () => {
    if (!TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    let chatId = '';
    let orgId = '';
    let bearer = '';

    try {
      bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);

      const created = await apiCall('POST', '/v1/chats', { name: `playbook-${Date.now()}`, type: 'dm' }, { bearer });
      expect(created.statusCode).toBe(201);
      chatId = String((created.data as { data?: { id?: unknown } })?.data?.id || '');
      expect(chatId).toBeTruthy();

      const chatRow = await pool.query(`SELECT organization_id FROM chats WHERE id = $1 LIMIT 1`, [chatId]);
      orgId = String(chatRow.rows[0]?.organization_id || '');
      expect(orgId).toBeTruthy();

      const lockKeys = derivePlaybookLockKeys(orgId);
      await pool.query(`SELECT pg_advisory_lock($1, $2)`, lockKeys);
      const lockedResp = await apiCall(
        'POST',
        '/v1/admin/integrations/catalog/recovery-playbook',
        {
          retry_failed: false,
          deploy_stopped: false,
          apply_templates_unconfigured: false,
          validate_unconfigured: false,
        },
        { bearer },
      );
      expect(lockedResp.statusCode).toBe(409);
      const lockedError = (lockedResp.data as { error?: Record<string, unknown> })?.error || {};
      expect(String(lockedError.code || '')).toBe('PLAYBOOK_IN_PROGRESS');
      expect(String(lockedError.message || '')).toContain('already running');
      await pool.query(`SELECT pg_advisory_unlock($1, $2)`, lockKeys);

      await pool.query(
        `INSERT INTO integration_runtime_instances
           (organization_id, integration_type, runtime_mode, status, image_ref, storage_path, network_scope, deployment_spec, updated_at)
         VALUES
           ($1, 'web', 'container', 'stopped', 'sven/integration-web:latest', $2, $3, '{}'::jsonb, NOW())
         ON CONFLICT (organization_id, integration_type) DO UPDATE
         SET status = 'stopped', updated_at = NOW()`,
        [orgId, `/tmp/sven/${orgId}/web`, `sven-org-${orgId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}`],
      );

      const runResp = await apiCall(
        'POST',
        '/v1/admin/integrations/catalog/recovery-playbook',
        {
          retry_failed: false,
          deploy_stopped: true,
          apply_templates_unconfigured: false,
          validate_unconfigured: false,
        },
        { bearer },
      );
      expect(runResp.statusCode).toBe(200);
      const payload = (runResp.data as { data?: Record<string, unknown> })?.data || {};
      expect(typeof payload.run_id).toBe('string');
      expect(String(payload.run_id || '')).toBeTruthy();
      const summary = (payload.summary as Record<string, Record<string, unknown>>) || {};
      const deployStopped = summary.deploy_stopped || {};
      expect(Number(deployStopped.attempted || 0)).toBeGreaterThan(0);
      expect(Number(deployStopped.succeeded || 0)).toBeGreaterThan(0);

      const historyResp = await apiCall(
        'GET',
        '/v1/admin/integrations/catalog/recovery-playbook/runs?limit=5',
        undefined,
        { bearer },
      );
      expect(historyResp.statusCode).toBe(200);
      const historyRows = ((historyResp.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
      expect(historyRows.length).toBeGreaterThan(0);
      const latest = historyRows[0] || {};
      expect(typeof latest.id).toBe('string');
      expect(String(latest.organization_id || '')).toBe(orgId);
      expect(['in_progress', 'completed', 'failed']).toContain(String(latest.run_status || ''));

      const detailResp = await apiCall(
        'GET',
        `/v1/admin/integrations/catalog/recovery-playbook/runs/${encodeURIComponent(String(latest.id || ''))}`,
        undefined,
        { bearer },
      );
      expect(detailResp.statusCode).toBe(200);
      const detail = ((detailResp.data as { data?: Record<string, unknown> })?.data || {}) as Record<string, unknown>;
      expect(String(detail.id || '')).toBe(String(latest.id || ''));
      expect(typeof detail.result).toBe('object');

      const noFailureResp = await apiCall(
        'GET',
        '/v1/admin/integrations/catalog/recovery-playbook/runs?limit=5&has_failures=false',
        undefined,
        { bearer },
      );
      expect(noFailureResp.statusCode).toBe(200);
      const noFailureRows = ((noFailureResp.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
      expect(noFailureRows.length).toBeGreaterThan(0);
      expect(noFailureRows.some((row) => String(row.id || '') === String(latest.id || ''))).toBe(true);

      const completedResp = await apiCall(
        'GET',
        '/v1/admin/integrations/catalog/recovery-playbook/runs?limit=5&run_status=completed',
        undefined,
        { bearer },
      );
      expect(completedResp.statusCode).toBe(200);
      const completedRows = ((completedResp.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
      expect(completedRows.length).toBeGreaterThan(0);
      expect(completedRows.every((row) => String(row.run_status || '') === 'completed')).toBe(true);

      const csvResp = await apiCall(
        'GET',
        '/v1/admin/integrations/catalog/recovery-playbook/runs?limit=5&format=csv',
        undefined,
        { bearer },
      );
      expect(csvResp.statusCode).toBe(200);
      const rawCsv = String((csvResp.data as { raw?: unknown })?.raw || '');
      expect(rawCsv.includes('id,created_at,actor_user_id')).toBe(true);

      const pagedResp = await apiCall(
        'GET',
        '/v1/admin/integrations/catalog/recovery-playbook/runs?limit=1&page=1&sort=created_at&order=desc',
        undefined,
        { bearer },
      );
      expect(pagedResp.statusCode).toBe(200);
      const paged = (pagedResp.data as { meta?: Record<string, unknown> })?.meta || {};
      expect(Number(paged.page || 0)).toBe(1);
      expect(Number(paged.limit || 0)).toBe(1);
      const statusCounts =
        (paged.status_counts as Record<string, unknown> | undefined) || {};
      expect(typeof statusCounts).toBe('object');
      expect(Number(statusCounts.completed || 0)).toBeGreaterThanOrEqual(1);
    } finally {
      if (orgId) {
        await pool.query(
          `DELETE FROM integration_runtime_instances
            WHERE organization_id = $1
              AND integration_type = 'web'`,
          [orgId],
        );
      }
      await pool.end();
      if (chatId && bearer) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, { bearer });
      }
    }
  });
});
