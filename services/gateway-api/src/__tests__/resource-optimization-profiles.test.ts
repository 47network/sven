import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const PERFORMANCE_ROUTE = path.resolve(__dirname, '../routes/admin/performance.ts');
const MIGRATION = path.resolve(__dirname, '../db/migrations/138_resource_optimization_profiles.sql');

describe('D6 Resource Optimization Profiles', () => {
  it('registers resource-optimization rule and evaluation endpoints', async () => {
    const source = await fs.readFile(PERFORMANCE_ROUTE, 'utf8');
    expect(source.includes('/performance/resource-optimization/rules')).toBe(true);
    expect(source.includes('/performance/resource-optimization/evaluate')).toBe(true);
    expect(source.includes('ai.resourceOptimization.enabled')).toBe(true);
    expect(source.includes('ai_resource_profile_rules')).toBe(true);
    expect(source.includes('ai_resource_profile_switch_events')).toBe(true);
  });

  it('migration defines settings and profile rule/switch tables', async () => {
    const migration = await fs.readFile(MIGRATION, 'utf8');
    expect(migration.includes('ai.resourceOptimization.enabled')).toBe(true);
    expect(migration.includes('ai.resourceOptimization.defaultTimezone')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS ai_resource_profile_rules')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS ai_resource_profile_switch_events')).toBe(true);
  });
});
