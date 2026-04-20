import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 863-867: Subscriptions & Billing', () => {
  const verticals = [
    {
      name: 'subscription_billing_renewer', migration: '20260625000000_agent_subscription_billing_renewer.sql',
      typeFile: 'agent-subscription-billing-renewer.ts', skillDir: 'subscription-billing-renewer',
      interfaces: ['SubscriptionBillingRenewerConfig', 'RenewalCycle', 'RenewerEvent'],
      bk: 'subscription_billing_renewer', eks: ['sbrw.cycle_due', 'sbrw.charge_attempted', 'sbrw.cycle_advanced', 'sbrw.outcome_recorded'],
      subjects: ['sven.sbrw.cycle_due', 'sven.sbrw.charge_attempted', 'sven.sbrw.cycle_advanced', 'sven.sbrw.outcome_recorded'],
      cases: ['sbrw_due', 'sbrw_charge', 'sbrw_advance', 'sbrw_record', 'sbrw_report', 'sbrw_monitor'],
    },
    {
      name: 'subscription_proration_calculator', migration: '20260625010000_agent_subscription_proration_calculator.sql',
      typeFile: 'agent-subscription-proration-calculator.ts', skillDir: 'subscription-proration-calculator',
      interfaces: ['SubscriptionProrationCalculatorConfig', 'ProrationRequest', 'CalculatorEvent'],
      bk: 'subscription_proration_calculator', eks: ['sprc.request_received', 'sprc.usage_evaluated', 'sprc.amount_calculated', 'sprc.breakdown_returned'],
      subjects: ['sven.sprc.request_received', 'sven.sprc.usage_evaluated', 'sven.sprc.amount_calculated', 'sven.sprc.breakdown_returned'],
      cases: ['sprc_receive', 'sprc_evaluate', 'sprc_calculate', 'sprc_return', 'sprc_report', 'sprc_monitor'],
    },
    {
      name: 'subscription_dunning_manager', migration: '20260625020000_agent_subscription_dunning_manager.sql',
      typeFile: 'agent-subscription-dunning-manager.ts', skillDir: 'subscription-dunning-manager',
      interfaces: ['SubscriptionDunningManagerConfig', 'DunningCase', 'ManagerEvent'],
      bk: 'subscription_dunning_manager', eks: ['sdmg.failure_observed', 'sdmg.notice_dispatched', 'sdmg.retry_scheduled', 'sdmg.case_closed'],
      subjects: ['sven.sdmg.failure_observed', 'sven.sdmg.notice_dispatched', 'sven.sdmg.retry_scheduled', 'sven.sdmg.case_closed'],
      cases: ['sdmg_observe', 'sdmg_dispatch', 'sdmg_schedule', 'sdmg_close', 'sdmg_report', 'sdmg_monitor'],
    },
    {
      name: 'subscription_cancellation_handler', migration: '20260625030000_agent_subscription_cancellation_handler.sql',
      typeFile: 'agent-subscription-cancellation-handler.ts', skillDir: 'subscription-cancellation-handler',
      interfaces: ['SubscriptionCancellationHandlerConfig', 'CancellationRequest', 'HandlerEvent'],
      bk: 'subscription_cancellation_handler', eks: ['scnh.request_received', 'scnh.policy_evaluated', 'scnh.cancellation_applied', 'scnh.notification_sent'],
      subjects: ['sven.scnh.request_received', 'sven.scnh.policy_evaluated', 'sven.scnh.cancellation_applied', 'sven.scnh.notification_sent'],
      cases: ['scnh_receive', 'scnh_evaluate', 'scnh_apply', 'scnh_notify', 'scnh_report', 'scnh_monitor'],
    },
    {
      name: 'subscription_plan_migrator', migration: '20260625040000_agent_subscription_plan_migrator.sql',
      typeFile: 'agent-subscription-plan-migrator.ts', skillDir: 'subscription-plan-migrator',
      interfaces: ['SubscriptionPlanMigratorConfig', 'PlanMigration', 'MigratorEvent'],
      bk: 'subscription_plan_migrator', eks: ['spmg.request_received', 'spmg.compatibility_checked', 'spmg.transition_applied', 'spmg.outcome_recorded'],
      subjects: ['sven.spmg.request_received', 'sven.spmg.compatibility_checked', 'sven.spmg.transition_applied', 'sven.spmg.outcome_recorded'],
      cases: ['spmg_receive', 'spmg_check', 'spmg_apply', 'spmg_record', 'spmg_report', 'spmg_monitor'],
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
