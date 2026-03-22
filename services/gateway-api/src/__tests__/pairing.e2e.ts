import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const TEST_ADAPTER_TOKEN = process.env.TEST_ADAPTER_TOKEN || '';
const TEST_PAIRING_CHANNEL = process.env.TEST_PAIRING_CHANNEL || 'discord';

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  opts?: { cookie?: string; adapterToken?: string },
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsedUrl = new URL(url);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts?.cookie) headers.Cookie = opts.cookie;
    if (opts?.adapterToken) headers['X-SVEN-ADAPTER-TOKEN'] = opts.adapterToken;

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

describe('DM Pairing Flow', () => {
  it('unknown sender receives pairing code and approval enables identity resolve (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !TEST_ADAPTER_TOKEN) {
      expect(true).toBe(true);
      return;
    }
    const sender = `pairing-user-${Date.now()}`;

    const setPairing = await apiCall(
      'PUT',
      `/v1/admin/settings/${encodeURIComponent(`adapter.${TEST_PAIRING_CHANNEL}.dm.policy`)}`,
      { value: 'pairing' },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect([200, 201]).toContain(setPairing.statusCode);

    const firstResolve = await apiCall(
      'POST',
      '/v1/adapter/identity/resolve',
      { channel: TEST_PAIRING_CHANNEL, channel_user_id: sender, display_name: sender },
      { adapterToken: TEST_ADAPTER_TOKEN },
    );
    expect(firstResolve.statusCode).toBe(202);
    expect(firstResolve.data?.data?.requires_pairing).toBe(true);
    const code = String(firstResolve.data?.data?.code || '');
    expect(code).toMatch(/^\d{6}$/);

    const approved = await apiCall(
      'POST',
      '/v1/admin/pairing/approve',
      { channel: TEST_PAIRING_CHANNEL, code },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect(approved.statusCode).toBe(200);

    const secondResolve = await apiCall(
      'POST',
      '/v1/adapter/identity/resolve',
      { channel: TEST_PAIRING_CHANNEL, channel_user_id: sender, display_name: sender },
      { adapterToken: TEST_ADAPTER_TOKEN },
    );
    expect(secondResolve.statusCode).toBe(200);
    expect(typeof secondResolve.data?.data?.identity_id).toBe('string');
  });

  it('dmPolicy=open allows unknown sender immediately (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !TEST_ADAPTER_TOKEN) {
      expect(true).toBe(true);
      return;
    }
    const sender = `open-user-${Date.now()}`;

    const setOpen = await apiCall(
      'PUT',
      `/v1/admin/settings/${encodeURIComponent(`adapter.${TEST_PAIRING_CHANNEL}.dm.policy`)}`,
      { value: 'open' },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect([200, 201]).toContain(setOpen.statusCode);

    const resolveOpen = await apiCall(
      'POST',
      '/v1/adapter/identity/resolve',
      { channel: TEST_PAIRING_CHANNEL, channel_user_id: sender, display_name: sender },
      { adapterToken: TEST_ADAPTER_TOKEN },
    );
    expect(resolveOpen.statusCode).toBe(200);
    expect(typeof resolveOpen.data?.data?.identity_id).toBe('string');
  });

  it('dmPolicy=deny blocks unknown sender (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !TEST_ADAPTER_TOKEN) {
      expect(true).toBe(true);
      return;
    }
    const sender = `deny-user-${Date.now()}`;

    const setDeny = await apiCall(
      'PUT',
      `/v1/admin/settings/${encodeURIComponent(`adapter.${TEST_PAIRING_CHANNEL}.dm.policy`)}`,
      { value: 'deny' },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect([200, 201]).toContain(setDeny.statusCode);

    const resolveDeny = await apiCall(
      'POST',
      '/v1/adapter/identity/resolve',
      { channel: TEST_PAIRING_CHANNEL, channel_user_id: sender, display_name: sender },
      { adapterToken: TEST_ADAPTER_TOKEN },
    );
    expect(resolveDeny.statusCode).toBe(403);
  });

  it('expired pairing code regenerates on next message (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !TEST_ADAPTER_TOKEN) {
      expect(true).toBe(true);
      return;
    }
    const sender = `exp-user-${Date.now()}`;

    const setPairing = await apiCall(
      'PUT',
      `/v1/admin/settings/${encodeURIComponent(`adapter.${TEST_PAIRING_CHANNEL}.dm.policy`)}`,
      { value: 'pairing' },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect([200, 201]).toContain(setPairing.statusCode);

    const setTtl = await apiCall(
      'PUT',
      `/v1/admin/settings/${encodeURIComponent(`adapter.${TEST_PAIRING_CHANNEL}.dm.pairing_ttl_seconds`)}`,
      { value: 1 },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect([200, 201]).toContain(setTtl.statusCode);

    const firstResolve = await apiCall(
      'POST',
      '/v1/adapter/identity/resolve',
      { channel: TEST_PAIRING_CHANNEL, channel_user_id: sender, display_name: sender },
      { adapterToken: TEST_ADAPTER_TOKEN },
    );
    expect(firstResolve.statusCode).toBe(202);
    const code1 = String(firstResolve.data?.data?.code || '');
    expect(code1).toMatch(/^\d{6}$/);

    await new Promise((resolve) => setTimeout(resolve, 1300));

    const secondResolve = await apiCall(
      'POST',
      '/v1/adapter/identity/resolve',
      { channel: TEST_PAIRING_CHANNEL, channel_user_id: sender, display_name: sender },
      { adapterToken: TEST_ADAPTER_TOKEN },
    );
    expect(secondResolve.statusCode).toBe(202);
    const code2 = String(secondResolve.data?.data?.code || '');
    expect(code2).toMatch(/^\d{6}$/);
    expect(code2).not.toBe(code1);
  });

  it('deny with block prevents future pairing attempts (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !TEST_ADAPTER_TOKEN) {
      expect(true).toBe(true);
      return;
    }
    const sender = `blocked-user-${Date.now()}`;

    const setPairing = await apiCall(
      'PUT',
      `/v1/admin/settings/${encodeURIComponent(`adapter.${TEST_PAIRING_CHANNEL}.dm.policy`)}`,
      { value: 'pairing' },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect([200, 201]).toContain(setPairing.statusCode);

    const firstResolve = await apiCall(
      'POST',
      '/v1/adapter/identity/resolve',
      { channel: TEST_PAIRING_CHANNEL, channel_user_id: sender, display_name: sender },
      { adapterToken: TEST_ADAPTER_TOKEN },
    );
    expect(firstResolve.statusCode).toBe(202);
    const code = String(firstResolve.data?.data?.code || '');
    expect(code).toMatch(/^\d{6}$/);

    const denied = await apiCall(
      'POST',
      '/v1/admin/pairing/deny',
      { channel: TEST_PAIRING_CHANNEL, code, block: true },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect(denied.statusCode).toBe(200);
    expect(denied.data?.data?.blocked).toBe(true);

    const secondResolve = await apiCall(
      'POST',
      '/v1/adapter/identity/resolve',
      { channel: TEST_PAIRING_CHANNEL, channel_user_id: sender, display_name: sender },
      { adapterToken: TEST_ADAPTER_TOKEN },
    );
    expect(secondResolve.statusCode).toBe(403);
    expect(secondResolve.data?.error?.code).toBe('DM_BLOCKED');
  });

  it('wildcard allowlist permits unknown sender in pairing mode (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !TEST_ADAPTER_TOKEN) {
      expect(true).toBe(true);
      return;
    }
    const sender = `wild-user-${Date.now()}`;

    const setPairing = await apiCall(
      'PUT',
      `/v1/admin/settings/${encodeURIComponent(`adapter.${TEST_PAIRING_CHANNEL}.dm.policy`)}`,
      { value: 'pairing' },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect([200, 201]).toContain(setPairing.statusCode);

    const addWildcard = await apiCall(
      'POST',
      '/v1/admin/pairing/allowlist',
      { channel: TEST_PAIRING_CHANNEL, sender_id: '*' },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect(addWildcard.statusCode).toBe(200);

    const wildcardResolve = await apiCall(
      'POST',
      '/v1/adapter/identity/resolve',
      { channel: TEST_PAIRING_CHANNEL, channel_user_id: sender, display_name: sender },
      { adapterToken: TEST_ADAPTER_TOKEN },
    );
    expect(wildcardResolve.statusCode).toBe(200);
    expect(typeof wildcardResolve.data?.data?.identity_id).toBe('string');
  });
});
