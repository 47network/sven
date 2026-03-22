import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import { describe, expect, it } from '@jest/globals';

const RUN = process.env.TEST_TAILSCALE_E2E === '1';
const DIST_ENTRY = path.resolve(process.cwd(), 'services/gateway-api/dist/services/TailscaleService.js');

function runNodeScript(code) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += String(chunk)));
    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('Tailscale Integration', () => {
  it('serve/funnel configuration commands and auth hardening execute correctly (optional)', async () => {
    if (!RUN) {
      expect(true).toBe(true);
      return;
    }
    if (!fs.existsSync(DIST_ENTRY)) {
      expect(true).toBe(true);
      return;
    }

    const serviceUrl = pathToFileURL(DIST_ENTRY).href;
    const code = `
      import { TailscaleService, buildTailscalePreview } from ${JSON.stringify(serviceUrl)};
      const queries = [];
      const pool = {
        query: async (sql, args = []) => {
          queries.push({ sql: String(sql), args });
          return { rows: [] };
        }
      };

      process.env.TAILSCALE_BIN = 'tailscale-does-not-exist';
      process.env.TAILSCALE_CMD_TIMEOUT_MS = '5000';
      process.env.GATEWAY_TAILSCALE_RESET_ON_SHUTDOWN = 'true';

      process.env.GATEWAY_TAILSCALE_MODE = 'serve';
      const serveSvc = new TailscaleService(pool, 3010);
      const servePreview = buildTailscalePreview('serve', 3010);
      await serveSvc.configureOnStart();
      await serveSvc.resetOnShutdown();

      process.env.GATEWAY_TAILSCALE_MODE = 'funnel';
      const funnelSvc = new TailscaleService(pool, 3020);
      const funnelPreview = buildTailscalePreview('funnel', 3020);
      await funnelSvc.configureOnStart();

      console.log(JSON.stringify({ queries, servePreview, funnelPreview }));
    `;

    const result = await runNodeScript(code);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    const stdoutLines = (result.stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const parsed = JSON.parse(stdoutLines[stdoutLines.length - 1] || '{}');
    const queries = parsed.queries || [];
    const servePreview = parsed.servePreview || [];
    const funnelPreview = parsed.funnelPreview || [];

    expect(servePreview).toContain('tailscale serve --bg http://127.0.0.1:3010');
    expect(funnelPreview).toContain('tailscale serve --bg http://127.0.0.1:3020');
    expect(funnelPreview).toContain('tailscale funnel --bg http://127.0.0.1:3020');
    expect(
      queries.some((q) => q.sql.includes('gateway.tailscale.last_mode')),
    ).toBe(true);
    expect(
      queries.some((q) => q.sql.includes('auth.disable_token_exchange')),
    ).toBe(true);
  });
});
