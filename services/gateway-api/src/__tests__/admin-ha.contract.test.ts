import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const HA_ROUTE = path.resolve(__dirname, '../routes/admin/ha.ts');

describe('admin/ha route contract', () => {
  let source: string;

  beforeAll(async () => {
    source = await fs.readFile(HA_ROUTE, 'utf8');
  });

  it('registers HA config GET and PUT endpoints', () => {
    expect(source).toContain("'/ha/config'");
    expect(source).toMatch(/app\.get\s*\(\s*'\/ha\/config'/);
    expect(source).toMatch(/app\.put\s*\(\s*'\/ha\/config'/);
  });

  it('registers discovery entities endpoint', () => {
    expect(source).toContain("'/ha/discovery/entities'");
  });

  it('validates secret refs with allowlisted schemes', () => {
    expect(source).toContain('SECRET_REF_ALLOWED_SCHEMES');
    expect(source).toContain('SECRET_REF_PATTERN');
    expect(source).toContain('isValidSecretRef');
  });

  it('uses resolveSecretRef from @sven/shared', () => {
    expect(source).toContain("resolveSecretRef");
    expect(source).toContain("@sven/shared");
  });

  it('parses setting values safely', () => {
    expect(source).toContain('parseSettingValue');
    expect(source).toContain('parseSettingText');
  });
});
