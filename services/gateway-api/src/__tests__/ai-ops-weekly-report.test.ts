import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const PERFORMANCE_ROUTE = path.resolve(__dirname, '../routes/admin/performance.ts');
const MIGRATION = path.resolve(__dirname, '../db/migrations/139_ai_ops_weekly_report.sql');

describe('D6 AI Ops Weekly Report', () => {
  it('registers weekly report generate and list endpoints', async () => {
    const source = await fs.readFile(PERFORMANCE_ROUTE, 'utf8');
    expect(source.includes('/performance/ai-ops/weekly-report/generate')).toBe(true);
    expect(source.includes('/performance/ai-ops/weekly-report')).toBe(true);
    expect(source.includes('ai_ops_weekly_reports')).toBe(true);
    expect(source.includes('ai.opsWeeklyReport.enabled')).toBe(true);
  });

  it('migration defines weekly report settings and table', async () => {
    const migration = await fs.readFile(MIGRATION, 'utf8');
    expect(migration.includes('ai.opsWeeklyReport.enabled')).toBe(true);
    expect(migration.includes('ai.opsWeeklyReport.defaultWindowDays')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS ai_ops_weekly_reports')).toBe(true);
  });
});
