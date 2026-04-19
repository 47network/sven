import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 533-537: Billing & Subscription', () => {
  const verticals = [
    {
      name: 'invoice_generator', migration: '20260621700000_agent_invoice_generator.sql',
      typeFile: 'agent-invoice-generator.ts', skillDir: 'invoice-generator',
      interfaces: ['InvoiceGeneratorConfig', 'InvoiceRecord', 'InvoiceTemplate'],
      bk: 'invoice_generator', eks: ['ivgn.invoice_created', 'ivgn.line_item_added', 'ivgn.total_calculated', 'ivgn.invoice_sent'],
      subjects: ['sven.ivgn.invoice_created', 'sven.ivgn.line_item_added', 'sven.ivgn.total_calculated', 'sven.ivgn.invoice_sent'],
      cases: ['ivgn_create', 'ivgn_add_item', 'ivgn_calculate', 'ivgn_send', 'ivgn_report', 'ivgn_monitor'],
    },
    {
      name: 'subscription_lifecycle', migration: '20260621710000_agent_subscription_lifecycle.sql',
      typeFile: 'agent-subscription-lifecycle.ts', skillDir: 'subscription-lifecycle',
      interfaces: ['SubscriptionLifecycleConfig', 'SubscriptionEvent', 'LifecycleState'],
      bk: 'subscription_lifecycle', eks: ['sblc.subscription_started', 'sblc.renewal_processed', 'sblc.upgrade_applied', 'sblc.cancellation_scheduled'],
      subjects: ['sven.sblc.subscription_started', 'sven.sblc.renewal_processed', 'sven.sblc.upgrade_applied', 'sven.sblc.cancellation_scheduled'],
      cases: ['sblc_start', 'sblc_renew', 'sblc_upgrade', 'sblc_cancel', 'sblc_report', 'sblc_monitor'],
    },
    {
      name: 'usage_metering', migration: '20260621720000_agent_usage_metering.sql',
      typeFile: 'agent-usage-metering.ts', skillDir: 'usage-metering',
      interfaces: ['UsageMeteringConfig', 'UsageRecord', 'MeterReading'],
      bk: 'usage_metering', eks: ['usmr.usage_recorded', 'usmr.threshold_reached', 'usmr.overage_detected', 'usmr.meter_reset'],
      subjects: ['sven.usmr.usage_recorded', 'sven.usmr.threshold_reached', 'sven.usmr.overage_detected', 'sven.usmr.meter_reset'],
      cases: ['usmr_record', 'usmr_threshold', 'usmr_overage', 'usmr_reset', 'usmr_report', 'usmr_monitor'],
    },
    {
      name: 'payment_reconciler', migration: '20260621730000_agent_payment_reconciler.sql',
      typeFile: 'agent-payment-reconciler.ts', skillDir: 'payment-reconciler',
      interfaces: ['PaymentReconcilerConfig', 'ReconciliationEntry', 'MatchResult'],
      bk: 'payment_reconciler', eks: ['pyrc.payment_matched', 'pyrc.discrepancy_found', 'pyrc.reconciliation_completed', 'pyrc.adjustment_posted'],
      subjects: ['sven.pyrc.payment_matched', 'sven.pyrc.discrepancy_found', 'sven.pyrc.reconciliation_completed', 'sven.pyrc.adjustment_posted'],
      cases: ['pyrc_match', 'pyrc_discrepancy', 'pyrc_complete', 'pyrc_adjust', 'pyrc_report', 'pyrc_monitor'],
    },
    {
      name: 'dunning_manager', migration: '20260621740000_agent_dunning_manager.sql',
      typeFile: 'agent-dunning-manager.ts', skillDir: 'dunning-manager',
      interfaces: ['DunningManagerConfig', 'DunningAttempt', 'DunningSchedule'],
      bk: 'dunning_manager', eks: ['dnmg.reminder_sent', 'dnmg.retry_scheduled', 'dnmg.escalation_triggered', 'dnmg.recovery_completed'],
      subjects: ['sven.dnmg.reminder_sent', 'sven.dnmg.retry_scheduled', 'sven.dnmg.escalation_triggered', 'sven.dnmg.recovery_completed'],
      cases: ['dnmg_remind', 'dnmg_retry', 'dnmg_escalate', 'dnmg_recover', 'dnmg_report', 'dnmg_monitor'],
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
      test('type file exports interfaces', () => {
        const content = fs.readFileSync(path.join(ROOT, 'packages/shared/src', v.typeFile), 'utf-8');
        v.interfaces.forEach((iface) => { expect(content).toContain(`export interface ${iface}`); });
      });
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`from './${v.typeFile.replace('.ts', '')}'`);
      });
      test('SKILL.md exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'))).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const content = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(content).toContain('## Actions');
      });
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => { expect(types).toContain(`'${ek}'`); });
      });
      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((subj) => { expect(eb).toContain(`'${subj}'`); });
      });
      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((cs) => { expect(te).toContain(`case '${cs}'`); });
      });
    });
  });
});
