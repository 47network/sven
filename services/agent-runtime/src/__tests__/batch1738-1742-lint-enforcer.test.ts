import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Lint Enforcer verticals', () => {
  const verticals = [
    {
      name: 'lint_enforcer', migration: '20260633750000_agent_lint_enforcer.sql',
      typeFile: 'agent-lint-enforcer.ts', skillDir: 'lint-enforcer',
      interfaces: ['LintEnforcerEntry', 'LintEnforcerConfig', 'LintEnforcerResult'],
      bk: 'lint_enforcer', eks: ['le.entry_created', 'le.config_updated', 'le.export_emitted'],
      subjects: ['sven.le.entry_created', 'sven.le.config_updated', 'sven.le.export_emitted'],
      cases: ['le_parser', 'le_checker', 'le_reporter'],
    },
    {
      name: 'lint_enforcer_monitor', migration: '20260633760000_agent_lint_enforcer_monitor.sql',
      typeFile: 'agent-lint-enforcer-monitor.ts', skillDir: 'lint-enforcer-monitor',
      interfaces: ['LintEnforcerMonitorCheck', 'LintEnforcerMonitorConfig', 'LintEnforcerMonitorResult'],
      bk: 'lint_enforcer_monitor', eks: ['lem.check_passed', 'lem.alert_raised', 'lem.export_emitted'],
      subjects: ['sven.lem.check_passed', 'sven.lem.alert_raised', 'sven.lem.export_emitted'],
      cases: ['lem_watcher', 'lem_alerter', 'lem_reporter'],
    },
    {
      name: 'lint_enforcer_auditor', migration: '20260633770000_agent_lint_enforcer_auditor.sql',
      typeFile: 'agent-lint-enforcer-auditor.ts', skillDir: 'lint-enforcer-auditor',
      interfaces: ['LintEnforcerAuditEntry', 'LintEnforcerAuditConfig', 'LintEnforcerAuditResult'],
      bk: 'lint_enforcer_auditor', eks: ['lea.entry_logged', 'lea.violation_found', 'lea.export_emitted'],
      subjects: ['sven.lea.entry_logged', 'sven.lea.violation_found', 'sven.lea.export_emitted'],
      cases: ['lea_scanner', 'lea_enforcer', 'lea_reporter'],
    },
    {
      name: 'lint_enforcer_reporter', migration: '20260633780000_agent_lint_enforcer_reporter.sql',
      typeFile: 'agent-lint-enforcer-reporter.ts', skillDir: 'lint-enforcer-reporter',
      interfaces: ['LintEnforcerReport', 'LintEnforcerReportConfig', 'LintEnforcerReportResult'],
      bk: 'lint_enforcer_reporter', eks: ['ler.report_generated', 'ler.insight_found', 'ler.export_emitted'],
      subjects: ['sven.ler.report_generated', 'sven.ler.insight_found', 'sven.ler.export_emitted'],
      cases: ['ler_builder', 'ler_analyst', 'ler_reporter'],
    },
    {
      name: 'lint_enforcer_optimizer', migration: '20260633790000_agent_lint_enforcer_optimizer.sql',
      typeFile: 'agent-lint-enforcer-optimizer.ts', skillDir: 'lint-enforcer-optimizer',
      interfaces: ['LintEnforcerOptPlan', 'LintEnforcerOptConfig', 'LintEnforcerOptResult'],
      bk: 'lint_enforcer_optimizer', eks: ['leo.plan_created', 'leo.optimization_applied', 'leo.export_emitted'],
      subjects: ['sven.leo.plan_created', 'sven.leo.optimization_applied', 'sven.leo.export_emitted'],
      cases: ['leo_planner', 'leo_executor', 'leo_reporter'],
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
