import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const PERFORMANCE_ROUTE = path.resolve(__dirname, '../routes/admin/performance.ts');
const MIGRATION = path.resolve(__dirname, '../db/migrations/134_ai_auto_tuning.sql');

describe('D6 Performance Auto-Tuning', () => {
  it('registers auto-tuning suggestion and apply endpoints', async () => {
    const source = await fs.readFile(PERFORMANCE_ROUTE, 'utf8');
    expect(source.includes('/performance/auto-tuning/suggestions')).toBe(true);
    expect(source.includes('/performance/auto-tuning/apply')).toBe(true);
    expect(source.includes('ai.autoTuning.enabled')).toBe(true);
    expect(source.includes('ai_auto_tuning_recommendations')).toBe(true);
    expect(source.includes('activate_profile')).toBe(true);
  });

  it('migration seeds auto-tuning settings and recommendation log table', async () => {
    const migration = await fs.readFile(MIGRATION, 'utf8');
    expect(migration.includes('ai.autoTuning.enabled')).toBe(true);
    expect(migration.includes('ai.autoTuning.latencyTargetMs')).toBe(true);
    expect(migration.includes('ai.autoTuning.errorRateTargetPct')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS ai_auto_tuning_recommendations')).toBe(true);
  });
});
