import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Billing Reconcile management verticals', () => {
  const verticals = [
    {
      name: 'billing_reconcile', migration: '20260629400000_agent_billing_reconcile.sql',
      typeFile: 'agent-billing-reconcile.ts', skillDir: 'billing-reconcile',
      interfaces: ['BillingReconcileEntry', 'BillingReconcileConfig', 'BillingReconcileResult'],
      bk: 'billing_reconcile', eks: ['br.entry_created', 'br.config_updated', 'br.export_emitted'],
      subjects: ['sven.br.entry_created', 'sven.br.config_updated', 'sven.br.export_emitted'],
      cases: ['br_planner', 'br_reconciler', 'br_reporter'],
    },
    {
      name: 'billing_reconcile_monitor', migration: '20260629410000_agent_billing_reconcile_monitor.sql',
      typeFile: 'agent-billing-reconcile-monitor.ts', skillDir: 'billing-reconcile-monitor',
      interfaces: ['BillingReconcileMonitorCheck', 'BillingReconcileMonitorConfig', 'BillingReconcileMonitorResult'],
      bk: 'billing_reconcile_monitor', eks: ['brm.check_passed', 'brm.alert_raised', 'brm.export_emitted'],
      subjects: ['sven.brm.check_passed', 'sven.brm.alert_raised', 'sven.brm.export_emitted'],
      cases: ['brm_watcher', 'brm_alerter', 'brm_reporter'],
    },
    {
      name: 'billing_reconcile_auditor', migration: '20260629420000_agent_billing_reconcile_auditor.sql',
      typeFile: 'agent-billing-reconcile-auditor.ts', skillDir: 'billing-reconcile-auditor',
      interfaces: ['BillingReconcileAuditEntry', 'BillingReconcileAuditConfig', 'BillingReconcileAuditResult'],
      bk: 'billing_reconcile_auditor', eks: ['bra.entry_logged', 'bra.violation_found', 'bra.export_emitted'],
      subjects: ['sven.bra.entry_logged', 'sven.bra.violation_found', 'sven.bra.export_emitted'],
      cases: ['bra_scanner', 'bra_enforcer', 'bra_reporter'],
    },
    {
      name: 'billing_reconcile_reporter', migration: '20260629430000_agent_billing_reconcile_reporter.sql',
      typeFile: 'agent-billing-reconcile-reporter.ts', skillDir: 'billing-reconcile-reporter',
      interfaces: ['BillingReconcileReport', 'BillingReconcileReportConfig', 'BillingReconcileReportResult'],
      bk: 'billing_reconcile_reporter', eks: ['brr.report_generated', 'brr.insight_found', 'brr.export_emitted'],
      subjects: ['sven.brr.report_generated', 'sven.brr.insight_found', 'sven.brr.export_emitted'],
      cases: ['brr_builder', 'brr_analyst', 'brr_reporter'],
    },
    {
      name: 'billing_reconcile_optimizer', migration: '20260629440000_agent_billing_reconcile_optimizer.sql',
      typeFile: 'agent-billing-reconcile-optimizer.ts', skillDir: 'billing-reconcile-optimizer',
      interfaces: ['BillingReconcileOptPlan', 'BillingReconcileOptConfig', 'BillingReconcileOptResult'],
      bk: 'billing_reconcile_optimizer', eks: ['bro.plan_created', 'bro.optimization_applied', 'bro.export_emitted'],
      subjects: ['sven.bro.plan_created', 'sven.bro.optimization_applied', 'sven.bro.export_emitted'],
      cases: ['bro_planner', 'bro_executor', 'bro_reporter'],
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
