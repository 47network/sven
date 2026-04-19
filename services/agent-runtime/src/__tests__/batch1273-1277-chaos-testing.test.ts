import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Chaos Testing management verticals', () => {
  const verticals = [
    {
      name: 'chaos_testing', migration: '20260629100000_agent_chaos_testing.sql',
      typeFile: 'agent-chaos-testing.ts', skillDir: 'chaos-testing',
      interfaces: ['ChaosTestingExperiment', 'ChaosTestingConfig', 'ChaosTestingResult'],
      bk: 'chaos_testing', eks: ['ct.experiment_created', 'ct.config_updated', 'ct.export_emitted'],
      subjects: ['sven.ct.experiment_created', 'sven.ct.config_updated', 'sven.ct.export_emitted'],
      cases: ['ct_planner', 'ct_executor', 'ct_reporter'],
    },
    {
      name: 'chaos_testing_monitor', migration: '20260629110000_agent_chaos_testing_monitor.sql',
      typeFile: 'agent-chaos-testing-monitor.ts', skillDir: 'chaos-testing-monitor',
      interfaces: ['ChaosTestingMonitorCheck', 'ChaosTestingMonitorConfig', 'ChaosTestingMonitorResult'],
      bk: 'chaos_testing_monitor', eks: ['ctm.check_passed', 'ctm.alert_raised', 'ctm.export_emitted'],
      subjects: ['sven.ctm.check_passed', 'sven.ctm.alert_raised', 'sven.ctm.export_emitted'],
      cases: ['ctm_watcher', 'ctm_alerter', 'ctm_reporter'],
    },
    {
      name: 'chaos_testing_auditor', migration: '20260629120000_agent_chaos_testing_auditor.sql',
      typeFile: 'agent-chaos-testing-auditor.ts', skillDir: 'chaos-testing-auditor',
      interfaces: ['ChaosTestingAuditEntry', 'ChaosTestingAuditConfig', 'ChaosTestingAuditResult'],
      bk: 'chaos_testing_auditor', eks: ['cta.entry_logged', 'cta.violation_found', 'cta.export_emitted'],
      subjects: ['sven.cta.entry_logged', 'sven.cta.violation_found', 'sven.cta.export_emitted'],
      cases: ['cta_scanner', 'cta_enforcer', 'cta_reporter'],
    },
    {
      name: 'chaos_testing_reporter', migration: '20260629130000_agent_chaos_testing_reporter.sql',
      typeFile: 'agent-chaos-testing-reporter.ts', skillDir: 'chaos-testing-reporter',
      interfaces: ['ChaosTestingReport', 'ChaosTestingReportConfig', 'ChaosTestingReportResult'],
      bk: 'chaos_testing_reporter', eks: ['ctr.report_generated', 'ctr.insight_found', 'ctr.export_emitted'],
      subjects: ['sven.ctr.report_generated', 'sven.ctr.insight_found', 'sven.ctr.export_emitted'],
      cases: ['ctr_builder', 'ctr_analyst', 'ctr_reporter'],
    },
    {
      name: 'chaos_testing_optimizer', migration: '20260629140000_agent_chaos_testing_optimizer.sql',
      typeFile: 'agent-chaos-testing-optimizer.ts', skillDir: 'chaos-testing-optimizer',
      interfaces: ['ChaosTestingOptPlan', 'ChaosTestingOptConfig', 'ChaosTestingOptResult'],
      bk: 'chaos_testing_optimizer', eks: ['cto.plan_created', 'cto.optimization_applied', 'cto.export_emitted'],
      subjects: ['sven.cto.plan_created', 'sven.cto.optimization_applied', 'sven.cto.export_emitted'],
      cases: ['cto_planner', 'cto_executor', 'cto_reporter'],
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
