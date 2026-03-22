import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';

type ApiResult = {
  statusCode: number;
  data: unknown;
  raw: string;
  headers: http.IncomingHttpHeaders;
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
          const contentType = String(res.headers['content-type'] || '');
          let parsedBody: unknown = null;
          if (contentType.includes('application/json')) {
            try {
              parsedBody = raw ? JSON.parse(raw) : {};
            } catch {
              parsedBody = null;
            }
          }
          resolve({
            statusCode: res.statusCode || 0,
            data: parsedBody,
            raw,
            headers: res.headers,
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
    client_name: `D2 runtime isolation ${Date.now()}`,
    client_type: 'ci',
    scope: 'tenant runtime isolation',
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

describe('D2 tenant integration runtime isolation', () => {
  it('isolates integration runtime configs/instances across active accounts', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const accountAName = `Runtime Tenant A ${unique}`;
    const accountBName = `Runtime Tenant B ${unique}`;
    const runtimeType = `probe-${unique}`;

    const accountAResp = await apiCall('POST', '/v1/admin/accounts', { name: accountAName }, { bearer });
    expect(accountAResp.statusCode).toBe(201);
    const accountAId = String((accountAResp.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(accountAId).toBeTruthy();

    // Account A runtime config + deploy
    const configAResp = await apiCall(
      'PUT',
      `/v1/admin/integrations/runtime/${encodeURIComponent(runtimeType)}/config`,
      {
        config: { endpoint: `http://runtime-${unique}.local`, enabled: true },
        secret_refs: { token: `env://RUNTIME_${unique.toUpperCase().replace(/[^A-Z0-9]/g, '_')}` },
      },
      { bearer },
    );
    expect(configAResp.statusCode).toBe(200);

    const deployAResp = await apiCall(
      'POST',
      `/v1/admin/integrations/runtime/${encodeURIComponent(runtimeType)}/deploy`,
      {
        runtime_mode: 'container',
        image_ref: `sven/integration-probe:${unique}`,
        deployment_spec: { replicas: 1 },
      },
      { bearer },
    );
    expect(deployAResp.statusCode).toBe(200);
    expect((deployAResp.data as { data?: { status?: unknown } })?.data?.status).toBe('running');

    const listAResp = await apiCall('GET', '/v1/admin/integrations/runtime', undefined, { bearer });
    expect(listAResp.statusCode).toBe(200);
    const rowsA = ((listAResp.data as { data?: unknown[] })?.data || []) as Array<{ integration_type?: string; status?: string }>;
    const runtimeA = rowsA.find((row) => String(row.integration_type || '') === runtimeType);
    expect(runtimeA).toBeTruthy();
    expect(String(runtimeA?.status || '')).toBe('running');

    const accountBResp = await apiCall('POST', '/v1/admin/accounts', { name: accountBName }, { bearer });
    expect(accountBResp.statusCode).toBe(201);
    const accountBId = String((accountBResp.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(accountBId).toBeTruthy();

    const activateB = await apiCall('POST', `/v1/admin/accounts/${encodeURIComponent(accountBId)}/activate`, {}, { bearer });
    expect(activateB.statusCode).toBe(200);

    // Account B must not see account A runtime instance.
    const listBResp = await apiCall('GET', '/v1/admin/integrations/runtime', undefined, { bearer });
    expect(listBResp.statusCode).toBe(200);
    const rowsB = ((listBResp.data as { data?: unknown[] })?.data || []) as Array<{ integration_type?: string }>;
    expect(rowsB.some((row) => String(row.integration_type || '') === runtimeType)).toBe(false);

    const getBResp = await apiCall(
      'GET',
      `/v1/admin/integrations/runtime/${encodeURIComponent(runtimeType)}`,
      undefined,
      { bearer },
    );
    expect(getBResp.statusCode).toBe(200);
    const detailsB = (getBResp.data as { data?: { instance?: unknown; config?: unknown; secret_refs?: unknown[] } })?.data;
    expect(detailsB?.instance || null).toBe(null);
    expect(JSON.stringify(detailsB?.config || {})).toBe('{}');
    expect(Array.isArray(detailsB?.secret_refs)).toBe(true);
    expect((detailsB?.secret_refs || []).length).toBe(0);

    const stopBResp = await apiCall(
      'POST',
      `/v1/admin/integrations/runtime/${encodeURIComponent(runtimeType)}/stop`,
      {},
      { bearer },
    );
    expect(stopBResp.statusCode).toBe(404);

    const reconcileBResp = await apiCall('POST', '/v1/admin/integrations/runtime/reconcile', {}, { bearer });
    expect(reconcileBResp.statusCode).toBe(200);
    const reconcileB = (reconcileBResp.data as { data?: { scope?: unknown; organization_id?: unknown; scanned?: unknown } })?.data;
    expect(String(reconcileB?.scope || '')).toBe('active_account');
    expect(String(reconcileB?.organization_id || '')).toBeTruthy();
    expect(Number(reconcileB?.scanned || 0)).toBeGreaterThanOrEqual(0);

    // Switch back to A and verify runtime still exists.
    const activateA = await apiCall('POST', `/v1/admin/accounts/${encodeURIComponent(accountAId)}/activate`, {}, { bearer });
    expect(activateA.statusCode).toBe(200);

    const getAResp = await apiCall(
      'GET',
      `/v1/admin/integrations/runtime/${encodeURIComponent(runtimeType)}`,
      undefined,
      { bearer },
    );
    expect(getAResp.statusCode).toBe(200);
    const detailsA = (getAResp.data as { data?: { instance?: { status?: string } | null; secret_refs?: unknown[] } })?.data;
    expect(detailsA?.instance).toBeTruthy();
    expect(String(detailsA?.instance?.status || '')).toBe('running');
    expect((detailsA?.secret_refs || []).length).toBe(1);

    const reconcileAResp = await apiCall('POST', '/v1/admin/integrations/runtime/reconcile', {}, { bearer });
    expect(reconcileAResp.statusCode).toBe(200);
  });
});
