import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Expense Tracker verticals', () => {
  const verticals = [
    {
      name: 'expense_tracker', migration: '20260634950000_agent_expense_tracker.sql',
      typeFile: 'agent-expense-tracker.ts', skillDir: 'expense-tracker',
      interfaces: ['ExpenseTrackerEntry', 'ExpenseTrackerConfig', 'ExpenseTrackerResult'],
      bk: 'expense_tracker', eks: ['et.entry_created', 'et.config_updated', 'et.export_emitted'],
      subjects: ['sven.et.entry_created', 'sven.et.config_updated', 'sven.et.export_emitted'],
      cases: ['et_recorder', 'et_categorizer', 'et_reporter'],
    },
    {
      name: 'expense_tracker_monitor', migration: '20260634960000_agent_expense_tracker_monitor.sql',
      typeFile: 'agent-expense-tracker-monitor.ts', skillDir: 'expense-tracker-monitor',
      interfaces: ['ExpenseTrackerMonitorCheck', 'ExpenseTrackerMonitorConfig', 'ExpenseTrackerMonitorResult'],
      bk: 'expense_tracker_monitor', eks: ['etm.check_passed', 'etm.alert_raised', 'etm.export_emitted'],
      subjects: ['sven.etm.check_passed', 'sven.etm.alert_raised', 'sven.etm.export_emitted'],
      cases: ['etm_watcher', 'etm_alerter', 'etm_reporter'],
    },
    {
      name: 'expense_tracker_auditor', migration: '20260634970000_agent_expense_tracker_auditor.sql',
      typeFile: 'agent-expense-tracker-auditor.ts', skillDir: 'expense-tracker-auditor',
      interfaces: ['ExpenseTrackerAuditEntry', 'ExpenseTrackerAuditConfig', 'ExpenseTrackerAuditResult'],
      bk: 'expense_tracker_auditor', eks: ['eta.entry_logged', 'eta.violation_found', 'eta.export_emitted'],
      subjects: ['sven.eta.entry_logged', 'sven.eta.violation_found', 'sven.eta.export_emitted'],
      cases: ['eta_scanner', 'eta_enforcer', 'eta_reporter'],
    },
    {
      name: 'expense_tracker_reporter', migration: '20260634980000_agent_expense_tracker_reporter.sql',
      typeFile: 'agent-expense-tracker-reporter.ts', skillDir: 'expense-tracker-reporter',
      interfaces: ['ExpenseTrackerReport', 'ExpenseTrackerReportConfig', 'ExpenseTrackerReportResult'],
      bk: 'expense_tracker_reporter', eks: ['etr.report_generated', 'etr.insight_found', 'etr.export_emitted'],
      subjects: ['sven.etr.report_generated', 'sven.etr.insight_found', 'sven.etr.export_emitted'],
      cases: ['etr_builder', 'etr_analyst', 'etr_reporter'],
    },
    {
      name: 'expense_tracker_optimizer', migration: '20260634990000_agent_expense_tracker_optimizer.sql',
      typeFile: 'agent-expense-tracker-optimizer.ts', skillDir: 'expense-tracker-optimizer',
      interfaces: ['ExpenseTrackerOptPlan', 'ExpenseTrackerOptConfig', 'ExpenseTrackerOptResult'],
      bk: 'expense_tracker_optimizer', eks: ['eto.plan_created', 'eto.optimization_applied', 'eto.export_emitted'],
      subjects: ['sven.eto.plan_created', 'sven.eto.optimization_applied', 'sven.eto.export_emitted'],
      cases: ['eto_planner', 'eto_executor', 'eto_reporter'],
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
