import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 653-657: Cost & Billing', () => {
  const verticals = [
    {
      name: 'cost_allocator', migration: '20260622900000_agent_cost_allocator.sql',
      typeFile: 'agent-cost-allocator.ts', skillDir: 'cost-allocator',
      interfaces: ['CostAllocatorConfig', 'AllocationResult', 'AllocatorEvent'],
      bk: 'cost_allocator', eks: ['coal.cost_allocated', 'coal.budget_exceeded', 'coal.report_generated', 'coal.tag_applied'],
      subjects: ['sven.coal.cost_allocated', 'sven.coal.budget_exceeded', 'sven.coal.report_generated', 'sven.coal.tag_applied'],
      cases: ['coal_allocate', 'coal_budget', 'coal_generate', 'coal_tag', 'coal_report', 'coal_monitor'],
    },
    {
      name: 'billing_reconciler', migration: '20260622910000_agent_billing_reconciler.sql',
      typeFile: 'agent-billing-reconciler.ts', skillDir: 'billing-reconciler',
      interfaces: ['BillingReconcilerConfig', 'ReconciliationResult', 'ReconcilerEvent'],
      bk: 'billing_reconciler', eks: ['blrc.reconciliation_started', 'blrc.discrepancy_found', 'blrc.reconciliation_completed', 'blrc.adjustment_posted'],
      subjects: ['sven.blrc.reconciliation_started', 'sven.blrc.discrepancy_found', 'sven.blrc.reconciliation_completed', 'sven.blrc.adjustment_posted'],
      cases: ['blrc_start', 'blrc_discrepancy', 'blrc_complete', 'blrc_adjust', 'blrc_report', 'blrc_monitor'],
    },
    {
      name: 'spend_tracker', migration: '20260622920000_agent_spend_tracker.sql',
      typeFile: 'agent-spend-tracker.ts', skillDir: 'spend-tracker',
      interfaces: ['SpendTrackerConfig', 'SpendRecord', 'TrackerEvent'],
      bk: 'spend_tracker', eks: ['sptr.spend_recorded', 'sptr.threshold_breached', 'sptr.forecast_updated', 'sptr.anomaly_flagged'],
      subjects: ['sven.sptr.spend_recorded', 'sven.sptr.threshold_breached', 'sven.sptr.forecast_updated', 'sven.sptr.anomaly_flagged'],
      cases: ['sptr_record', 'sptr_breach', 'sptr_forecast', 'sptr_anomaly', 'sptr_report', 'sptr_monitor'],
    },
    {
      name: 'margin_calculator', migration: '20260622930000_agent_margin_calculator.sql',
      typeFile: 'agent-margin-calculator.ts', skillDir: 'margin-calculator',
      interfaces: ['MarginCalculatorConfig', 'MarginResult', 'CalculatorEvent'],
      bk: 'margin_calculator', eks: ['mgcl.margin_calculated', 'mgcl.target_missed', 'mgcl.pricing_suggested', 'mgcl.trend_detected'],
      subjects: ['sven.mgcl.margin_calculated', 'sven.mgcl.target_missed', 'sven.mgcl.pricing_suggested', 'sven.mgcl.trend_detected'],
      cases: ['mgcl_calculate', 'mgcl_target', 'mgcl_suggest', 'mgcl_trend', 'mgcl_report', 'mgcl_monitor'],
    },
    {
      name: 'chargeback_auditor', migration: '20260622940000_agent_chargeback_auditor.sql',
      typeFile: 'agent-chargeback-auditor.ts', skillDir: 'chargeback-auditor',
      interfaces: ['ChargebackAuditorConfig', 'AuditResult', 'AuditorEvent'],
      bk: 'chargeback_auditor', eks: ['cbau.chargeback_filed', 'cbau.evidence_collected', 'cbau.dispute_resolved', 'cbau.pattern_detected'],
      subjects: ['sven.cbau.chargeback_filed', 'sven.cbau.evidence_collected', 'sven.cbau.dispute_resolved', 'sven.cbau.pattern_detected'],
      cases: ['cbau_file', 'cbau_collect', 'cbau_resolve', 'cbau_pattern', 'cbau_report', 'cbau_monitor'],
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
