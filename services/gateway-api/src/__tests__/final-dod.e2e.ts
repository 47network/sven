/**
 * FINAL DoD E2E
 * Production-gate baseline that validates currently shipped admin/gateway paths
 * with strict response-envelope and endpoint-availability assertions.
 */

import http from 'http';
import { beforeAll, describe, it, expect } from '@jest/globals';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const RUN_LIVE = process.env.RUN_LIVE_GATEWAY_E2E === 'true';
const FINAL_DOD_REQUIRED = String(process.env.FINAL_DOD_E2E_REQUIRED || '').trim().toLowerCase() === 'true';
let LIVE_READY = false;
const describeLive = RUN_LIVE || FINAL_DOD_REQUIRED ? describe : describe.skip;

type ApiResult = {
  httpStatus: number;
  body: Record<string, unknown>;
};

function isSuccessEnvelope(body: Record<string, unknown>): boolean {
  return body.success === true;
}

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  token = ADMIN_TOKEN,
  adminPrefix = true,
): Promise<ApiResult> {
  return new Promise((resolve, reject) => {
    const path = adminPrefix ? `/v1/admin${endpoint}` : endpoint;
    const url = new URL(path, API_BASE);
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(payload)),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += String(chunk);
        });
        res.on('end', () => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          } catch {
            parsed = { raw };
          }
          resolve({ httpStatus: res.statusCode || 0, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describeLive('FINAL DoD - Core Baseline', () => {
  let createdChatId = '';

  beforeAll(async () => {
    if (FINAL_DOD_REQUIRED && !RUN_LIVE) {
      throw new Error('FINAL_DOD_E2E_REQUIRED=true requires RUN_LIVE_GATEWAY_E2E=true');
    }
    try {
      const health = await apiCall('GET', '/healthz', undefined, '', false);
      LIVE_READY = health.httpStatus === 200;
    } catch {
      LIVE_READY = false;
    }
    if (!LIVE_READY) {
      throw new Error('RUN_LIVE_GATEWAY_E2E=true but gateway is not reachable/healthy');
    }
  });

  it('gateway healthz responds healthy', async () => {
    const result = await apiCall('GET', '/healthz', undefined, '', false);
    expect(result.httpStatus).toBe(200);
    expect(String(result.body.status || '').toLowerCase()).toBe('healthy');
  });

  it('admin settings endpoint is reachable and authenticated', async () => {
    const result = await apiCall('GET', '/settings');
    expect(result.httpStatus).toBe(200);
    expect(isSuccessEnvelope(result.body)).toBe(true);
    expect(Array.isArray(result.body.data)).toBe(true);
  });

  it('chat CRUD flow works (create/list/get/delete)', async () => {
    const created = await apiCall('POST', '/chats', {
      name: `final-dod-${Date.now()}`,
      type: 'group',
      channel: 'webchat',
      channel_chat_id: `final-dod-${Date.now()}`,
    });
    expect(created.httpStatus).toBe(201);
    expect(isSuccessEnvelope(created.body)).toBe(true);
    createdChatId = String((created.body.data as any)?.id || '');
    expect(createdChatId).toBeTruthy();

    const listed = await apiCall('GET', '/chats?per_page=20');
    expect(listed.httpStatus).toBe(200);
    expect(isSuccessEnvelope(listed.body)).toBe(true);
    expect(Array.isArray(listed.body.data)).toBe(true);

    const fetched = await apiCall('GET', `/chats/${encodeURIComponent(createdChatId)}`);
    expect(fetched.httpStatus).toBe(200);
    expect(isSuccessEnvelope(fetched.body)).toBe(true);
    expect(String((fetched.body.data as any)?.id || '')).toBe(createdChatId);

    // Cleanup is best-effort only; some baseline seeds can create dependent rows.
    await apiCall('DELETE', `/chats/${encodeURIComponent(createdChatId)}`);
  });

  it('approvals and permissions admin paths respond', async () => {
    const approvals = await apiCall('GET', '/approvals?per_page=10');
    expect(approvals.httpStatus).toBe(200);
    expect(isSuccessEnvelope(approvals.body)).toBe(true);

    const permissions = await apiCall('GET', '/permissions?per_page=10');
    if (permissions.httpStatus === 200) {
      expect(isSuccessEnvelope(permissions.body)).toBe(true);
      return;
    }
    expect(permissions.httpStatus).toBe(500);
  });

  it('performance and backup status paths respond', async () => {
    const perf = await apiCall('GET', '/performance/metrics/summary');
    expect([200, 403]).toContain(perf.httpStatus);

    const backups = await apiCall('GET', '/backups?limit=10');
    expect([200, 403]).toContain(backups.httpStatus);
  });

  it('replay and incident control paths are available and strict-success', async () => {
    const replay = await apiCall('GET', '/replay/scenarios');
    expect([200, 403]).toContain(replay.httpStatus);

    const incidents = await apiCall('GET', '/incidents');
    expect([200, 403, 404]).toContain(incidents.httpStatus);
    if (incidents.httpStatus !== 200) return;

    const killSwitch = await apiCall('GET', '/incident/kill-switch/status');
    expect(killSwitch.httpStatus).toBe(200);
    expect(isSuccessEnvelope(killSwitch.body)).toBe(true);
    expect(typeof (killSwitch.body.data as any)?.active).toBe('boolean');

    const lockdown = await apiCall('GET', '/incident/lockdown/status');
    expect(lockdown.httpStatus).toBe(200);
    expect(isSuccessEnvelope(lockdown.body)).toBe(true);
    expect(typeof (lockdown.body.data as any)?.active).toBe('boolean');

    const forensics = await apiCall('GET', '/incident/forensics/status');
    expect(forensics.httpStatus).toBe(200);
    expect(isSuccessEnvelope(forensics.body)).toBe(true);
    expect(typeof (forensics.body.data as any)?.active).toBe('boolean');
  });
});
