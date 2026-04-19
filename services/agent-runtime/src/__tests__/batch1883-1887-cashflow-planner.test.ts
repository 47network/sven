import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Cashflow Planner verticals', () => {
  const verticals = [
    {
      name: 'cashflow_planner', migration: '20260635200000_agent_cashflow_planner.sql',
      typeFile: 'agent-cashflow-planner.ts', skillDir: 'cashflow-planner',
      interfaces: ['CashflowPlannerEntry', 'CashflowPlannerConfig', 'CashflowPlannerResult'],
      bk: 'cashflow_planner', eks: ['cfp.entry_created', 'cfp.config_updated', 'cfp.export_emitted'],
      subjects: ['sven.cfp.entry_created', 'sven.cfp.config_updated', 'sven.cfp.export_emitted'],
      cases: ['cfp_forecaster', 'cfp_planner', 'cfp_reporter'],
    },
    {
      name: 'cashflow_planner_monitor', migration: '20260635210000_agent_cashflow_planner_monitor.sql',
      typeFile: 'agent-cashflow-planner-monitor.ts', skillDir: 'cashflow-planner-monitor',
      interfaces: ['CashflowPlannerMonitorCheck', 'CashflowPlannerMonitorConfig', 'CashflowPlannerMonitorResult'],
      bk: 'cashflow_planner_monitor', eks: ['cfpm.check_passed', 'cfpm.alert_raised', 'cfpm.export_emitted'],
      subjects: ['sven.cfpm.check_passed', 'sven.cfpm.alert_raised', 'sven.cfpm.export_emitted'],
      cases: ['cfpm_watcher', 'cfpm_alerter', 'cfpm_reporter'],
    },
    {
      name: 'cashflow_planner_auditor', migration: '20260635220000_agent_cashflow_planner_auditor.sql',
      typeFile: 'agent-cashflow-planner-auditor.ts', skillDir: 'cashflow-planner-auditor',
      interfaces: ['CashflowPlannerAuditEntry', 'CashflowPlannerAuditConfig', 'CashflowPlannerAuditResult'],
      bk: 'cashflow_planner_auditor', eks: ['cfpa.entry_logged', 'cfpa.violation_found', 'cfpa.export_emitted'],
      subjects: ['sven.cfpa.entry_logged', 'sven.cfpa.violation_found', 'sven.cfpa.export_emitted'],
      cases: ['cfpa_scanner', 'cfpa_enforcer', 'cfpa_reporter'],
    },
    {
      name: 'cashflow_planner_reporter', migration: '20260635230000_agent_cashflow_planner_reporter.sql',
      typeFile: 'agent-cashflow-planner-reporter.ts', skillDir: 'cashflow-planner-reporter',
      interfaces: ['CashflowPlannerReport', 'CashflowPlannerReportConfig', 'CashflowPlannerReportResult'],
      bk: 'cashflow_planner_reporter', eks: ['cfpr.report_generated', 'cfpr.insight_found', 'cfpr.export_emitted'],
      subjects: ['sven.cfpr.report_generated', 'sven.cfpr.insight_found', 'sven.cfpr.export_emitted'],
      cases: ['cfpr_builder', 'cfpr_analyst', 'cfpr_reporter'],
    },
    {
      name: 'cashflow_planner_optimizer', migration: '20260635240000_agent_cashflow_planner_optimizer.sql',
      typeFile: 'agent-cashflow-planner-optimizer.ts', skillDir: 'cashflow-planner-optimizer',
      interfaces: ['CashflowPlannerOptPlan', 'CashflowPlannerOptConfig', 'CashflowPlannerOptResult'],
      bk: 'cashflow_planner_optimizer', eks: ['cfpo.plan_created', 'cfpo.optimization_applied', 'cfpo.export_emitted'],
      subjects: ['sven.cfpo.plan_created', 'sven.cfpo.optimization_applied', 'sven.cfpo.export_emitted'],
      cases: ['cfpo_planner', 'cfpo_executor', 'cfpo_reporter'],
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
