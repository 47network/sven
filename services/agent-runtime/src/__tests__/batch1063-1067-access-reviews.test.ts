import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1063-1067: Access Reviews', () => {
  const verticals = [
    {
      name: 'access_review_initiator', migration: '20260627000000_agent_access_review_initiator.sql',
      typeFile: 'agent-access-review-initiator.ts', skillDir: 'access-review-initiator',
      interfaces: ['AccessReviewInitiatorConfig', 'InitRequest', 'InitiatorEvent'],
      bk: 'access_review_initiator', eks: ['arin.request_received', 'arin.scope_resolved', 'arin.review_initiated', 'arin.audit_recorded'],
      subjects: ['sven.arin.request_received', 'sven.arin.scope_resolved', 'sven.arin.review_initiated', 'sven.arin.audit_recorded'],
      cases: ['arin_receive', 'arin_resolve', 'arin_initiate', 'arin_audit', 'arin_report', 'arin_monitor'],
    },
    {
      name: 'access_review_collector', migration: '20260627010000_agent_access_review_collector.sql',
      typeFile: 'agent-access-review-collector.ts', skillDir: 'access-review-collector',
      interfaces: ['AccessReviewCollectorConfig', 'ResponseItem', 'CollectorEvent'],
      bk: 'access_review_collector', eks: ['arcl.item_received', 'arcl.fields_validated', 'arcl.response_persisted', 'arcl.audit_recorded'],
      subjects: ['sven.arcl.item_received', 'sven.arcl.fields_validated', 'sven.arcl.response_persisted', 'sven.arcl.audit_recorded'],
      cases: ['arcl_receive', 'arcl_validate', 'arcl_persist', 'arcl_audit', 'arcl_report', 'arcl_monitor'],
    },
    {
      name: 'access_review_decision_recorder', migration: '20260627020000_agent_access_review_decision_recorder.sql',
      typeFile: 'agent-access-review-decision-recorder.ts', skillDir: 'access-review-decision-recorder',
      interfaces: ['AccessReviewDecisionRecorderConfig', 'DecisionRecord', 'RecorderEvent'],
      bk: 'access_review_decision_recorder', eks: ['ardr.record_received', 'ardr.fields_validated', 'ardr.decision_persisted', 'ardr.audit_recorded'],
      subjects: ['sven.ardr.record_received', 'sven.ardr.fields_validated', 'sven.ardr.decision_persisted', 'sven.ardr.audit_recorded'],
      cases: ['ardr_receive', 'ardr_validate', 'ardr_persist', 'ardr_audit', 'ardr_report', 'ardr_monitor'],
    },
    {
      name: 'access_review_remediator', migration: '20260627030000_agent_access_review_remediator.sql',
      typeFile: 'agent-access-review-remediator.ts', skillDir: 'access-review-remediator',
      interfaces: ['AccessReviewRemediatorConfig', 'RemediationRequest', 'RemediatorEvent'],
      bk: 'access_review_remediator', eks: ['arrm.request_received', 'arrm.policy_evaluated', 'arrm.action_dispatched', 'arrm.audit_recorded'],
      subjects: ['sven.arrm.request_received', 'sven.arrm.policy_evaluated', 'sven.arrm.action_dispatched', 'sven.arrm.audit_recorded'],
      cases: ['arrm_receive', 'arrm_evaluate', 'arrm_dispatch', 'arrm_audit', 'arrm_report', 'arrm_monitor'],
    },
    {
      name: 'access_review_audit_logger', migration: '20260627040000_agent_access_review_audit_logger.sql',
      typeFile: 'agent-access-review-audit-logger.ts', skillDir: 'access-review-audit-logger',
      interfaces: ['AccessReviewAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'access_review_audit_logger', eks: ['arau.record_received', 'arau.fields_validated', 'arau.record_persisted', 'arau.export_emitted'],
      subjects: ['sven.arau.record_received', 'sven.arau.fields_validated', 'sven.arau.record_persisted', 'sven.arau.export_emitted'],
      cases: ['arau_receive', 'arau_validate', 'arau_persist', 'arau_emit', 'arau_report', 'arau_monitor'],
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
