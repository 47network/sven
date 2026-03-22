const { spawnSync } = require('node:child_process');
const { createServer } = require('node:http');
const { resolve } = require('node:path');
const { existsSync, rmSync, writeFileSync } = require('node:fs');

const CLI_PATH = resolve(__dirname, '..', 'bin', 'sven.js');

function runCli(args, env = {}) {
  return spawnSync('node', [CLI_PATH, ...args], {
    encoding: 'utf8',
    env: { ...process.env, SVEN_SECURITY_AUDIT_SKIP_DOCKER: '1', ...env },
  });
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolveClose) => server.close(resolveClose));
}

function startMockGateway(opts = {}) {
  const deepLogoutVulnerable = opts.deepLogoutVulnerable === true;
  return new Promise((resolveReady) => {
    const state = { patches: [] };
    const server = createServer((req, res) => {
      const method = req.method || 'GET';
      const url = req.url || '/';
      const hasCookie = Boolean(req.headers.cookie);

      if (url === '/healthz') {
        return json(res, 200, { ok: true });
      }

      if (url === '/v1/admin/settings') {
        if (!hasCookie) return json(res, 401, { error: 'unauthorized' });
        return json(res, 200, {
          data: {
            admin_password: 'password',
            api_key: 'changeme',
          },
        });
      }

      if (url === '/v1/admin/settings/global/auth') {
        if (!hasCookie) return json(res, 401, { error: 'unauthorized' });
        return json(res, 200, { data: { totp_required: false } });
      }

      if (url === '/v1/admin/settings/global' && method === 'GET') {
        if (!hasCookie) return json(res, 401, { error: 'unauthorized' });
        return json(res, 200, {
          data: {
            'network.egress_proxy': '',
            'backup.enabled': false,
            'cors.origin': '*',
            'rate_limit.enabled': false,
            'auth.totp_required': false,
          },
        });
      }

      if (url === '/v1/admin/settings/global' && method === 'PATCH') {
        let body = '';
        req.on('data', (chunk) => {
          body += String(chunk || '');
        });
        req.on('end', () => {
          try {
            state.patches.push(JSON.parse(body || '{}'));
          } catch {
            state.patches.push({});
          }
          json(res, 200, { ok: true });
        });
        return;
      }

      if (url === '/v1/admin/kill-switch') {
        if (!hasCookie) return json(res, 401, { error: 'unauthorized' });
        return json(res, 200, { data: { enabled: false } });
      }

      if (url === '/v1/admin/users') {
        if (!hasCookie) return json(res, 401, { error: 'unauthorized' });
        return json(res, 200, { data: [] });
      }

      if (url === '/v1/canvas/chats') {
        if (!hasCookie) return json(res, 401, { error: 'unauthorized' });
        return json(res, 200, { data: [] });
      }

      if (url === '/v1/auth/login' && method === 'GET') {
        return json(res, 405, { error: 'method_not_allowed' });
      }

      if (url === '/v1/auth/login' && method === 'POST') {
        return json(res, 401, { error: 'invalid' });
      }

      if (url === '/v1/auth/refresh' && method === 'POST') {
        return json(res, 401, { error: 'unauthorized' });
      }

      if (url === '/v1/auth/logout' && method === 'POST') {
        if (deepLogoutVulnerable) {
          return json(res, 200, { ok: true });
        }
        return json(res, 403, { error: 'csrf_forbidden' });
      }

      if (url === '/v1/auth/token-exchange' && method === 'POST') {
        return json(res, 401, { error: 'unauthorized' });
      }

      return json(res, 404, { error: 'not_found' });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolveReady({ server, url: `http://127.0.0.1:${port}`, state });
    });
  });
}

function writeSecurityConfig(configPath) {
  const config = {
    gateway_url: 'http://127.0.0.1:3999',
    gateway: {
      cors_origin: '*',
    },
    auth: {
      cookie_secret: 'short',
      cookie_secure: false,
      admin_password: 'changeme',
    },
    secrets: {
      api_key: 'plaintext-secret',
    },
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

describe('sven security audit', () => {
  jest.setTimeout(30000);

  it('detects expected findings for insecure configuration', async () => {
    const { server, url } = await startMockGateway();
    const configPath = resolve(__dirname, '..', '.tmp-security-audit-config.json');

    try {
      if (existsSync(configPath)) rmSync(configPath, { force: true });
      writeSecurityConfig(configPath);

      const proc = runCli([
        'security',
        'audit',
        '--url',
        url,
        '--cookie',
        'session=admin',
        '--config',
        configPath,
        '--json',
      ]);

      expect(proc.status).toBe(1);
      const out = JSON.parse(proc.stdout || '{}');
      expect(out.status).toBe('fail');

      const ids = (out.findings || []).map((f) => f.id);
      expect(ids).toEqual(
        expect.arrayContaining([
          'SEC-001',
          'SEC-002',
          'SEC-003',
          'SEC-004',
          'SEC-006',
          'SEC-008',
          'SEC-009',
          'SEC-010',
          'SEC-017',
          'SEC-018',
          'SEC-019',
          'SEC-020',
        ]),
      );
    } finally {
      await closeServer(server);
      if (existsSync(configPath)) rmSync(configPath, { force: true });
    }
  });

  it('marks fixable findings as fixed when --fix is enabled', async () => {
    const { server, url, state } = await startMockGateway();
    const configPath = resolve(__dirname, '..', '.tmp-security-audit-config.json');

    try {
      if (existsSync(configPath)) rmSync(configPath, { force: true });
      writeSecurityConfig(configPath);

      const proc = runCli([
        'security',
        'audit',
        '--url',
        url,
        '--cookie',
        'session=admin',
        '--config',
        configPath,
        '--json',
        '--fix',
      ]);

      expect(proc.status).toBe(1);
      const out = JSON.parse(proc.stdout || '{}');
      expect(out.status).toBe('fail');
      expect(out.summary?.fixed).toBeGreaterThanOrEqual(3);

      const fixedMap = new Map((out.findings || []).map((f) => [f.id, f.fixed]));
      expect(fixedMap.get('SEC-003')).toBe(true);
      expect(fixedMap.get('SEC-008')).toBe(true);
      expect(fixedMap.get('SEC-009')).toBe(true);
      expect(state.patches.length).toBeGreaterThanOrEqual(3);
    } finally {
      await closeServer(server);
      if (existsSync(configPath)) rmSync(configPath, { force: true });
    }
  });

  it('runs deep mode probes and reports deep-mode findings/metadata', async () => {
    const { server, url } = await startMockGateway({ deepLogoutVulnerable: true });

    try {
      const proc = runCli([
        'security',
        'audit',
        '--url',
        url,
        '--cookie',
        'session=admin',
        '--deep',
        '--json',
      ]);

      expect(proc.status).toBe(1);
      const out = JSON.parse(proc.stdout || '{}');
      expect(out.mode?.deep).toBe(true);
      const ids = (out.findings || []).map((f) => f.id);
      expect(ids).toContain('SEC-021');
    } finally {
      await closeServer(server);
    }
  });
});
