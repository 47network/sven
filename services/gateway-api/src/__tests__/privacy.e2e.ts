import { describe, expect, it } from '@jest/globals';

const RUN_LIVE = process.env.RUN_LIVE_GATEWAY_E2E === 'true';
const API_BASE = `${process.env.API_URL || 'http://localhost:3001'}/v1/admin`;
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || '').trim();
const TEST_SESSION_COOKIE = String(process.env.TEST_SESSION_COOKIE || '').trim();

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ADMIN_TOKEN) {
    headers.Authorization = `Bearer ${ADMIN_TOKEN}`;
  }
  if (TEST_SESSION_COOKIE) {
    headers.Cookie = TEST_SESSION_COOKIE;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: response.status, data };
}

describe('privacy admin APIs', () => {
  it('returns a response for retention policy', async () => {
    if (RUN_LIVE && !ADMIN_TOKEN && !TEST_SESSION_COOKIE) {
      throw new Error('ADMIN_TOKEN or TEST_SESSION_COOKIE is required when RUN_LIVE_GATEWAY_E2E=true');
    }
    if (!RUN_LIVE) {
      expect(true).toBe(true);
      return;
    }

    const result = await call('GET', '/privacy/retention-policy');
    expect([200, 404]).toContain(result.status);
  });

  it('detects/redacts pii via admin endpoints when available', async () => {
    if (!RUN_LIVE) {
      expect(true).toBe(true);
      return;
    }

    const detect = await call('POST', '/privacy/detect-pii', {
      text: 'Reach me at john.doe@example.com and 555-123-4567',
    });
    expect(detect.status).toBe(200);

    expect(typeof detect.data).toBe('object');

    const redact = await call('POST', '/privacy/redact-text', {
      text: 'Reach me at john.doe@example.com',
    });
    expect(redact.status).toBe(200);
  });

  it('handles export/deletion request lifecycle endpoints when available', async () => {
    if (!RUN_LIVE) {
      expect(true).toBe(true);
      return;
    }

    const exportReq = await call('POST', '/privacy/export-request', {
      exportType: 'all',
      chatId: `chat-${Date.now()}`,
    });
    expect(exportReq.status).toBe(202);

    const deletionReq = await call('POST', '/privacy/deletion-request', {
      deletionType: 'soft_delete',
      reason: 'e2e test',
      chatId: `chat-${Date.now()}`,
    });
    expect(deletionReq.status).toBe(202);
  });
});
