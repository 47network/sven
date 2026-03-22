import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const PERFORMANCE_ROUTE = path.resolve(__dirname, '../routes/admin/performance.ts');
const MIGRATION = path.resolve(__dirname, '../db/migrations/136_tool_selection_optimization.sql');

describe('D6 Tool Selection Optimization', () => {
  it('registers tool-selection suggestion and apply endpoints', async () => {
    const source = await fs.readFile(PERFORMANCE_ROUTE, 'utf8');
    expect(source.includes('/performance/tool-selection/suggestions')).toBe(true);
    expect(source.includes('/performance/tool-selection/apply')).toBe(true);
    expect(source.includes('ai.toolSelectionOptimization.enabled')).toBe(true);
    expect(source.includes('ai_tool_selection_preferences')).toBe(true);
    expect(source.includes('ai_tool_selection_recommendations')).toBe(true);
  });

  it('migration defines optimization settings and preference/recommendation tables', async () => {
    const migration = await fs.readFile(MIGRATION, 'utf8');
    expect(migration.includes('ai.toolSelectionOptimization.enabled')).toBe(true);
    expect(migration.includes('ai.toolSelectionOptimization.minSamples')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS ai_tool_selection_preferences')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS ai_tool_selection_recommendations')).toBe(true);
  });
});
