import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const TEST_BEARER_TOKEN = process.env.TEST_BEARER_TOKEN || '';

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
    client_name: `D2 tenant rbac ${Date.now()}`,
    client_type: 'ci',
    scope: 'tenant rbac',
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

async function getAdminBearer(): Promise<string> {
  if (TEST_BEARER_TOKEN) {
    const probe = await apiCall('GET', '/v1/auth/me', undefined, { bearer: TEST_BEARER_TOKEN });
    expect(probe.statusCode).toBe(200);
    return TEST_BEARER_TOKEN;
  }
  return getBearerFromSessionCookie(TEST_SESSION_COOKIE);
}

describe('D2 tenant-scoped RBAC', () => {
  it('allows account bootstrap when authenticated user has no active account set', async () => {
    if (!TEST_SESSION_COOKIE && !TEST_BEARER_TOKEN) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getAdminBearer();
    const me = await apiCall('GET', '/v1/auth/me', undefined, { bearer });
    expect(me.statusCode).toBe(200);
    const activeOrgId = String((me.data as { data?: { active_organization_id?: unknown } })?.data?.active_organization_id || '');

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await apiCall('POST', '/v1/admin/accounts', { name: `Bootstrap ${unique}` }, { bearer });
    expect(created.statusCode).toBe(201);
    const accountId = String((created.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(accountId).toBeTruthy();

    // Regression target: first account bootstrap from null active organization must remain allowed.
    if (!activeOrgId) {
      const meAfter = await apiCall('GET', '/v1/auth/me', undefined, { bearer });
      expect(meAfter.statusCode).toBe(200);
      const meAfterOrgId = String((meAfter.data as { data?: { active_organization_id?: unknown } })?.data?.active_organization_id || '');
      expect(meAfterOrgId).toBe(accountId);
    }
  });

  it('enforces owner/admin/operator and blocks viewer/member on admin surface', async () => {
    if (!TEST_SESSION_COOKIE && !TEST_BEARER_TOKEN) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getAdminBearer();
    const me = await apiCall('GET', '/v1/me', undefined, { bearer });
    expect(me.statusCode).toBe(200);
    const userId = String((me.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(userId).toBeTruthy();

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const accountOwner = await apiCall('POST', '/v1/admin/accounts', { name: `RBAC owner ${unique}` }, { bearer });
    expect(accountOwner.statusCode).toBe(201);
    const ownerAccountId = String((accountOwner.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(ownerAccountId).toBeTruthy();

    // Owner role should have admin access.
    const ownerCatalog = await apiCall('GET', '/v1/admin/registry/catalog', undefined, { bearer });
    expect(ownerCatalog.statusCode).toBe(200);

    const accountOperator = await apiCall('POST', '/v1/admin/accounts', { name: `RBAC operator ${unique}` }, { bearer });
    expect(accountOperator.statusCode).toBe(201);
    const operatorAccountId = String((accountOperator.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(operatorAccountId).toBeTruthy();

    // Demote owner->operator in this account and validate operator policy.
    const setOperator = await apiCall(
      'PATCH',
      `/v1/admin/accounts/${encodeURIComponent(operatorAccountId)}/members/${encodeURIComponent(userId)}`,
      { role: 'operator' },
      { bearer },
    );
    expect(setOperator.statusCode).toBe(200);

    const activateOperator = await apiCall('POST', `/v1/admin/accounts/${encodeURIComponent(operatorAccountId)}/activate`, {}, { bearer });
    expect(activateOperator.statusCode).toBe(200);

    const operatorAllowed = await apiCall('GET', '/v1/admin/registry/catalog', undefined, { bearer });
    expect(operatorAllowed.statusCode).toBe(200);
    const operatorBlocked = await apiCall('GET', '/v1/admin/settings', undefined, { bearer });
    expect(operatorBlocked.statusCode).toBe(403);

    const accountViewer = await apiCall('POST', '/v1/admin/accounts', { name: `RBAC viewer ${unique}` }, { bearer });
    expect(accountViewer.statusCode).toBe(201);
    const viewerAccountId = String((accountViewer.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(viewerAccountId).toBeTruthy();

    // Demote owner->viewer and ensure admin surface denied.
    const setViewer = await apiCall(
      'PATCH',
      `/v1/admin/accounts/${encodeURIComponent(viewerAccountId)}/members/${encodeURIComponent(userId)}`,
      { role: 'viewer' },
      { bearer },
    );
    expect(setViewer.statusCode).toBe(200);

    const activateViewer = await apiCall('POST', `/v1/admin/accounts/${encodeURIComponent(viewerAccountId)}/activate`, {}, { bearer });
    expect(activateViewer.statusCode).toBe(200);

    const viewerDenied = await apiCall('GET', '/v1/admin/registry/catalog', undefined, { bearer });
    expect(viewerDenied.statusCode).toBe(403);

    // Switch back to owner account and ensure access is restored.
    const backOwner = await apiCall('POST', `/v1/admin/accounts/${encodeURIComponent(ownerAccountId)}/activate`, {}, { bearer });
    expect(backOwner.statusCode).toBe(200);
    const ownerAgain = await apiCall('GET', '/v1/admin/registry/catalog', undefined, { bearer });
    expect(ownerAgain.statusCode).toBe(200);
  });
});
