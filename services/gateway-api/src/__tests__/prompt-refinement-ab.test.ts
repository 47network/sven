import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const PERFORMANCE_ROUTE = path.resolve(__dirname, '../routes/admin/performance.ts');
const MIGRATION = path.resolve(__dirname, '../db/migrations/137_prompt_refinement_ab.sql');

describe('D6 Prompt Refinement A/B', () => {
  it('registers prompt refinement experiment endpoints', async () => {
    const source = await fs.readFile(PERFORMANCE_ROUTE, 'utf8');
    expect(source.includes('/performance/prompt-refinement/experiments')).toBe(true);
    expect(source.includes('/performance/prompt-refinement/assign')).toBe(true);
    expect(source.includes('/performance/prompt-refinement/feedback')).toBe(true);
    expect(source.includes('/performance/prompt-refinement/experiments/:id/summary')).toBe(true);
    expect(source.includes('ai_prompt_experiments')).toBe(true);
    expect(source.includes('ai_prompt_experiment_runs')).toBe(true);
  });

  it('migration defines prompt refinement settings and A/B tables', async () => {
    const migration = await fs.readFile(MIGRATION, 'utf8');
    expect(migration.includes('ai.promptRefinement.enabled')).toBe(true);
    expect(migration.includes('ai.promptRefinement.defaultMetric')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS ai_prompt_experiments')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS ai_prompt_experiment_runs')).toBe(true);
  });
});
