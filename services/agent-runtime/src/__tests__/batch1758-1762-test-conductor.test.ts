import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Test Conductor verticals', () => {
  const verticals = [
    {
      name: 'test_conductor', migration: '20260633950000_agent_test_conductor.sql',
      typeFile: 'agent-test-conductor.ts', skillDir: 'test-conductor',
      interfaces: ['TestConductorEntry', 'TestConductorConfig', 'TestConductorResult'],
      bk: 'test_conductor', eks: ['tc2.entry_created', 'tc2.config_updated', 'tc2.export_emitted'],
      subjects: ['sven.tc2.entry_created', 'sven.tc2.config_updated', 'sven.tc2.export_emitted'],
      cases: ['tc2_scheduler', 'tc2_runner', 'tc2_reporter'],
    },
    {
      name: 'test_conductor_monitor', migration: '20260633960000_agent_test_conductor_monitor.sql',
      typeFile: 'agent-test-conductor-monitor.ts', skillDir: 'test-conductor-monitor',
      interfaces: ['TestConductorMonitorCheck', 'TestConductorMonitorConfig', 'TestConductorMonitorResult'],
      bk: 'test_conductor_monitor', eks: ['tcm2.check_passed', 'tcm2.alert_raised', 'tcm2.export_emitted'],
      subjects: ['sven.tcm2.check_passed', 'sven.tcm2.alert_raised', 'sven.tcm2.export_emitted'],
      cases: ['tcm2_watcher', 'tcm2_alerter', 'tcm2_reporter'],
    },
    {
      name: 'test_conductor_auditor', migration: '20260633970000_agent_test_conductor_auditor.sql',
      typeFile: 'agent-test-conductor-auditor.ts', skillDir: 'test-conductor-auditor',
      interfaces: ['TestConductorAuditEntry', 'TestConductorAuditConfig', 'TestConductorAuditResult'],
      bk: 'test_conductor_auditor', eks: ['tca2.entry_logged', 'tca2.violation_found', 'tca2.export_emitted'],
      subjects: ['sven.tca2.entry_logged', 'sven.tca2.violation_found', 'sven.tca2.export_emitted'],
      cases: ['tca2_scanner', 'tca2_enforcer', 'tca2_reporter'],
    },
    {
      name: 'test_conductor_reporter', migration: '20260633980000_agent_test_conductor_reporter.sql',
      typeFile: 'agent-test-conductor-reporter.ts', skillDir: 'test-conductor-reporter',
      interfaces: ['TestConductorReport', 'TestConductorReportConfig', 'TestConductorReportResult'],
      bk: 'test_conductor_reporter', eks: ['tcr2.report_generated', 'tcr2.insight_found', 'tcr2.export_emitted'],
      subjects: ['sven.tcr2.report_generated', 'sven.tcr2.insight_found', 'sven.tcr2.export_emitted'],
      cases: ['tcr2_builder', 'tcr2_analyst', 'tcr2_reporter'],
    },
    {
      name: 'test_conductor_optimizer', migration: '20260633990000_agent_test_conductor_optimizer.sql',
      typeFile: 'agent-test-conductor-optimizer.ts', skillDir: 'test-conductor-optimizer',
      interfaces: ['TestConductorOptPlan', 'TestConductorOptConfig', 'TestConductorOptResult'],
      bk: 'test_conductor_optimizer', eks: ['tco2.plan_created', 'tco2.optimization_applied', 'tco2.export_emitted'],
      subjects: ['sven.tco2.plan_created', 'sven.tco2.optimization_applied', 'sven.tco2.export_emitted'],
      cases: ['tco2_planner', 'tco2_executor', 'tco2_reporter'],
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
