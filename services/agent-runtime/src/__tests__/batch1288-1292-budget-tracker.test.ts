import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Budget Tracker management verticals', () => {
  const verticals = [
    {
      name: 'budget_tracker', migration: '20260629250000_agent_budget_tracker.sql',
      typeFile: 'agent-budget-tracker.ts', skillDir: 'budget-tracker',
      interfaces: ['BudgetTrackerEntry', 'BudgetTrackerConfig', 'BudgetTrackerResult'],
      bk: 'budget_tracker', eks: ['bt.entry_created', 'bt.config_updated', 'bt.export_emitted'],
      subjects: ['sven.bt.entry_created', 'sven.bt.config_updated', 'sven.bt.export_emitted'],
      cases: ['bt_planner', 'bt_tracker', 'bt_reporter'],
    },
    {
      name: 'budget_tracker_monitor', migration: '20260629260000_agent_budget_tracker_monitor.sql',
      typeFile: 'agent-budget-tracker-monitor.ts', skillDir: 'budget-tracker-monitor',
      interfaces: ['BudgetTrackerMonitorCheck', 'BudgetTrackerMonitorConfig', 'BudgetTrackerMonitorResult'],
      bk: 'budget_tracker_monitor', eks: ['btm.check_passed', 'btm.alert_raised', 'btm.export_emitted'],
      subjects: ['sven.btm.check_passed', 'sven.btm.alert_raised', 'sven.btm.export_emitted'],
      cases: ['btm_watcher', 'btm_alerter', 'btm_reporter'],
    },
    {
      name: 'budget_tracker_auditor', migration: '20260629270000_agent_budget_tracker_auditor.sql',
      typeFile: 'agent-budget-tracker-auditor.ts', skillDir: 'budget-tracker-auditor',
      interfaces: ['BudgetTrackerAuditEntry', 'BudgetTrackerAuditConfig', 'BudgetTrackerAuditResult'],
      bk: 'budget_tracker_auditor', eks: ['bta.entry_logged', 'bta.violation_found', 'bta.export_emitted'],
      subjects: ['sven.bta.entry_logged', 'sven.bta.violation_found', 'sven.bta.export_emitted'],
      cases: ['bta_scanner', 'bta_enforcer', 'bta_reporter'],
    },
    {
      name: 'budget_tracker_reporter', migration: '20260629280000_agent_budget_tracker_reporter.sql',
      typeFile: 'agent-budget-tracker-reporter.ts', skillDir: 'budget-tracker-reporter',
      interfaces: ['BudgetTrackerReport', 'BudgetTrackerReportConfig', 'BudgetTrackerReportResult'],
      bk: 'budget_tracker_reporter', eks: ['btr.report_generated', 'btr.insight_found', 'btr.export_emitted'],
      subjects: ['sven.btr.report_generated', 'sven.btr.insight_found', 'sven.btr.export_emitted'],
      cases: ['btr_builder', 'btr_analyst', 'btr_reporter'],
    },
    {
      name: 'budget_tracker_optimizer', migration: '20260629290000_agent_budget_tracker_optimizer.sql',
      typeFile: 'agent-budget-tracker-optimizer.ts', skillDir: 'budget-tracker-optimizer',
      interfaces: ['BudgetTrackerOptPlan', 'BudgetTrackerOptConfig', 'BudgetTrackerOptResult'],
      bk: 'budget_tracker_optimizer', eks: ['bto.plan_created', 'bto.optimization_applied', 'bto.export_emitted'],
      subjects: ['sven.bto.plan_created', 'sven.bto.optimization_applied', 'sven.bto.export_emitted'],
      cases: ['bto_planner', 'bto_executor', 'bto_reporter'],
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
