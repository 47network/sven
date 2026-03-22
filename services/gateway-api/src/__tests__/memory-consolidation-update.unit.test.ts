import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMemoryAdapter } from '../services/MemoryStore';

describe('B4 memory consolidation on update', () => {
  const originalAdapter = process.env.MEMORY_ADAPTER;
  const originalFilePath = process.env.MEMORY_FILE_PATH;
  const originalEnabled = process.env.MEMORY_CONSOLIDATION_ENABLED;
  const originalThreshold = process.env.MEMORY_CONSOLIDATION_THRESHOLD;
  const filePath = path.join(os.tmpdir(), `sven-memory-update-${Date.now()}.json`);

  beforeEach(async () => {
    process.env.MEMORY_ADAPTER = 'file';
    process.env.MEMORY_FILE_PATH = filePath;
    process.env.MEMORY_CONSOLIDATION_ENABLED = 'true';
    process.env.MEMORY_CONSOLIDATION_THRESHOLD = '0.9';
    await fs.rm(filePath, { force: true });
  });

  afterEach(async () => {
    process.env.MEMORY_ADAPTER = originalAdapter;
    process.env.MEMORY_FILE_PATH = originalFilePath;
    process.env.MEMORY_CONSOLIDATION_ENABLED = originalEnabled;
    process.env.MEMORY_CONSOLIDATION_THRESHOLD = originalThreshold;
    await fs.rm(filePath, { force: true });
  });

  it('merges near-duplicate when editing memory value/key', async () => {
    const adapter = createMemoryAdapter({} as any);

    const idA = await adapter.create({
      user_id: 'user-1',
      chat_id: null,
      visibility: 'user_private',
      key: 'project.status',
      value: 'backend ready',
      source: 'manual',
      importance: 1,
    });
    const idB = await adapter.create({
      user_id: 'user-1',
      chat_id: null,
      visibility: 'user_private',
      key: 'daily.habit',
      value: 'run 5km',
      source: 'manual',
      importance: 1,
    });

    const before = await adapter.list({ user_id: 'user-1', limit: 50, offset: 0 });
    expect(before.total).toBe(2);

    const updated = await adapter.update(idB, {
      key: 'project.status',
      value: 'backend ready',
    });
    expect(updated).toBeTruthy();
    expect(updated?.id).toBe(idB);
    expect(String(updated?.source || '')).toBe('consolidated');

    const after = await adapter.list({ user_id: 'user-1', limit: 50, offset: 0 });
    expect(after.total).toBe(1);
    expect(after.rows[0]?.id).toBe(idB);
    expect(after.rows[0]?.merged_into || null).toBeNull();
    expect(after.rows[0]?.value).toContain('backend ready');
    expect(after.rows.some((row) => row.id === idA)).toBe(false);
  });
});

