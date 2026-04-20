import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 858-862: Commerce Checkout', () => {
  const verticals = [
    {
      name: 'commerce_cart_orchestrator', migration: '20260624950000_agent_commerce_cart_orchestrator.sql',
      typeFile: 'agent-commerce-cart-orchestrator.ts', skillDir: 'commerce-cart-orchestrator',
      interfaces: ['CommerceCartOrchestratorConfig', 'CartCommand', 'OrchestratorEvent'],
      bk: 'commerce_cart_orchestrator', eks: ['ccor.command_received', 'ccor.cart_loaded', 'ccor.mutation_applied', 'ccor.snapshot_persisted'],
      subjects: ['sven.ccor.command_received', 'sven.ccor.cart_loaded', 'sven.ccor.mutation_applied', 'sven.ccor.snapshot_persisted'],
      cases: ['ccor_receive', 'ccor_load', 'ccor_apply', 'ccor_persist', 'ccor_report', 'ccor_monitor'],
    },
    {
      name: 'commerce_checkout_finalizer', migration: '20260624960000_agent_commerce_checkout_finalizer.sql',
      typeFile: 'agent-commerce-checkout-finalizer.ts', skillDir: 'commerce-checkout-finalizer',
      interfaces: ['CommerceCheckoutFinalizerConfig', 'CheckoutSession', 'FinalizerEvent'],
      bk: 'commerce_checkout_finalizer', eks: ['ccfn.session_received', 'ccfn.totals_validated', 'ccfn.payment_authorized', 'ccfn.order_finalized'],
      subjects: ['sven.ccfn.session_received', 'sven.ccfn.totals_validated', 'sven.ccfn.payment_authorized', 'sven.ccfn.order_finalized'],
      cases: ['ccfn_receive', 'ccfn_validate', 'ccfn_authorize', 'ccfn_finalize', 'ccfn_report', 'ccfn_monitor'],
    },
    {
      name: 'commerce_inventory_reservation', migration: '20260624970000_agent_commerce_inventory_reservation.sql',
      typeFile: 'agent-commerce-inventory-reservation.ts', skillDir: 'commerce-inventory-reservation',
      interfaces: ['CommerceInventoryReservationConfig', 'InventoryReservation', 'ReservationEvent'],
      bk: 'commerce_inventory_reservation', eks: ['cinr.request_received', 'cinr.stock_checked', 'cinr.reservation_held', 'cinr.reservation_released'],
      subjects: ['sven.cinr.request_received', 'sven.cinr.stock_checked', 'sven.cinr.reservation_held', 'sven.cinr.reservation_released'],
      cases: ['cinr_receive', 'cinr_check', 'cinr_hold', 'cinr_release', 'cinr_report', 'cinr_monitor'],
    },
    {
      name: 'commerce_pricing_rule_engine', migration: '20260624980000_agent_commerce_pricing_rule_engine.sql',
      typeFile: 'agent-commerce-pricing-rule-engine.ts', skillDir: 'commerce-pricing-rule-engine',
      interfaces: ['CommercePricingRuleEngineConfig', 'PricingContext', 'EngineEvent'],
      bk: 'commerce_pricing_rule_engine', eks: ['cpre.context_received', 'cpre.rules_loaded', 'cpre.price_computed', 'cpre.breakdown_returned'],
      subjects: ['sven.cpre.context_received', 'sven.cpre.rules_loaded', 'sven.cpre.price_computed', 'sven.cpre.breakdown_returned'],
      cases: ['cpre_receive', 'cpre_load', 'cpre_compute', 'cpre_return', 'cpre_report', 'cpre_monitor'],
    },
    {
      name: 'commerce_promotion_applicator', migration: '20260624990000_agent_commerce_promotion_applicator.sql',
      typeFile: 'agent-commerce-promotion-applicator.ts', skillDir: 'commerce-promotion-applicator',
      interfaces: ['CommercePromotionApplicatorConfig', 'PromotionApplication', 'ApplicatorEvent'],
      bk: 'commerce_promotion_applicator', eks: ['cpra.code_received', 'cpra.eligibility_evaluated', 'cpra.discount_applied', 'cpra.usage_recorded'],
      subjects: ['sven.cpra.code_received', 'sven.cpra.eligibility_evaluated', 'sven.cpra.discount_applied', 'sven.cpra.usage_recorded'],
      cases: ['cpra_receive', 'cpra_evaluate', 'cpra_apply', 'cpra_record', 'cpra_report', 'cpra_monitor'],
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
