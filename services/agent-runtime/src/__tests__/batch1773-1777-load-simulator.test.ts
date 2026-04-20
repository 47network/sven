import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Load Simulator verticals', () => {
  const verticals = [
    {
      name: 'load_simulator', migration: '20260634100000_agent_load_simulator.sql',
      typeFile: 'agent-load-simulator.ts', skillDir: 'load-simulator',
      interfaces: ['LoadSimulatorEntry', 'LoadSimulatorConfig', 'LoadSimulatorResult'],
      bk: 'load_simulator', eks: ['ls.entry_created', 'ls.config_updated', 'ls.export_emitted'],
      subjects: ['sven.ls.entry_created', 'sven.ls.config_updated', 'sven.ls.export_emitted'],
      cases: ['ls_generator', 'ls_controller', 'ls_reporter'],
    },
    {
      name: 'load_simulator_monitor', migration: '20260634110000_agent_load_simulator_monitor.sql',
      typeFile: 'agent-load-simulator-monitor.ts', skillDir: 'load-simulator-monitor',
      interfaces: ['LoadSimulatorMonitorCheck', 'LoadSimulatorMonitorConfig', 'LoadSimulatorMonitorResult'],
      bk: 'load_simulator_monitor', eks: ['lsm.check_passed', 'lsm.alert_raised', 'lsm.export_emitted'],
      subjects: ['sven.lsm.check_passed', 'sven.lsm.alert_raised', 'sven.lsm.export_emitted'],
      cases: ['lsm_watcher', 'lsm_alerter', 'lsm_reporter'],
    },
    {
      name: 'load_simulator_auditor', migration: '20260634120000_agent_load_simulator_auditor.sql',
      typeFile: 'agent-load-simulator-auditor.ts', skillDir: 'load-simulator-auditor',
      interfaces: ['LoadSimulatorAuditEntry', 'LoadSimulatorAuditConfig', 'LoadSimulatorAuditResult'],
      bk: 'load_simulator_auditor', eks: ['lsa.entry_logged', 'lsa.violation_found', 'lsa.export_emitted'],
      subjects: ['sven.lsa.entry_logged', 'sven.lsa.violation_found', 'sven.lsa.export_emitted'],
      cases: ['lsa_scanner', 'lsa_enforcer', 'lsa_reporter'],
    },
    {
      name: 'load_simulator_reporter', migration: '20260634130000_agent_load_simulator_reporter.sql',
      typeFile: 'agent-load-simulator-reporter.ts', skillDir: 'load-simulator-reporter',
      interfaces: ['LoadSimulatorReport', 'LoadSimulatorReportConfig', 'LoadSimulatorReportResult'],
      bk: 'load_simulator_reporter', eks: ['lsr.report_generated', 'lsr.insight_found', 'lsr.export_emitted'],
      subjects: ['sven.lsr.report_generated', 'sven.lsr.insight_found', 'sven.lsr.export_emitted'],
      cases: ['lsr_builder', 'lsr_analyst', 'lsr_reporter'],
    },
    {
      name: 'load_simulator_optimizer', migration: '20260634140000_agent_load_simulator_optimizer.sql',
      typeFile: 'agent-load-simulator-optimizer.ts', skillDir: 'load-simulator-optimizer',
      interfaces: ['LoadSimulatorOptPlan', 'LoadSimulatorOptConfig', 'LoadSimulatorOptResult'],
      bk: 'load_simulator_optimizer', eks: ['lso.plan_created', 'lso.optimization_applied', 'lso.export_emitted'],
      subjects: ['sven.lso.plan_created', 'sven.lso.optimization_applied', 'sven.lso.export_emitted'],
      cases: ['lso_planner', 'lso_executor', 'lso_reporter'],
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
