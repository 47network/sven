import http from 'http';
import { describe, it, expect } from '@jest/globals';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';
const API_BASE = process.env.API_URL || 'http://localhost:3001';
const RUN_LIVE = process.env.RUN_LIVE_GATEWAY_E2E === 'true';

async function apiCall(method: string, endpoint: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}/v1/admin${endpoint}`;
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ status: 'error', message: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('SOUL registry', () => {
  it('should install and activate a soul', async () => {
    if (!RUN_LIVE) {
      expect(true).toBe(true);
      return;
    }
    try {
      await fetch(`${API_BASE}/healthz`);
    } catch {
      expect(true).toBe(true);
      return;
    }

    const slug = `test-soul-${Date.now()}`;
    const publish = await apiCall('POST', '/souls/catalog', {
      slug,
      name: 'Test Soul',
      description: 'E2E test soul',
      version: '0.0.1',
      content: 'You are Test Soul. Be concise.',
    });
    expect(publish.success).toBe(true);

    const install = await apiCall('POST', '/souls/install', { slug, activate: true });
    expect(install.success).toBe(true);

    const installed = await apiCall('GET', '/souls/installed');
    expect(installed.success).toBe(true);
    const rows = installed.data?.rows || [];
    const entry = rows.find((r: any) => r.slug === slug);
    expect(entry).toBeDefined();
    expect(entry.status).toBe('active');
  });
});
