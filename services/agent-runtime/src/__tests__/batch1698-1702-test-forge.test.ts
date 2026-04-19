import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Test Forge verticals', () => {
  const verticals = [
    {
      name: 'test_forge', migration: '20260633350000_agent_test_forge.sql',
      typeFile: 'agent-test-forge.ts', skillDir: 'test-forge',
      interfaces: ['TestForgeEntry', 'TestForgeConfig', 'TestForgeResult'],
      bk: 'test_forge', eks: ['tf.entry_created', 'tf.config_updated', 'tf.export_emitted'],
      subjects: ['sven.tf.entry_created', 'sven.tf.config_updated', 'sven.tf.export_emitted'],
      cases: ['tf_generator', 'tf_executor', 'tf_reporter'],
    },
    {
      name: 'test_forge_monitor', migration: '20260633360000_agent_test_forge_monitor.sql',
      typeFile: 'agent-test-forge-monitor.ts', skillDir: 'test-forge-monitor',
      interfaces: ['TestForgeMonitorCheck', 'TestForgeMonitorConfig', 'TestForgeMonitorResult'],
      bk: 'test_forge_monitor', eks: ['tfm.check_passed', 'tfm.alert_raised', 'tfm.export_emitted'],
      subjects: ['sven.tfm.check_passed', 'sven.tfm.alert_raised', 'sven.tfm.export_emitted'],
      cases: ['tfm_watcher', 'tfm_alerter', 'tfm_reporter'],
    },
    {
      name: 'test_forge_auditor', migration: '20260633370000_agent_test_forge_auditor.sql',
      typeFile: 'agent-test-forge-auditor.ts', skillDir: 'test-forge-auditor',
      interfaces: ['TestForgeAuditEntry', 'TestForgeAuditConfig', 'TestForgeAuditResult'],
      bk: 'test_forge_auditor', eks: ['tfa.entry_logged', 'tfa.violation_found', 'tfa.export_emitted'],
      subjects: ['sven.tfa.entry_logged', 'sven.tfa.violation_found', 'sven.tfa.export_emitted'],
      cases: ['tfa_scanner', 'tfa_enforcer', 'tfa_reporter'],
    },
    {
      name: 'test_forge_reporter', migration: '20260633380000_agent_test_forge_reporter.sql',
      typeFile: 'agent-test-forge-reporter.ts', skillDir: 'test-forge-reporter',
      interfaces: ['TestForgeReport', 'TestForgeReportConfig', 'TestForgeReportResult'],
      bk: 'test_forge_reporter', eks: ['tfr.report_generated', 'tfr.insight_found', 'tfr.export_emitted'],
      subjects: ['sven.tfr.report_generated', 'sven.tfr.insight_found', 'sven.tfr.export_emitted'],
      cases: ['tfr_builder', 'tfr_analyst', 'tfr_reporter'],
    },
    {
      name: 'test_forge_optimizer', migration: '20260633390000_agent_test_forge_optimizer.sql',
      typeFile: 'agent-test-forge-optimizer.ts', skillDir: 'test-forge-optimizer',
      interfaces: ['TestForgeOptPlan', 'TestForgeOptConfig', 'TestForgeOptResult'],
      bk: 'test_forge_optimizer', eks: ['tfo.plan_created', 'tfo.optimization_applied', 'tfo.export_emitted'],
      subjects: ['sven.tfo.plan_created', 'sven.tfo.optimization_applied', 'sven.tfo.export_emitted'],
      cases: ['tfo_planner', 'tfo_executor', 'tfo_reporter'],
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
