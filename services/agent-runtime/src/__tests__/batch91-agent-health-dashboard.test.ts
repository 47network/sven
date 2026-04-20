import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 91 — Agent Health Dashboard', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617280000_agent_health_dashboard.sql'), 'utf-8');
    it('creates health_checks table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS health_checks'); });
    it('creates health_dashboards table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS health_dashboards'); });
    it('creates health_widgets table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS health_widgets'); });
    it('creates health_thresholds table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS health_thresholds'); });
    it('creates health_alert_rules table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS health_alert_rules'); });
    it('has 20 indexes', () => { expect((sql.match(/CREATE INDEX/g) || []).length).toBe(20); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-health-dashboard.ts'), 'utf-8');
    it('exports HealthTargetType', () => { expect(src).toContain("export type HealthTargetType"); });
    it('exports DashboardCheckType', () => { expect(src).toContain("export type DashboardCheckType"); });
    it('exports DashboardHealthStatus', () => { expect(src).toContain("export type DashboardHealthStatus"); });
    it('exports WidgetType', () => { expect(src).toContain("export type WidgetType"); });
    it('exports DashboardAlertSeverity', () => { expect(src).toContain("export type DashboardAlertSeverity"); });
    it('exports DashboardHealthCheck interface', () => { expect(src).toContain("export interface DashboardHealthCheck"); });
    it('exports HealthDashboard interface', () => { expect(src).toContain("export interface HealthDashboard"); });
    it('exports HealthWidget interface', () => { expect(src).toContain("export interface HealthWidget"); });
    it('exports DashboardisHealthy helper', () => { expect(src).toContain("export function DashboardisHealthy"); });
    it('exports checkOverdue helper', () => { expect(src).toContain("export function checkOverdue"); });
    it('exports alertCooldownActive helper', () => { expect(src).toContain("export function alertCooldownActive"); });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has health_tower building kind', () => { expect(types).toContain("'health_tower'"); });
    it('has 74 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(74);
    });
    it('has 312 event kind pipes', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(312);
    });
  });

  describe('Event bus', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has health subjects', () => {
      expect(bus).toContain("'sven.health.check_completed'");
      expect(bus).toContain("'sven.health.alert_triggered'");
    });
    it('has 311 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(311);
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['health_create_check','health_run_check','health_create_dashboard','health_add_widget','health_set_threshold','health_create_alert','health_report'];
    for (const c of cases) { it(`has case '${c}'`, () => { expect(te).toContain(`case '${c}'`); }); }
    it('has 418 switch cases total', () => { expect((te.match(/case '/g) || []).length).toBe(418); });
    it('has 414 handler methods total', () => { expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(414); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-health-dashboard/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-health-dashboard/); });
    it('has 7 actions', () => { expect((skill.match(/  - health_/g) || []).length).toBe(7); });
  });
});
