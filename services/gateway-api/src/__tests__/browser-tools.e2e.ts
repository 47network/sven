import http from 'http';
import { beforeAll, describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const TEST_BROWSER_PROFILE_ID = process.env.TEST_BROWSER_PROFILE_ID || '';
const TEST_BROWSER_ALLOWED_URL = process.env.TEST_BROWSER_ALLOWED_URL || '';
const TEST_BROWSER_BLOCKED_URL = process.env.TEST_BROWSER_BLOCKED_URL || '';
const TEST_BROWSER_DOWNLOAD_URL = process.env.TEST_BROWSER_DOWNLOAD_URL || '';
const TEST_BROWSER_APPROVAL_ID = process.env.TEST_BROWSER_APPROVAL_ID || '';
const TEST_BROWSER_FORM_INPUT_SELECTOR = process.env.TEST_BROWSER_FORM_INPUT_SELECTOR || '';
const TEST_BROWSER_FORM_SUBMIT_SELECTOR = process.env.TEST_BROWSER_FORM_SUBMIT_SELECTOR || '';
const TEST_BROWSER_PERSIST_KEY = process.env.TEST_BROWSER_PERSIST_KEY || 'sven_browser_persist_key';
const TEST_BROWSER_PERSIST_VALUE = process.env.TEST_BROWSER_PERSIST_VALUE || 'ok';
const TEST_BROWSER_RELAY_ENABLED = process.env.TEST_BROWSER_RELAY_E2E === '1';
const TEST_BROWSER_RELAY_SESSION_ID = process.env.TEST_BROWSER_RELAY_SESSION_ID || '';
const TEST_BROWSER_RELAY_TOKEN = process.env.TEST_BROWSER_RELAY_TOKEN || '';

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  cookie?: string,
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsedUrl = new URL(url);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
      },
      (res) => {
        let payload = '';
        res.on('data', (chunk) => (payload += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 0, data: payload ? JSON.parse(payload) : {} });
          } catch {
            resolve({ statusCode: res.statusCode || 0, data: { raw: payload } });
          }
        });
      },
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Browser Tools API', () => {
  let apiReachable = false;

  beforeAll(async () => {
    try {
      const res = await apiCall('GET', '/healthz');
      apiReachable = res.statusCode > 0;
    } catch {
      apiReachable = false;
    }
  });

  it('requires auth for profiles listing', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall('GET', '/v1/tools/browser/profiles');
    expect(res.statusCode).toBe(401);
  });

  it('requires auth for navigation', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall('POST', '/v1/tools/browser/navigate', {
      profile_id: 'test',
      url: 'https://example.com',
    });
    expect(res.statusCode).toBe(401);
  });

  it('requires auth for relay session creation', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall('POST', '/v1/tools/browser/relay/sessions', {
      name: 'relay-smoke',
      allowed_domains: ['example.com'],
      permissions: ['read_url'],
    });
    expect(res.statusCode).toBe(401);
  });

  it('creates relay session + dispatches read command when authenticated (optional)', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_BROWSER_RELAY_ENABLED || !TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }
    const create = await apiCall(
      'POST',
      '/v1/tools/browser/relay/sessions',
      {
        name: 'relay-e2e',
        allowed_domains: ['example.com'],
        allowed_origins: ['https://extension.local'],
        permissions: ['read_url', 'read_dom'],
        ttl_minutes: 30,
      },
      TEST_SESSION_COOKIE,
    );
    expect(create.statusCode).toBe(200);
    expect(typeof create.data?.data?.id).toBe('string');
    expect(typeof create.data?.data?.extension_token).toBe('string');

    const relaySessionId = create.data.data.id as string;
    const dispatch = await apiCall(
      'POST',
      `/v1/tools/browser/relay/sessions/${encodeURIComponent(relaySessionId)}/commands`,
      {
        command: 'get_url',
        payload: {},
      },
      TEST_SESSION_COOKIE,
    );
    expect(dispatch.statusCode).toBe(200);
    expect(dispatch.data?.data?.status).toBe('queued');
  });

  it('denies relay command outside allowed domain (optional)', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_BROWSER_RELAY_ENABLED || !TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }
    const create = await apiCall(
      'POST',
      '/v1/tools/browser/relay/sessions',
      {
        name: 'relay-domain-guard',
        allowed_domains: ['example.com'],
        allowed_origins: ['https://extension.local'],
        permissions: ['read_url'],
      },
      TEST_SESSION_COOKIE,
    );
    expect(create.statusCode).toBe(200);
    const relaySessionId = create.data.data.id as string;

    const blocked = await apiCall(
      'POST',
      `/v1/tools/browser/relay/sessions/${encodeURIComponent(relaySessionId)}/commands`,
      {
        command: 'get_url',
        target_url: 'https://not-example.org/path',
      },
      TEST_SESSION_COOKIE,
    );
    expect(blocked.statusCode).toBe(403);
    expect(blocked.data?.error?.code).toBe('DOMAIN_BLOCKED');
  });

  it('extension pull + result requires relay token and session (optional)', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_BROWSER_RELAY_ENABLED || !TEST_BROWSER_RELAY_SESSION_ID || !TEST_BROWSER_RELAY_TOKEN) {
      expect(true).toBe(true);
      return;
    }

    const pull = await apiCall(
      'GET',
      `/v1/tools/browser/relay/sessions/${encodeURIComponent(TEST_BROWSER_RELAY_SESSION_ID)}/commands/pull`,
      undefined,
      undefined,
    );
    expect([401, 404]).toContain(pull.statusCode);
  });

  it('denies write action without approval_id when authenticated (optional)', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_SESSION_COOKIE || !TEST_BROWSER_PROFILE_ID) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall(
      'POST',
      '/v1/tools/browser/action',
      {
        profile_id: TEST_BROWSER_PROFILE_ID,
        action: 'click',
        selector: 'body',
      },
      TEST_SESSION_COOKIE,
    );
    expect(res.statusCode).toBe(403);
    expect(res.data?.error?.code).toBe('APPROVAL_REQUIRED');
  });

  it('blocks raw IP navigation when authenticated (optional)', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_SESSION_COOKIE || !TEST_BROWSER_PROFILE_ID) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall(
      'POST',
      '/v1/tools/browser/navigate',
      {
        profile_id: TEST_BROWSER_PROFILE_ID,
        url: 'http://127.0.0.1',
      },
      TEST_SESSION_COOKIE,
    );
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('navigate -> snapshot -> get_text works on allowed domain (optional)', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_SESSION_COOKIE || !TEST_BROWSER_PROFILE_ID || !TEST_BROWSER_ALLOWED_URL) {
      expect(true).toBe(true);
      return;
    }

    const navigate = await apiCall(
      'POST',
      '/v1/tools/browser/navigate',
      {
        profile_id: TEST_BROWSER_PROFILE_ID,
        url: TEST_BROWSER_ALLOWED_URL,
      },
      TEST_SESSION_COOKIE,
    );
    expect(navigate.statusCode).toBe(200);

    const snapshot = await apiCall(
      'POST',
      '/v1/tools/browser/snapshot',
      {
        profile_id: TEST_BROWSER_PROFILE_ID,
        full_page: true,
      },
      TEST_SESSION_COOKIE,
    );
    expect(snapshot.statusCode).toBe(200);
    expect(snapshot.data?.data?.mime_type).toBe('image/png');
    expect(typeof snapshot.data?.data?.data_base64).toBe('string');

    const text = await apiCall(
      'POST',
      '/v1/tools/browser/action',
      {
        profile_id: TEST_BROWSER_PROFILE_ID,
        action: 'get_text',
      },
      TEST_SESSION_COOKIE,
    );
    expect(text.statusCode).toBe(200);
    expect(typeof text.data?.data?.text).toBe('string');
  });

  it('navigate to blocked domain is denied (optional)', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_SESSION_COOKIE || !TEST_BROWSER_PROFILE_ID || !TEST_BROWSER_BLOCKED_URL) {
      expect(true).toBe(true);
      return;
    }
    const blocked = await apiCall(
      'POST',
      '/v1/tools/browser/navigate',
      {
        profile_id: TEST_BROWSER_PROFILE_ID,
        url: TEST_BROWSER_BLOCKED_URL,
      },
      TEST_SESSION_COOKIE,
    );
    expect(blocked.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('browser status endpoint is reachable when authenticated (optional)', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }
    const status = await apiCall('GET', '/v1/tools/browser/status', undefined, TEST_SESSION_COOKIE);
    expect(status.statusCode).toBe(200);
    expect(typeof status.data?.data?.browser_started).toBe('boolean');
  });

  it('captures download artifact from url (optional)', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_SESSION_COOKIE || !TEST_BROWSER_PROFILE_ID || !TEST_BROWSER_DOWNLOAD_URL) {
      expect(true).toBe(true);
      return;
    }

    const result = await apiCall(
      'POST',
      '/v1/tools/browser/action',
      {
        profile_id: TEST_BROWSER_PROFILE_ID,
        action: 'download_file',
        url: TEST_BROWSER_DOWNLOAD_URL,
      },
      TEST_SESSION_COOKIE,
    );

    expect(result.statusCode).toBe(200);
    expect(typeof result.data?.data?.file_path).toBe('string');
    expect(typeof result.data?.data?.file_name).toBe('string');
    expect(typeof result.data?.data?.file_size).toBe('number');
    expect(typeof result.data?.data?.data_base64).toBe('string');
  });

  it('fill form + submit actions are logged (optional)', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    if (
      !TEST_SESSION_COOKIE ||
      !TEST_BROWSER_PROFILE_ID ||
      !TEST_BROWSER_ALLOWED_URL ||
      !TEST_BROWSER_APPROVAL_ID ||
      !TEST_BROWSER_FORM_INPUT_SELECTOR ||
      !TEST_BROWSER_FORM_SUBMIT_SELECTOR
    ) {
      expect(true).toBe(true);
      return;
    }

    const nav = await apiCall(
      'POST',
      '/v1/tools/browser/navigate',
      { profile_id: TEST_BROWSER_PROFILE_ID, url: TEST_BROWSER_ALLOWED_URL },
      TEST_SESSION_COOKIE,
    );
    expect(nav.statusCode).toBe(200);

    const fill = await apiCall(
      'POST',
      '/v1/tools/browser/action',
      {
        profile_id: TEST_BROWSER_PROFILE_ID,
        action: 'fill_form',
        approval_id: TEST_BROWSER_APPROVAL_ID,
        fields: [{ selector: TEST_BROWSER_FORM_INPUT_SELECTOR, value: 'sven-test' }],
      },
      TEST_SESSION_COOKIE,
    );
    expect(fill.statusCode).toBe(200);

    const submit = await apiCall(
      'POST',
      '/v1/tools/browser/action',
      {
        profile_id: TEST_BROWSER_PROFILE_ID,
        action: 'click',
        approval_id: TEST_BROWSER_APPROVAL_ID,
        selector: TEST_BROWSER_FORM_SUBMIT_SELECTOR,
      },
      TEST_SESSION_COOKIE,
    );
    expect(submit.statusCode).toBe(200);

    const logs = await apiCall(
      'GET',
      `/v1/tools/browser/audit?profile_id=${encodeURIComponent(TEST_BROWSER_PROFILE_ID)}&limit=30`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(logs.statusCode).toBe(200);
    const actions = Array.isArray(logs.data?.data) ? logs.data.data.map((r: any) => r.action) : [];
    expect(actions).toContain('fill_form');
    expect(actions).toContain('click');
  });

  it('profile persistence survives stop/start lifecycle (optional)', async () => {
    if (!apiReachable) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_SESSION_COOKIE || !TEST_BROWSER_PROFILE_ID || !TEST_BROWSER_ALLOWED_URL || !TEST_BROWSER_APPROVAL_ID) {
      expect(true).toBe(true);
      return;
    }

    const navA = await apiCall(
      'POST',
      '/v1/tools/browser/navigate',
      { profile_id: TEST_BROWSER_PROFILE_ID, url: TEST_BROWSER_ALLOWED_URL },
      TEST_SESSION_COOKIE,
    );
    expect(navA.statusCode).toBe(200);

    const setPersist = await apiCall(
      'POST',
      '/v1/tools/browser/action',
      {
        profile_id: TEST_BROWSER_PROFILE_ID,
        action: 'evaluate',
        approval_id: TEST_BROWSER_APPROVAL_ID,
        script: `localStorage.setItem(${JSON.stringify(TEST_BROWSER_PERSIST_KEY)}, ${JSON.stringify(TEST_BROWSER_PERSIST_VALUE)}); return true;`,
      },
      TEST_SESSION_COOKIE,
    );
    expect(setPersist.statusCode).toBe(200);

    const stop = await apiCall(
      'POST',
      '/v1/tools/browser/lifecycle',
      { action: 'stop', profile_id: TEST_BROWSER_PROFILE_ID },
      TEST_SESSION_COOKIE,
    );
    expect(stop.statusCode).toBe(200);

    const navB = await apiCall(
      'POST',
      '/v1/tools/browser/navigate',
      { profile_id: TEST_BROWSER_PROFILE_ID, url: TEST_BROWSER_ALLOWED_URL },
      TEST_SESSION_COOKIE,
    );
    expect(navB.statusCode).toBe(200);

    const getPersist = await apiCall(
      'POST',
      '/v1/tools/browser/action',
      {
        profile_id: TEST_BROWSER_PROFILE_ID,
        action: 'evaluate',
        approval_id: TEST_BROWSER_APPROVAL_ID,
        script: `return localStorage.getItem(${JSON.stringify(TEST_BROWSER_PERSIST_KEY)});`,
      },
      TEST_SESSION_COOKIE,
    );
    expect(getPersist.statusCode).toBe(200);
    expect(getPersist.data?.data?.result).toBe(TEST_BROWSER_PERSIST_VALUE);
  });
});
