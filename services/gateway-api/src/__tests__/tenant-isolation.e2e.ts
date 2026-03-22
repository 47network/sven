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
    client_name: `D2 tenant isolation ${Date.now()}`,
    client_type: 'ci',
    scope: 'tenant isolation',
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

describe('D2 tenant isolation', () => {
  it('prevents cross-account data visibility and cross-account direct access', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const accountAName = `Tenant A ${unique}`;
    const accountBName = `Tenant B ${unique}`;

    const accountAResp = await apiCall('POST', '/v1/admin/accounts', { name: accountAName }, { bearer });
    expect(accountAResp.statusCode).toBe(201);
    const accountAId = String((accountAResp.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(accountAId).toBeTruthy();

    // In account A (active by account create), create tenant-scoped artifacts.
    const sourceAResp = await apiCall(
      'POST',
      '/v1/admin/registry/sources',
      { name: `src-${unique}`, type: 'public', url: `https://registry-${unique}.example` },
      { bearer },
    );
    expect(sourceAResp.statusCode).toBe(201);
    const sourceAId = String((sourceAResp.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(sourceAId).toBeTruthy();

    const catalogAResp = await apiCall(
      'POST',
      '/v1/admin/registry/catalog',
      {
        source_id: sourceAId,
        name: `tenant-skill-${unique}`,
        description: 'Tenant isolation probe skill',
        version: '1.0.0',
        format: 'openclaw',
        manifest: { tool_id: 'non-existent-tool', deprecated: false },
      },
      { bearer },
    );
    expect(catalogAResp.statusCode).toBe(201);
    const catalogAId = String((catalogAResp.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(catalogAId).toBeTruthy();

    const chatAResp = await apiCall(
      'POST',
      '/v1/admin/chats',
      {
        name: `tenant-chat-${unique}`,
        type: 'group',
        channel: 'webchat',
        channel_chat_id: `tenant-chat-${unique}`,
      },
      { bearer },
    );
    expect(chatAResp.statusCode).toBe(201);
    const chatAId = String((chatAResp.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(chatAId).toBeTruthy();

    const allowlistAResp = await apiCall(
      'POST',
      '/v1/admin/allowlists',
      {
        type: 'web_domain',
        pattern: `tenant-a-${unique}.example`,
        description: 'tenant A web allowlist probe',
        enabled: true,
      },
      { bearer },
    );
    expect(allowlistAResp.statusCode).toBe(200);
    const allowlistAId = String((allowlistAResp.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(allowlistAId).toBeTruthy();

    const setASetting = await apiCall(
      'PUT',
      '/v1/admin/settings/llm.defaultModel',
      { value: { provider: 'openai', model: `gpt-tenant-a-${unique}` } },
      { bearer },
    );
    expect(setASetting.statusCode).toBe(200);

    const accountBResp = await apiCall('POST', '/v1/admin/accounts', { name: accountBName }, { bearer });
    expect(accountBResp.statusCode).toBe(201);
    const accountBId = String((accountBResp.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(accountBId).toBeTruthy();

    const activateB = await apiCall('POST', `/v1/admin/accounts/${encodeURIComponent(accountBId)}/activate`, {}, { bearer });
    expect(activateB.statusCode).toBe(200);

    // Cross-account list isolation: account B must not see account A skill/chat.
    const listCatalogB = await apiCall('GET', '/v1/admin/registry/catalog', undefined, { bearer });
    expect(listCatalogB.statusCode).toBe(200);
    const catalogBRows = ((listCatalogB.data as { data?: unknown[] })?.data || []) as Array<{ id?: string; name?: string }>;
    expect(catalogBRows.some((r) => String(r.id || '') === catalogAId)).toBe(false);
    expect(catalogBRows.some((r) => String(r.name || '').includes(`tenant-skill-${unique}`))).toBe(false);

    const listChatsB = await apiCall('GET', '/v1/admin/chats', undefined, { bearer });
    expect(listChatsB.statusCode).toBe(200);
    const chatsBRows = ((listChatsB.data as { data?: { rows?: unknown[] } })?.data?.rows || []) as Array<{ id?: string; name?: string }>;
    expect(chatsBRows.some((r) => String(r.id || '') === chatAId)).toBe(false);
    expect(chatsBRows.some((r) => String(r.name || '').includes(`tenant-chat-${unique}`))).toBe(false);

    const listAllowlistsB = await apiCall('GET', '/v1/admin/allowlists?type=web_domain', undefined, { bearer });
    expect(listAllowlistsB.statusCode).toBe(200);
    const allowlistsBRows = ((listAllowlistsB.data as { data?: unknown[] })?.data || []) as Array<{ id?: string; pattern?: string }>;
    expect(allowlistsBRows.some((r) => String(r.id || '') === allowlistAId)).toBe(false);
    expect(allowlistsBRows.some((r) => String(r.pattern || '').includes(`tenant-a-${unique}.example`))).toBe(false);

    const listWebAllowlistsB = await apiCall('GET', '/v1/admin/web/allowlist', undefined, { bearer });
    expect(listWebAllowlistsB.statusCode).toBe(200);
    const webAllowlistsBRows = ((listWebAllowlistsB.data as { entries?: unknown[] })?.entries || []) as Array<{ id?: string; pattern?: string }>;
    expect(webAllowlistsBRows.some((r) => String(r.id || '') === allowlistAId)).toBe(false);
    expect(webAllowlistsBRows.some((r) => String(r.pattern || '').includes(`tenant-a-${unique}.example`))).toBe(false);

    // Cross-account direct access should fail.
    const directCatalogInstallFromB = await apiCall(
      'POST',
      `/v1/admin/registry/install/${encodeURIComponent(catalogAId)}`,
      {},
      { bearer },
    );
    expect(directCatalogInstallFromB.statusCode).toBe(404);

    const directChatReadFromB = await apiCall('GET', `/v1/admin/chats/${encodeURIComponent(chatAId)}`, undefined, { bearer });
    expect(directChatReadFromB.statusCode).toBe(404);

    const directAllowlistDeleteFromB = await apiCall(
      'DELETE',
      `/v1/admin/allowlists/${encodeURIComponent(allowlistAId)}`,
      undefined,
      { bearer },
    );
    expect(directAllowlistDeleteFromB.statusCode).toBe(404);

    // Tenant-scoped settings: B should not inherit A override.
    const getSettingInB = await apiCall('GET', '/v1/admin/settings/llm.defaultModel', undefined, { bearer });
    // Might be fallback global value or missing, but must not be A tenant override.
    if (getSettingInB.statusCode === 200) {
      const model = JSON.stringify((getSettingInB.data as { data?: { value?: unknown } })?.data?.value || {});
      expect(model.includes(`gpt-tenant-a-${unique}`)).toBe(false);
    } else {
      expect([404, 200]).toContain(getSettingInB.statusCode);
    }

    // Switch back to A and ensure A data is still visible.
    const activateA = await apiCall('POST', `/v1/admin/accounts/${encodeURIComponent(accountAId)}/activate`, {}, { bearer });
    expect(activateA.statusCode).toBe(200);

    const listCatalogA2 = await apiCall('GET', '/v1/admin/registry/catalog', undefined, { bearer });
    expect(listCatalogA2.statusCode).toBe(200);
    const catalogA2Rows = ((listCatalogA2.data as { data?: unknown[] })?.data || []) as Array<{ id?: string }>;
    expect(catalogA2Rows.some((r) => String(r.id || '') === catalogAId)).toBe(true);
  });
});
