import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 58 — Agent Monitoring & Observability', () => {
  /* ------------------------------------------------------------------ */
  /*  Migration SQL                                                      */
  /* ------------------------------------------------------------------ */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260531120000_agent_monitoring_observability.sql'),
      'utf-8',
    );

    it('creates agent_metrics table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_metrics');
    });

    it('creates agent_alerts table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_alerts');
    });

    it('creates agent_dashboards table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_dashboards');
    });

    it('creates agent_log_entries table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_log_entries');
    });

    it('creates agent_slo_targets table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_slo_targets');
    });

    it('has at least 17 indexes', () => {
      const idxCount = (sql.match(/CREATE INDEX/gi) || []).length;
      expect(idxCount).toBeGreaterThanOrEqual(17);
    });

    it('is the 44th migration', () => {
      const migrations = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations'))
        .filter(f => f.endsWith('.sql'));
      expect(migrations.length).toBe(44);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Shared types                                                       */
  /* ------------------------------------------------------------------ */
  describe('Shared types', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-monitoring-observability.ts'),
      'utf-8',
    );

    it('exports MetricType with 5 values', () => {
      const m = src.match(/export type MetricType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports AgentmAlertSeverity with 5 values', () => {
      const m = src.match(/export type AgentmAlertSeverity\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports AlertStatus with 5 values', () => {
      const m = src.match(/export type AlertStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports AgentmLogLevel with 5 values', () => {
      const m = src.match(/export type AgentmLogLevel\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports SloTargetType with 5 values', () => {
      const m = src.match(/export type SloTargetType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports SloStatus with 5 values', () => {
      const m = src.match(/export type SloStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports MonitoringAction with 7 values', () => {
      const m = src.match(/export type MonitoringAction\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const count = (m![0].match(/'/g) || []).length / 2;
      expect(count).toBe(7);
    });

    it('exports 5 interfaces', () => {
      const ifaces = (src.match(/export interface /g) || []).length;
      expect(ifaces).toBe(5);
    });

    it('exports 6 constants', () => {
      const consts = (src.match(/export const /g) || []).length;
      expect(consts).toBe(6);
    });

    it('exports isAlertActionable helper', () => {
      expect(src).toContain('export function isAlertActionable');
    });

    it('exports isSeverityCritical helper', () => {
      expect(src).toContain('export function isSeverityCritical');
    });

    it('exports isSloHealthy helper', () => {
      expect(src).toContain('export function isSloHealthy');
    });

    it('exports formatMetricLabel helper', () => {
      expect(src).toContain('export function formatMetricLabel');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Barrel export                                                      */
  /* ------------------------------------------------------------------ */
  describe('Barrel export (index.ts)', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');

    it('re-exports agent-monitoring-observability', () => {
      expect(idx).toContain('agent-monitoring-observability');
    });

    it('has at least 83 lines', () => {
      const lines = idx.split('\n').length;
      expect(lines).toBeGreaterThanOrEqual(83);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  SKILL.md                                                           */
  /* ------------------------------------------------------------------ */
  describe('SKILL.md', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/agent-monitoring/SKILL.md'),
      'utf-8',
    );

    it('has correct skill identifier', () => {
      expect(skill).toMatch(/skill:\s*agent-monitoring-observability/);
    });

    it('defines metric_record action', () => {
      expect(skill).toContain('metric_record');
    });

    it('defines alert_create action', () => {
      expect(skill).toContain('alert_create');
    });

    it('defines alert_acknowledge action', () => {
      expect(skill).toContain('alert_acknowledge');
    });

    it('defines dashboard_create action', () => {
      expect(skill).toContain('dashboard_create');
    });

    it('defines log_query action', () => {
      expect(skill).toContain('log_query');
    });

    it('defines slo_define action', () => {
      expect(skill).toContain('slo_define');
    });

    it('defines slo_check action', () => {
      expect(skill).toContain('slo_check');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Eidolon types                                                      */
  /* ------------------------------------------------------------------ */
  describe('Eidolon types', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('has observatory_tower building kind', () => {
      expect(types).toContain('observatory_tower');
    });

    it('has 41 building kinds', () => {
      const m = types.match(/export type EidolonBuildingKind\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const pipes = (m![0].match(/\|/g) || []).length;
      expect(pipes).toBe(41);
    });

    it('has 180 event kind values', () => {
      const m = types.match(/export type EidolonEventKind\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const pipes = (m![0].match(/\|/g) || []).length;
      expect(pipes).toBe(180);
    });

    it('has monitoring event kinds', () => {
      expect(types).toContain('monitoring.metric_recorded');
      expect(types).toContain('monitoring.alert_fired');
      expect(types).toContain('monitoring.slo_breached');
      expect(types).toContain('monitoring.dashboard_updated');
    });

    it('maps observatory_tower to civic district', () => {
      expect(types).toContain("case 'observatory_tower'");
      expect(types).toContain("return 'civic'");
    });

    it('has 41 districtFor cases', () => {
      const m = types.match(/function districtFor[\s\S]*?^}/m);
      expect(m).toBeTruthy();
      const cases = (m![0].match(/case '/g) || []).length;
      expect(cases).toBe(41);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Event bus                                                          */
  /* ------------------------------------------------------------------ */
  describe('Event bus (SUBJECT_MAP)', () => {
    const eb = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('has 179 SUBJECT_MAP entries', () => {
      const m = eb.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      const entries = (m![1].match(/^\s+'/gm) || []).length;
      expect(entries).toBe(179);
    });

    it('maps sven.monitoring.metric_recorded', () => {
      expect(eb).toContain("'sven.monitoring.metric_recorded': 'monitoring.metric_recorded'");
    });

    it('maps sven.monitoring.alert_fired', () => {
      expect(eb).toContain("'sven.monitoring.alert_fired': 'monitoring.alert_fired'");
    });

    it('maps sven.monitoring.slo_breached', () => {
      expect(eb).toContain("'sven.monitoring.slo_breached': 'monitoring.slo_breached'");
    });

    it('maps sven.monitoring.dashboard_updated', () => {
      expect(eb).toContain("'sven.monitoring.dashboard_updated': 'monitoring.dashboard_updated'");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Task executor                                                      */
  /* ------------------------------------------------------------------ */
  describe('Task executor', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has 187 switch cases', () => {
      const cases = (te.match(/case '/g) || []).length;
      expect(cases).toBe(187);
    });

    it('has 183 handler methods', () => {
      const handlers = (te.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(handlers).toBe(183);
    });

    it('has metric_record case', () => {
      expect(te).toContain("case 'metric_record'");
    });

    it('has alert_create case', () => {
      expect(te).toContain("case 'alert_create'");
    });

    it('has alert_acknowledge case', () => {
      expect(te).toContain("case 'alert_acknowledge'");
    });

    it('has dashboard_create case', () => {
      expect(te).toContain("case 'dashboard_create'");
    });

    it('has log_query case', () => {
      expect(te).toContain("case 'log_query'");
    });

    it('has slo_define case', () => {
      expect(te).toContain("case 'slo_define'");
    });

    it('has slo_check case', () => {
      expect(te).toContain("case 'slo_check'");
    });

    it('has handleMetricRecord handler', () => {
      expect(te).toMatch(/private handleMetricRecord/);
    });

    it('has handleAlertCreate handler', () => {
      expect(te).toMatch(/private handleAlertCreate/);
    });

    it('has handleAlertAcknowledge handler', () => {
      expect(te).toMatch(/private handleAlertAcknowledge/);
    });

    it('has handleDashboardCreate handler', () => {
      expect(te).toMatch(/private handleDashboardCreate/);
    });

    it('has handleLogQuery handler', () => {
      expect(te).toMatch(/private handleLogQuery/);
    });

    it('has handleSloDefine handler', () => {
      expect(te).toMatch(/private handleSloDefine/);
    });

    it('has handleSloCheck handler', () => {
      expect(te).toMatch(/private handleSloCheck/);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  .gitattributes privacy                                             */
  /* ------------------------------------------------------------------ */
  describe('.gitattributes privacy', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

    it('marks migration as export-ignore', () => {
      expect(ga).toContain('20260531120000_agent_monitoring_observability.sql export-ignore');
    });

    it('marks shared types as export-ignore', () => {
      expect(ga).toContain('agent-monitoring-observability.ts export-ignore');
    });

    it('marks skill as export-ignore', () => {
      expect(ga).toContain('agent-monitoring/** export-ignore');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  CHANGELOG                                                          */
  /* ------------------------------------------------------------------ */
  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');

    it('has Batch 58 entry', () => {
      expect(cl).toContain('Batch 58');
    });

    it('mentions Agent Monitoring & Observability', () => {
      expect(cl).toContain('Agent Monitoring & Observability');
    });
  });
});
