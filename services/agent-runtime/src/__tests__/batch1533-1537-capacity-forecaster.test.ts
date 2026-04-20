import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Capacity Forecaster verticals', () => {
  const verticals = [
    {
      name: 'capacity_forecaster', migration: '20260631700000_agent_capacity_forecaster.sql',
      typeFile: 'agent-capacity-forecaster.ts', skillDir: 'capacity-forecaster',
      interfaces: ['CapacityForecasterEntry', 'CapacityForecasterConfig', 'CapacityForecasterResult'],
      bk: 'capacity_forecaster', eks: ['cf.entry_created', 'cf.config_updated', 'cf.export_emitted'],
      subjects: ['sven.cf.entry_created', 'sven.cf.config_updated', 'sven.cf.export_emitted'],
      cases: ['cf_predictor', 'cf_modeler', 'cf_reporter'],
    },
    {
      name: 'capacity_forecaster_monitor', migration: '20260631710000_agent_capacity_forecaster_monitor.sql',
      typeFile: 'agent-capacity-forecaster-monitor.ts', skillDir: 'capacity-forecaster-monitor',
      interfaces: ['CapacityForecasterMonitorCheck', 'CapacityForecasterMonitorConfig', 'CapacityForecasterMonitorResult'],
      bk: 'capacity_forecaster_monitor', eks: ['cfm.check_passed', 'cfm.alert_raised', 'cfm.export_emitted'],
      subjects: ['sven.cfm.check_passed', 'sven.cfm.alert_raised', 'sven.cfm.export_emitted'],
      cases: ['cfm_watcher', 'cfm_alerter', 'cfm_reporter'],
    },
    {
      name: 'capacity_forecaster_auditor', migration: '20260631720000_agent_capacity_forecaster_auditor.sql',
      typeFile: 'agent-capacity-forecaster-auditor.ts', skillDir: 'capacity-forecaster-auditor',
      interfaces: ['CapacityForecasterAuditEntry', 'CapacityForecasterAuditConfig', 'CapacityForecasterAuditResult'],
      bk: 'capacity_forecaster_auditor', eks: ['cfa.entry_logged', 'cfa.violation_found', 'cfa.export_emitted'],
      subjects: ['sven.cfa.entry_logged', 'sven.cfa.violation_found', 'sven.cfa.export_emitted'],
      cases: ['cfa_scanner', 'cfa_enforcer', 'cfa_reporter'],
    },
    {
      name: 'capacity_forecaster_reporter', migration: '20260631730000_agent_capacity_forecaster_reporter.sql',
      typeFile: 'agent-capacity-forecaster-reporter.ts', skillDir: 'capacity-forecaster-reporter',
      interfaces: ['CapacityForecasterReport', 'CapacityForecasterReportConfig', 'CapacityForecasterReportResult'],
      bk: 'capacity_forecaster_reporter', eks: ['cfr.report_generated', 'cfr.insight_found', 'cfr.export_emitted'],
      subjects: ['sven.cfr.report_generated', 'sven.cfr.insight_found', 'sven.cfr.export_emitted'],
      cases: ['cfr_builder', 'cfr_analyst', 'cfr_reporter'],
    },
    {
      name: 'capacity_forecaster_optimizer', migration: '20260631740000_agent_capacity_forecaster_optimizer.sql',
      typeFile: 'agent-capacity-forecaster-optimizer.ts', skillDir: 'capacity-forecaster-optimizer',
      interfaces: ['CapacityForecasterOptPlan', 'CapacityForecasterOptConfig', 'CapacityForecasterOptResult'],
      bk: 'capacity_forecaster_optimizer', eks: ['cfo.plan_created', 'cfo.optimization_applied', 'cfo.export_emitted'],
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
