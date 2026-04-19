import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 778-782: Fraud & Risk', () => {
  const verticals = [
    {
      name: 'fraud_detector', migration: '20260624150000_agent_fraud_detector.sql',
      typeFile: 'agent-fraud-detector.ts', skillDir: 'fraud-detector',
      interfaces: ['FraudDetectorConfig', 'FraudVerdict', 'DetectorEvent'],
      bk: 'fraud_detector', eks: ['frdt.transaction_scored', 'frdt.rule_triggered', 'frdt.case_opened', 'frdt.feedback_learned'],
      subjects: ['sven.frdt.transaction_scored', 'sven.frdt.rule_triggered', 'sven.frdt.case_opened', 'sven.frdt.feedback_learned'],
      cases: ['frdt_score', 'frdt_trigger', 'frdt_open', 'frdt_learn', 'frdt_report', 'frdt_monitor'],
    },
    {
      name: 'transaction_screener', migration: '20260624160000_agent_transaction_screener.sql',
      typeFile: 'agent-transaction-screener.ts', skillDir: 'transaction-screener',
      interfaces: ['TransactionScreenerConfig', 'ScreeningResult', 'ScreenerEvent'],
      bk: 'transaction_screener', eks: ['trsc.payload_normalized', 'trsc.sanctions_checked', 'trsc.aml_evaluated', 'trsc.decision_recorded'],
      subjects: ['sven.trsc.payload_normalized', 'sven.trsc.sanctions_checked', 'sven.trsc.aml_evaluated', 'sven.trsc.decision_recorded'],
      cases: ['trsc_normalize', 'trsc_check', 'trsc_evaluate', 'trsc_record', 'trsc_report', 'trsc_monitor'],
    },
    {
      name: 'risk_score_calculator', migration: '20260624170000_agent_risk_score_calculator.sql',
      typeFile: 'agent-risk-score-calculator.ts', skillDir: 'risk-score-calculator',
      interfaces: ['RiskScoreCalculatorConfig', 'RiskScore', 'CalculatorEvent'],
      bk: 'risk_score_calculator', eks: ['rsca.signals_collected', 'rsca.score_computed', 'rsca.tier_assigned', 'rsca.review_routed'],
      subjects: ['sven.rsca.signals_collected', 'sven.rsca.score_computed', 'sven.rsca.tier_assigned', 'sven.rsca.review_routed'],
      cases: ['rsca_collect', 'rsca_compute', 'rsca_assign', 'rsca_route', 'rsca_report', 'rsca_monitor'],
    },
    {
      name: 'chargeback_disputer', migration: '20260624180000_agent_chargeback_disputer.sql',
      typeFile: 'agent-chargeback-disputer.ts', skillDir: 'chargeback-disputer',
      interfaces: ['ChargebackDisputerConfig', 'ChargebackCase', 'DisputerEvent'],
      bk: 'chargeback_disputer', eks: ['cbdp.case_received', 'cbdp.evidence_assembled', 'cbdp.dispute_submitted', 'cbdp.outcome_recorded'],
      subjects: ['sven.cbdp.case_received', 'sven.cbdp.evidence_assembled', 'sven.cbdp.dispute_submitted', 'sven.cbdp.outcome_recorded'],
      cases: ['cbdp_receive', 'cbdp_assemble', 'cbdp_submit', 'cbdp_record', 'cbdp_report', 'cbdp_monitor'],
    },
    {
      name: 'kyc_verifier', migration: '20260624190000_agent_kyc_verifier.sql',
      typeFile: 'agent-kyc-verifier.ts', skillDir: 'kyc-verifier',
      interfaces: ['KycVerifierConfig', 'KycCase', 'VerifierEvent'],
      bk: 'kyc_verifier', eks: ['kycv.identity_received', 'kycv.document_validated', 'kycv.liveness_checked', 'kycv.verdict_issued'],
      subjects: ['sven.kycv.identity_received', 'sven.kycv.document_validated', 'sven.kycv.liveness_checked', 'sven.kycv.verdict_issued'],
      cases: ['kycv_receive', 'kycv_validate', 'kycv_check', 'kycv_issue', 'kycv_report', 'kycv_monitor'],
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
