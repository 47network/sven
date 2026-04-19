import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Rollback Planner verticals', () => {
  const verticals = [
    {
      name: 'rollback_planner', migration: '20260630400000_agent_rollback_planner.sql',
      typeFile: 'agent-rollback-planner.ts', skillDir: 'rollback-planner',
      interfaces: ['RollbackPlannerEntry', 'RollbackPlannerConfig', 'RollbackPlannerResult'],
      bk: 'rollback_planner', eks: ['rbp.entry_created', 'rbp.config_updated', 'rbp.export_emitted'],
      subjects: ['sven.rbp.entry_created', 'sven.rbp.config_updated', 'sven.rbp.export_emitted'],
      cases: ['rbp_planner', 'rbp_executor', 'rbp_reporter'],
    },
    {
      name: 'rollback_planner_monitor', migration: '20260630410000_agent_rollback_planner_monitor.sql',
      typeFile: 'agent-rollback-planner-monitor.ts', skillDir: 'rollback-planner-monitor',
      interfaces: ['RollbackPlannerMonitorCheck', 'RollbackPlannerMonitorConfig', 'RollbackPlannerMonitorResult'],
      bk: 'rollback_planner_monitor', eks: ['rbpm.check_passed', 'rbpm.alert_raised', 'rbpm.export_emitted'],
      subjects: ['sven.rbpm.check_passed', 'sven.rbpm.alert_raised', 'sven.rbpm.export_emitted'],
      cases: ['rbpm_watcher', 'rbpm_alerter', 'rbpm_reporter'],
    },
    {
      name: 'rollback_planner_auditor', migration: '20260630420000_agent_rollback_planner_auditor.sql',
      typeFile: 'agent-rollback-planner-auditor.ts', skillDir: 'rollback-planner-auditor',
      interfaces: ['RollbackPlannerAuditEntry', 'RollbackPlannerAuditConfig', 'RollbackPlannerAuditResult'],
      bk: 'rollback_planner_auditor', eks: ['rbpa.entry_logged', 'rbpa.violation_found', 'rbpa.export_emitted'],
      subjects: ['sven.rbpa.entry_logged', 'sven.rbpa.violation_found', 'sven.rbpa.export_emitted'],
      cases: ['rbpa_scanner', 'rbpa_enforcer', 'rbpa_reporter'],
    },
    {
      name: 'rollback_planner_reporter', migration: '20260630430000_agent_rollback_planner_reporter.sql',
      typeFile: 'agent-rollback-planner-reporter.ts', skillDir: 'rollback-planner-reporter',
      interfaces: ['RollbackPlannerReport', 'RollbackPlannerReportConfig', 'RollbackPlannerReportResult'],
      bk: 'rollback_planner_reporter', eks: ['rbpr.report_generated', 'rbpr.insight_found', 'rbpr.export_emitted'],
      subjects: ['sven.rbpr.report_generated', 'sven.rbpr.insight_found', 'sven.rbpr.export_emitted'],
      cases: ['rbpr_builder', 'rbpr_analyst', 'rbpr_reporter'],
    },
    {
      name: 'rollback_planner_optimizer', migration: '20260630440000_agent_rollback_planner_optimizer.sql',
      typeFile: 'agent-rollback-planner-optimizer.ts', skillDir: 'rollback-planner-optimizer',
      interfaces: ['RollbackPlannerOptPlan', 'RollbackPlannerOptConfig', 'RollbackPlannerOptResult'],
      bk: 'rollback_planner_optimizer', eks: ['rbpo.plan_created', 'rbpo.optimization_applied', 'rbpo.export_emitted'],
      subjects: ['sven.rbpo.plan_created', 'sven.rbpo.optimization_applied', 'sven.rbpo.export_emitted'],
      cases: ['rbpo_planner', 'rbpo_executor', 'rbpo_reporter'],
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
