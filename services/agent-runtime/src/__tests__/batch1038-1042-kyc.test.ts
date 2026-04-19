import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1038-1042: KYC', () => {
  const verticals = [
    {
      name: 'kyc_identity_verifier', migration: '20260626750000_agent_kyc_identity_verifier.sql',
      typeFile: 'agent-kyc-identity-verifier.ts', skillDir: 'kyc-identity-verifier',
      interfaces: ['KycIdentityVerifierConfig', 'IdentityClaim', 'VerifierEvent'],
      bk: 'kyc_identity_verifier', eks: ['kciv.claim_received', 'kciv.identity_verified', 'kciv.decision_emitted', 'kciv.audit_recorded'],
      subjects: ['sven.kciv.claim_received', 'sven.kciv.identity_verified', 'sven.kciv.decision_emitted', 'sven.kciv.audit_recorded'],
      cases: ['kciv_receive', 'kciv_verify', 'kciv_emit', 'kciv_audit', 'kciv_report', 'kciv_monitor'],
    },
    {
      name: 'kyc_document_validator', migration: '20260626760000_agent_kyc_document_validator.sql',
      typeFile: 'agent-kyc-document-validator.ts', skillDir: 'kyc-document-validator',
      interfaces: ['KycDocumentValidatorConfig', 'DocumentSubmission', 'ValidatorEvent'],
      bk: 'kyc_document_validator', eks: ['kcdv.submission_received', 'kcdv.document_validated', 'kcdv.decision_emitted', 'kcdv.audit_recorded'],
      subjects: ['sven.kcdv.submission_received', 'sven.kcdv.document_validated', 'sven.kcdv.decision_emitted', 'sven.kcdv.audit_recorded'],
      cases: ['kcdv_receive', 'kcdv_validate', 'kcdv_emit', 'kcdv_audit', 'kcdv_report', 'kcdv_monitor'],
    },
    {
      name: 'kyc_risk_classifier', migration: '20260626770000_agent_kyc_risk_classifier.sql',
      typeFile: 'agent-kyc-risk-classifier.ts', skillDir: 'kyc-risk-classifier',
      interfaces: ['KycRiskClassifierConfig', 'RiskRequest', 'ClassifierEvent'],
      bk: 'kyc_risk_classifier', eks: ['kcrc.request_received', 'kcrc.factors_loaded', 'kcrc.classification_emitted', 'kcrc.audit_recorded'],
      subjects: ['sven.kcrc.request_received', 'sven.kcrc.factors_loaded', 'sven.kcrc.classification_emitted', 'sven.kcrc.audit_recorded'],
      cases: ['kcrc_receive', 'kcrc_load', 'kcrc_emit', 'kcrc_audit', 'kcrc_report', 'kcrc_monitor'],
    },
    {
      name: 'kyc_decision_recorder', migration: '20260626780000_agent_kyc_decision_recorder.sql',
      typeFile: 'agent-kyc-decision-recorder.ts', skillDir: 'kyc-decision-recorder',
      interfaces: ['KycDecisionRecorderConfig', 'DecisionRecord', 'RecorderEvent'],
      bk: 'kyc_decision_recorder', eks: ['kcdr.record_received', 'kcdr.fields_validated', 'kcdr.decision_persisted', 'kcdr.audit_recorded'],
      subjects: ['sven.kcdr.record_received', 'sven.kcdr.fields_validated', 'sven.kcdr.decision_persisted', 'sven.kcdr.audit_recorded'],
      cases: ['kcdr_receive', 'kcdr_validate', 'kcdr_persist', 'kcdr_audit', 'kcdr_report', 'kcdr_monitor'],
    },
    {
      name: 'kyc_audit_logger', migration: '20260626790000_agent_kyc_audit_logger.sql',
      typeFile: 'agent-kyc-audit-logger.ts', skillDir: 'kyc-audit-logger',
      interfaces: ['KycAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'kyc_audit_logger', eks: ['kcau.record_received', 'kcau.fields_validated', 'kcau.record_persisted', 'kcau.export_emitted'],
      subjects: ['sven.kcau.record_received', 'sven.kcau.fields_validated', 'sven.kcau.record_persisted', 'sven.kcau.export_emitted'],
      cases: ['kcau_receive', 'kcau_validate', 'kcau_persist', 'kcau_emit', 'kcau_report', 'kcau_monitor'],
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
