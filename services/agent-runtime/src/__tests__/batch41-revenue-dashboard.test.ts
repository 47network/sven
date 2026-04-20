/**
 * Batch 41 — Cross-Platform Revenue Dashboard
 *
 * Validates: migration SQL, shared types, SKILL.md, Eidolon wiring,
 * NATS event-bus, task-executor handlers, shared index, .gitattributes.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), 'utf-8');

// ── Migration SQL ──────────────────────────────────────────────────────────

describe('Batch 41 — Migration SQL', () => {
  const sql = read('services/gateway-api/migrations/20260514120000_revenue_dashboard.sql');

  it('creates revenue_streams table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS revenue_streams');
  });

  it('creates revenue_snapshots table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS revenue_snapshots');
  });

  it('creates revenue_goals table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS revenue_goals');
  });

  it('creates revenue_alerts table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS revenue_alerts');
  });

  it('has 4 CREATE TABLE statements', () => {
    const matches = sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? [];
    expect(matches.length).toBe(4);
  });

  it('has 9 indexes', () => {
    const matches = sql.match(/CREATE INDEX/g) ?? [];
    expect(matches.length).toBe(9);
  });

  it('references stream_type field', () => {
    expect(sql).toContain('stream_type');
  });

  it('has foreign key on stream_id', () => {
    expect(sql).toContain('REFERENCES revenue_streams');
  });
});

// ── Shared Types ───────────────────────────────────────────────────────────

describe('Batch 41 — Shared Types', () => {
  const src = read('packages/shared/src/revenue-dashboard.ts');

  it('exports RevenueStreamType', () => {
    expect(src).toContain('export type RevenueStreamType');
  });

  it('exports StreamStatus', () => {
    expect(src).toContain('export type StreamStatus');
  });

  it('exports SnapshotPeriod', () => {
    expect(src).toContain('export type SnapshotPeriod');
  });

  it('exports GoalType', () => {
    expect(src).toContain('export type GoalType');
  });

  it('exports GoalStatus', () => {
    expect(src).toContain('export type GoalStatus');
  });

  it('exports AlertType', () => {
    expect(src).toContain('export type AlertType');
  });

  it('exports AlertSeverity', () => {
    expect(src).toContain('export type AlertSeverity');
  });

  it('exports RevenueStream interface', () => {
    expect(src).toContain('export interface RevenueStream');
  });

  it('exports RevenueSnapshot interface', () => {
    expect(src).toContain('export interface RevenueSnapshot');
  });

  it('exports RevenueGoal interface', () => {
    expect(src).toContain('export interface RevenueGoal');
  });

  it('exports RevenueAlert interface', () => {
    expect(src).toContain('export interface RevenueAlert');
  });

  it('exports REVENUE_STREAM_TYPES constant', () => {
    expect(src).toContain('export const REVENUE_STREAM_TYPES');
  });

  it('exports SNAPSHOT_PERIODS constant', () => {
    expect(src).toContain('export const SNAPSHOT_PERIODS');
  });

  it('exports GOAL_TYPES constant', () => {
    expect(src).toContain('export const GOAL_TYPES');
  });

  it('exports ALERT_TYPES constant', () => {
    expect(src).toContain('export const ALERT_TYPES');
  });

  it('exports GOAL_STATUS_ORDER constant', () => {
    expect(src).toContain('export const GOAL_STATUS_ORDER');
  });

  it('exports STREAM_STATUS_ORDER constant', () => {
    expect(src).toContain('export const STREAM_STATUS_ORDER');
  });

  it('has calculateProfitMargin helper', () => {
    expect(src).toContain('export function calculateProfitMargin');
  });

  it('has isGoalOnTrack helper', () => {
    expect(src).toContain('export function isGoalOnTrack');
  });

  it('has getAlertPriority helper', () => {
    expect(src).toContain('export function getAlertPriority');
  });

  it('has formatCurrency helper', () => {
    expect(src).toContain('export function formatCurrency');
  });

  it('includes all 12 stream types', () => {
    const types = [
      'marketplace', 'publishing', 'misiuni', 'merch', 'trading',
      'service_domain', 'research', 'integration', 'collaboration',
      'subscription', 'donation', 'advertising',
    ];
    for (const t of types) {
      expect(src).toContain(`'${t}'`);
    }
  });
});

// ── SKILL.md ───────────────────────────────────────────────────────────────

describe('Batch 41 — SKILL.md', () => {
  const skill = read('skills/autonomous-economy/revenue-dashboard/SKILL.md');

  it('exists and has a title', () => {
    expect(skill).toContain('Cross-Platform Revenue Dashboard');
  });

  it('lists all 7 actions', () => {
    const actions = [
      'dashboard_overview', 'stream_detail', 'snapshot_generate',
      'goal_set', 'goal_track', 'alert_configure', 'revenue_forecast',
    ];
    for (const a of actions) {
      expect(skill).toContain(a);
    }
  });

  it('mentions analytics_tower building', () => {
    expect(skill).toContain('analytics_tower');
  });

  it('mentions €20k repayment goal', () => {
    expect(skill).toContain('20,000');
  });

  it('lists all 12 revenue stream types', () => {
    const types = [
      'marketplace', 'publishing', 'misiuni', 'merch', 'trading',
      'service_domain', 'research', 'integration', 'collaboration',
      'subscription', 'donation', 'advertising',
    ];
    for (const t of types) {
      expect(skill).toContain(t);
    }
  });

  it('describes alert types', () => {
    expect(skill).toContain('revenue_drop');
    expect(skill).toContain('expense_spike');
    expect(skill).toContain('anomaly_detected');
  });
});

// ── Eidolon Types ──────────────────────────────────────────────────────────

describe('Batch 41 — Eidolon Types', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  it('adds analytics_tower to EidolonBuildingKind', () => {
    expect(types).toContain("'analytics_tower'");
  });

  it('has 25 building kinds', () => {
    const section = types.split('export type EidolonBuildingKind')[1]?.split(';')[0] ?? '';
    const matches = section.match(/\| '/g) ?? [];
    expect(matches.length).toBe(25);
  });

  it('adds revenue.snapshot event kind', () => {
    expect(types).toContain("'revenue.snapshot'");
  });

  it('adds revenue.alert event kind', () => {
    expect(types).toContain("'revenue.alert'");
  });

  it('adds goal.updated event kind', () => {
    expect(types).toContain("'goal.updated'");
  });

  it('adds dashboard.refreshed event kind', () => {
    expect(types).toContain("'dashboard.refreshed'");
  });

  it('has 112 event kind values (including heartbeat)', () => {
    const section = types.split('export type EidolonEventKind')[1]?.split(';')[0] ?? '';
    const matches = section.match(/\| '/g) ?? [];
    expect(matches.length).toBe(112);
  });

  it('maps analytics_tower to market district', () => {
    expect(types).toContain("case 'analytics_tower':");
    expect(types).toContain("return 'market'");
  });

  it('has 25 districtFor cases', () => {
    const matches = types.match(/case '/g) ?? [];
    expect(matches.length).toBe(25);
  });
});

// ── Event Bus ──────────────────────────────────────────────────────────────

describe('Batch 41 — Event Bus SUBJECT_MAP', () => {
  const bus = read('services/sven-eidolon/src/event-bus.ts');

  it('maps sven.revenue.snapshot', () => {
    expect(bus).toContain("'sven.revenue.snapshot': 'revenue.snapshot'");
  });

  it('maps sven.revenue.alert', () => {
    expect(bus).toContain("'sven.revenue.alert': 'revenue.alert'");
  });

  it('maps sven.goal.updated', () => {
    expect(bus).toContain("'sven.goal.updated': 'goal.updated'");
  });

  it('maps sven.dashboard.refreshed', () => {
    expect(bus).toContain("'sven.dashboard.refreshed': 'dashboard.refreshed'");
  });

  it('has 111 total SUBJECT_MAP entries', () => {
    const matches = bus.match(/^\s+'sven\./gm) ?? [];
    expect(matches.length).toBe(111);
  });
});

// ── Task Executor ──────────────────────────────────────────────────────────

describe('Batch 41 — Task Executor switch cases', () => {
  const exec = read('services/sven-marketplace/src/task-executor.ts');

  const cases = [
    'dashboard_overview', 'stream_detail', 'snapshot_generate',
    'goal_set', 'goal_track', 'alert_configure', 'revenue_forecast',
  ];

  for (const c of cases) {
    it(`has case '${c}'`, () => {
      expect(exec).toContain(`case '${c}':`);
    });
  }

  it('has 68 total switch cases', () => {
    const matches = exec.match(/case '/g) ?? [];
    expect(matches.length).toBe(68);
  });

  it('has 60 handler methods', () => {
    const matches = exec.match(/private async handle/g) ?? [];
    expect(matches.length).toBe(60);
  });
});

describe('Batch 41 — Task Executor handler methods', () => {
  const exec = read('services/sven-marketplace/src/task-executor.ts');

  it('has handleDashboardOverview', () => {
    expect(exec).toContain('handleDashboardOverview');
  });

  it('has handleStreamDetail', () => {
    expect(exec).toContain('handleStreamDetail');
  });

  it('has handleSnapshotGenerate', () => {
    expect(exec).toContain('handleSnapshotGenerate');
  });

  it('has handleGoalSet', () => {
    expect(exec).toContain('handleGoalSet');
  });

  it('has handleGoalTrack', () => {
    expect(exec).toContain('handleGoalTrack');
  });

  it('has handleAlertConfigure', () => {
    expect(exec).toContain('handleAlertConfigure');
  });

  it('has handleRevenueForecast', () => {
    expect(exec).toContain('handleRevenueForecast');
  });
});

// ── Shared Index ───────────────────────────────────────────────────────────

describe('Batch 41 — Shared index.ts', () => {
  const idx = read('packages/shared/src/index.ts');

  it('re-exports revenue-dashboard', () => {
    expect(idx).toContain("export * from './revenue-dashboard.js'");
  });

  it('has 67 lines (split)', () => {
    expect(idx.split('\n').length).toBe(67);
  });
});

// ── .gitattributes ─────────────────────────────────────────────────────────

describe('Batch 41 — .gitattributes', () => {
  const ga = read('.gitattributes');

  it('marks revenue_dashboard migration as export-ignore', () => {
    expect(ga).toContain('20260514120000_revenue_dashboard.sql export-ignore');
  });

  it('marks revenue-dashboard.ts as export-ignore', () => {
    expect(ga).toContain('revenue-dashboard.ts export-ignore');
  });

  it('marks revenue-dashboard skill dir as export-ignore', () => {
    expect(ga).toContain('revenue-dashboard/** export-ignore');
  });

  it('marks batch41 test as export-ignore', () => {
    expect(ga).toContain('batch41-revenue-dashboard.test.ts export-ignore');
  });
});

// ── Counts & Cross-checks ──────────────────────────────────────────────────

describe('Batch 41 — Global counts', () => {
  it('has 27 migration files', () => {
    const dir = path.join(ROOT, 'services/gateway-api/migrations');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));
    expect(files.length).toBe(27);
  });

  it('has 34 autonomous-economy skills', () => {
    const dir = path.join(ROOT, 'skills/autonomous-economy');
    const dirs = fs.readdirSync(dir).filter(d =>
      fs.statSync(path.join(dir, d)).isDirectory()
    );
    expect(dirs.length).toBe(34);
  });

  it('task-executor.ts exceeds 2100 lines', () => {
    const src = read('services/sven-marketplace/src/task-executor.ts');
    expect(src.split('\n').length).toBeGreaterThan(2100);
  });
});
