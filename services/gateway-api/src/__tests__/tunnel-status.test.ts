import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTunnelStatus } from '../routes/admin/tunnel';

const ENV_BACKUP = {
  provider: process.env.SVEN_TUNNEL_PROVIDER,
  publicUrl: process.env.SVEN_TUNNEL_PUBLIC_URL,
  urlFile: process.env.SVEN_TUNNEL_URL_FILE,
  logFile: process.env.SVEN_TUNNEL_LOG_FILE,
};

afterEach(() => {
  process.env.SVEN_TUNNEL_PROVIDER = ENV_BACKUP.provider;
  process.env.SVEN_TUNNEL_PUBLIC_URL = ENV_BACKUP.publicUrl;
  process.env.SVEN_TUNNEL_URL_FILE = ENV_BACKUP.urlFile;
  process.env.SVEN_TUNNEL_LOG_FILE = ENV_BACKUP.logFile;
});

describe('tunnel status resolver', () => {
  it('prefers explicit env tunnel URL', () => {
    process.env.SVEN_TUNNEL_PROVIDER = 'cloudflare';
    process.env.SVEN_TUNNEL_PUBLIC_URL = 'https://abc.trycloudflare.com';
    process.env.SVEN_TUNNEL_URL_FILE = '';
    process.env.SVEN_TUNNEL_LOG_FILE = '';

    const status = resolveTunnelStatus();
    expect(status.enabled).toBe(true);
    expect(status.source).toBe('env');
    expect(status.public_url).toContain('https://abc.trycloudflare.com');
    expect(status.api_base_url).toContain('https://abc.trycloudflare.com');
    expect(status.mobile_connect_url).toBe(
      'sven://gateway/connect?url=https%3A%2F%2Fabc.trycloudflare.com%2F',
    );
    expect(status.auth_modes).toEqual(['password', 'bearer_token']);
    expect(status.qr_image_url).toBeNull();
  });

  it('extracts tunnel URL from cloudflared log file', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sven-tunnel-test-'));
    try {
      const logFile = join(tempDir, 'cloudflared.log');
      writeFileSync(
        logFile,
        'INF +--------------------------------------------+\nINF |  https://zeta-demo.trycloudflare.com        |\n',
        'utf8',
      );
      process.env.SVEN_TUNNEL_PROVIDER = 'cloudflare';
      process.env.SVEN_TUNNEL_PUBLIC_URL = '';
      process.env.SVEN_TUNNEL_URL_FILE = join(tempDir, 'tunnel-url.txt');
      process.env.SVEN_TUNNEL_LOG_FILE = logFile;

      const status = resolveTunnelStatus();
      expect(status.enabled).toBe(true);
      expect(status.source).toBe('log_file');
      expect(status.public_url).toContain('https://zeta-demo.trycloudflare.com');
      expect(status.api_base_url).toContain('https://zeta-demo.trycloudflare.com');
      expect(status.mobile_connect_url).toContain('sven://gateway/connect?url=');
      expect(status.auth_modes).toEqual(['password', 'bearer_token']);
      expect(status.qr_image_url).toBeNull();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
