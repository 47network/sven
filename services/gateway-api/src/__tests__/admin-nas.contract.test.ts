import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const NAS_ROUTE = path.resolve(__dirname, '../routes/admin/nas.ts');

describe('admin/nas route contract', () => {
  let source: string;

  beforeAll(async () => {
    source = await fs.readFile(NAS_ROUTE, 'utf8');
  });

  it('registers file operation endpoints', () => {
    expect(source).toContain("'/nas/search'");
    expect(source).toContain("'/nas/list'");
    expect(source).toContain("'/nas/preview'");
    expect(source).toContain("'/nas/stats'");
    expect(source).toContain("'/nas/write'");
    expect(source).toContain("'/nas/delete'");
  });

  it('validates NAS paths using shared utility', () => {
    expect(source).toContain('validateNasPath');
    expect(source).toContain("@sven/shared");
  });

  it('enforces scope-based authorization for write and delete', () => {
    expect(source).toContain("'nas.write'");
    expect(source).toContain("'nas.delete'");
    expect(source).toContain("'nas.file_write'");
    expect(source).toContain("'nas.file_delete'");
  });

  it('uses shared file operation functions', () => {
    expect(source).toContain('searchFiles');
    expect(source).toContain('readFilePreview');
    expect(source).toContain('readFile');
    expect(source).toContain('listDirectoryPage');
    expect(source).toContain('writeFile');
    expect(source).toContain('deleteFile');
    expect(source).toContain('getFileStats');
  });
});
