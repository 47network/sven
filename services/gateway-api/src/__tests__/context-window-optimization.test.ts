import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const PERFORMANCE_ROUTE = path.resolve(__dirname, '../routes/admin/performance.ts');
const MIGRATION = path.resolve(__dirname, '../db/migrations/135_context_window_optimization.sql');

describe('D6 Context Window Optimization', () => {
  it('registers context-window suggestion and apply endpoints', async () => {
    const source = await fs.readFile(PERFORMANCE_ROUTE, 'utf8');
    expect(source.includes('/performance/context-window/suggestions')).toBe(true);
    expect(source.includes('/performance/context-window/apply')).toBe(true);
    expect(source.includes('ai.contextWindowOptimization.enabled')).toBe(true);
    expect(source.includes('ai_context_window_recommendations')).toBe(true);
    expect(source.includes('user_context_window_preferences')).toBe(true);
  });

  it('migration defines optimization settings and storage tables', async () => {
    const migration = await fs.readFile(MIGRATION, 'utf8');
    expect(migration.includes('ai.contextWindowOptimization.enabled')).toBe(true);
    expect(migration.includes('ai.contextWindowOptimization.defaultThresholdPct')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS user_context_window_preferences')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS ai_context_window_recommendations')).toBe(true);
  });
});
