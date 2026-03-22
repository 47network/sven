import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfigFile, validateConfigFile } from '../config.js';

function writeJson(filePath: string, data: Record<string, unknown>) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

describe('config includes', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves includes and deep merges', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sven-config-'));
    const basePath = path.join(tempDir, 'base.json');
    const fragmentPath = path.join(tempDir, 'fragment.json');

    writeJson(fragmentPath, {
      gateway: { port: 3010 },
      auth: { cookie_secret: 'fragment-secret' },
    });

    writeJson(basePath, {
      $include: './fragment.json',
      gateway: { host: '0.0.0.0' },
      auth: { cookie_secret: 'base-secret' },
    });

    process.env.SVEN_CONFIG = basePath;
    const res = loadConfigFile();
    expect(res.status).toBe('loaded');
    expect(process.env.GATEWAY_PORT).toBe('3010');
    expect(process.env.GATEWAY_HOST).toBe('0.0.0.0');
    expect(process.env.COOKIE_SECRET).toBe('base-secret');
  });

  it('rejects circular includes', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sven-config-'));
    const aPath = path.join(tempDir, 'a.json');
    const bPath = path.join(tempDir, 'b.json');

    writeJson(aPath, { $include: './b.json', gateway: { port: 3000 } });
    writeJson(bPath, { $include: './a.json', gateway: { host: '0.0.0.0' } });

    const res = validateConfigFile(aPath);
    expect(res.ok).toBe(false);
    expect(String(res.error || '')).toContain('cycle');
  });

  it('enforces max include depth', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sven-config-'));
    const depth = 12;
    const files: string[] = [];
    for (let i = 0; i < depth; i += 1) {
      files.push(path.join(tempDir, `cfg-${i}.json`));
    }
    for (let i = 0; i < depth; i += 1) {
      const include = i < depth - 1 ? `./cfg-${i + 1}.json` : undefined;
      writeJson(files[i], include ? { $include: include } : { gateway: { port: 3000 } });
    }

    const res = validateConfigFile(files[0]);
    expect(res.ok).toBe(false);
    expect(String(res.error || '')).toContain('depth');
  });
});
