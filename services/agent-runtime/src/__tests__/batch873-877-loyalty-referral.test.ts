import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 873-877: Loyalty & Referral', () => {
  const verticals = [
    {
      name: 'loyalty_points_accruer', migration: '20260625100000_agent_loyalty_points_accruer.sql',
      typeFile: 'agent-loyalty-points-accruer.ts', skillDir: 'loyalty-points-accruer',
      interfaces: ['LoyaltyPointsAccruerConfig', 'PointsAccrual', 'AccruerEvent'],
      bk: 'loyalty_points_accruer', eks: ['lpac.event_received', 'lpac.rules_evaluated', 'lpac.points_credited', 'lpac.entry_persisted'],
      subjects: ['sven.lpac.event_received', 'sven.lpac.rules_evaluated', 'sven.lpac.points_credited', 'sven.lpac.entry_persisted'],
      cases: ['lpac_receive', 'lpac_evaluate', 'lpac_credit', 'lpac_persist', 'lpac_report', 'lpac_monitor'],
    },
    {
      name: 'loyalty_redemption_processor', migration: '20260625110000_agent_loyalty_redemption_processor.sql',
      typeFile: 'agent-loyalty-redemption-processor.ts', skillDir: 'loyalty-redemption-processor',
      interfaces: ['LoyaltyRedemptionProcessorConfig', 'RedemptionRequest', 'ProcessorEvent'],
      bk: 'loyalty_redemption_processor', eks: ['lrdp.request_received', 'lrdp.balance_checked', 'lrdp.points_debited', 'lrdp.reward_issued'],
      subjects: ['sven.lrdp.request_received', 'sven.lrdp.balance_checked', 'sven.lrdp.points_debited', 'sven.lrdp.reward_issued'],
      cases: ['lrdp_receive', 'lrdp_check', 'lrdp_debit', 'lrdp_issue', 'lrdp_report', 'lrdp_monitor'],
    },
    {
      name: 'referral_code_issuer', migration: '20260625120000_agent_referral_code_issuer.sql',
      typeFile: 'agent-referral-code-issuer.ts', skillDir: 'referral-code-issuer',
      interfaces: ['ReferralCodeIssuerConfig', 'ReferralCode', 'IssuerEvent'],
      bk: 'referral_code_issuer', eks: ['rcis.request_received', 'rcis.code_generated', 'rcis.entry_persisted', 'rcis.code_distributed'],
      subjects: ['sven.rcis.request_received', 'sven.rcis.code_generated', 'sven.rcis.entry_persisted', 'sven.rcis.code_distributed'],
      cases: ['rcis_receive', 'rcis_generate', 'rcis_persist', 'rcis_distribute', 'rcis_report', 'rcis_monitor'],
    },
    {
      name: 'referral_attribution_tracker', migration: '20260625130000_agent_referral_attribution_tracker.sql',
      typeFile: 'agent-referral-attribution-tracker.ts', skillDir: 'referral-attribution-tracker',
      interfaces: ['ReferralAttributionTrackerConfig', 'AttributionEvent', 'TrackerEvent'],
      bk: 'referral_attribution_tracker', eks: ['rfat.event_received', 'rfat.code_resolved', 'rfat.attribution_recorded', 'rfat.payout_queued'],
      subjects: ['sven.rfat.event_received', 'sven.rfat.code_resolved', 'sven.rfat.attribution_recorded', 'sven.rfat.payout_queued'],
      cases: ['rfat_receive', 'rfat_resolve', 'rfat_record', 'rfat_queue', 'rfat_report', 'rfat_monitor'],
    },
    {
      name: 'reward_payout_dispatcher', migration: '20260625140000_agent_reward_payout_dispatcher.sql',
      typeFile: 'agent-reward-payout-dispatcher.ts', skillDir: 'reward-payout-dispatcher',
      interfaces: ['RewardPayoutDispatcherConfig', 'PayoutRequest', 'DispatcherEvent'],
      bk: 'reward_payout_dispatcher', eks: ['rwpd.request_received', 'rwpd.eligibility_checked', 'rwpd.payout_executed', 'rwpd.outcome_recorded'],
      subjects: ['sven.rwpd.request_received', 'sven.rwpd.eligibility_checked', 'sven.rwpd.payout_executed', 'sven.rwpd.outcome_recorded'],
      cases: ['rwpd_receive', 'rwpd_check', 'rwpd_execute', 'rwpd_record', 'rwpd_report', 'rwpd_monitor'],
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
