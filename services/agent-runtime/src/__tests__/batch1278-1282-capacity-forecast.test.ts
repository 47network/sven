import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Capacity Forecast management verticals', () => {
  const verticals = [
    {
      name: 'capacity_forecast', migration: '20260629150000_agent_capacity_forecast.sql',
      typeFile: 'agent-capacity-forecast.ts', skillDir: 'capacity-forecast',
      interfaces: ['CapacityForecastPlan', 'CapacityForecastConfig', 'CapacityForecastResult'],
      bk: 'capacity_forecast', eks: ['cf.plan_created', 'cf.config_updated', 'cf.export_emitted'],
      subjects: ['sven.cf.plan_created', 'sven.cf.config_updated', 'sven.cf.export_emitted'],
      cases: ['cf_planner', 'cf_modeler', 'cf_reporter'],
    },
    {
      name: 'capacity_forecast_monitor', migration: '20260629160000_agent_capacity_forecast_monitor.sql',
      typeFile: 'agent-capacity-forecast-monitor.ts', skillDir: 'capacity-forecast-monitor',
      interfaces: ['CapacityForecastMonitorCheck', 'CapacityForecastMonitorConfig', 'CapacityForecastMonitorResult'],
      bk: 'capacity_forecast_monitor', eks: ['cfm.check_passed', 'cfm.alert_raised', 'cfm.export_emitted'],
      subjects: ['sven.cfm.check_passed', 'sven.cfm.alert_raised', 'sven.cfm.export_emitted'],
      cases: ['cfm_watcher', 'cfm_alerter', 'cfm_reporter'],
    },
    {
      name: 'capacity_forecast_auditor', migration: '20260629170000_agent_capacity_forecast_auditor.sql',
      typeFile: 'agent-capacity-forecast-auditor.ts', skillDir: 'capacity-forecast-auditor',
      interfaces: ['CapacityForecastAuditEntry', 'CapacityForecastAuditConfig', 'CapacityForecastAuditResult'],
      bk: 'capacity_forecast_auditor', eks: ['cfa.entry_logged', 'cfa.violation_found', 'cfa.export_emitted'],
      subjects: ['sven.cfa.entry_logged', 'sven.cfa.violation_found', 'sven.cfa.export_emitted'],
      cases: ['cfa_scanner', 'cfa_enforcer', 'cfa_reporter'],
    },
    {
      name: 'capacity_forecast_reporter', migration: '20260629180000_agent_capacity_forecast_reporter.sql',
      typeFile: 'agent-capacity-forecast-reporter.ts', skillDir: 'capacity-forecast-reporter',
      interfaces: ['CapacityForecastReport', 'CapacityForecastReportConfig', 'CapacityForecastReportResult'],
      bk: 'capacity_forecast_reporter', eks: ['cfr.report_generated', 'cfr.insight_found', 'cfr.export_emitted'],
      subjects: ['sven.cfr.report_generated', 'sven.cfr.insight_found', 'sven.cfr.export_emitted'],
      cases: ['cfr_builder', 'cfr_analyst', 'cfr_reporter'],
    },
    {
      name: 'capacity_forecast_optimizer', migration: '20260629190000_agent_capacity_forecast_optimizer.sql',
      typeFile: 'agent-capacity-forecast-optimizer.ts', skillDir: 'capacity-forecast-optimizer',
      interfaces: ['CapacityForecastOptPlan', 'CapacityForecastOptConfig', 'CapacityForecastOptResult'],
      bk: 'capacity_forecast_optimizer', eks: ['cfo.plan_created', 'cfo.optimization_applied', 'cfo.export_emitted'],
      subjects: ['sven.cfo.plan_created', 'sven.cfo.optimization_applied', 'sven.cfo.export_emitted'],
      cases: ['cfo_planner', 'cfo_executor', 'cfo_reporter'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration))).toBe(true);
      });
      test('migration has correct table', () => {
        const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration), 'utf-8');
        expect(sql).toContain(`agent_${v.name}_configs`);
      });
      test('type file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', v.typeFile))).toBe(true);
      });
      test('shared barrel exports type', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`./${v.typeFile.replace('.ts', '')}`);
      });
      test('SKILL.md exists with Actions', () => {
        const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(skill).toContain('## Actions');
        expect(skill).toContain(v.skillDir);
      });
      test('Eidolon BK includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('Eidolon EKs all present', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => expect(types).toContain(`'${ek}'`));
      });
      test('event-bus SUBJECT_MAP entries present', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((s) => expect(eb).toContain(`'${s}'`));
      });
      test('task-executor switch cases present', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => expect(te).toContain(`case '${c}'`));
      });
      test('.gitattributes filters set', () => {
        const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
        expect(ga).toContain(v.migration);
        expect(ga).toContain(v.typeFile);
        expect(ga).toContain(v.skillDir);
      });
      test('districtFor includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
    });
  });
});
