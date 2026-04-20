import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1068-1072: Privileged Access Management', () => {
  const verticals = [
    {
      name: 'pam_session_initiator', migration: '20260627050000_agent_pam_session_initiator.sql',
      typeFile: 'agent-pam-session-initiator.ts', skillDir: 'pam-session-initiator',
      interfaces: ['PamSessionInitiatorConfig', 'InitRequest', 'InitiatorEvent'],
      bk: 'pam_session_initiator', eks: ['pmsi.request_received', 'pmsi.policy_evaluated', 'pmsi.session_started', 'pmsi.audit_recorded'],
      subjects: ['sven.pmsi.request_received', 'sven.pmsi.policy_evaluated', 'sven.pmsi.session_started', 'sven.pmsi.audit_recorded'],
      cases: ['pmsi_receive', 'pmsi_evaluate', 'pmsi_start', 'pmsi_audit', 'pmsi_report', 'pmsi_monitor'],
    },
    {
      name: 'pam_session_recorder', migration: '20260627060000_agent_pam_session_recorder.sql',
      typeFile: 'agent-pam-session-recorder.ts', skillDir: 'pam-session-recorder',
      interfaces: ['PamSessionRecorderConfig', 'SessionEvent', 'RecorderEvent'],
      bk: 'pam_session_recorder', eks: ['pmsr.event_received', 'pmsr.fields_validated', 'pmsr.event_persisted', 'pmsr.audit_recorded'],
      subjects: ['sven.pmsr.event_received', 'sven.pmsr.fields_validated', 'sven.pmsr.event_persisted', 'sven.pmsr.audit_recorded'],
      cases: ['pmsr_receive', 'pmsr_validate', 'pmsr_persist', 'pmsr_audit', 'pmsr_report', 'pmsr_monitor'],
    },
    {
      name: 'pam_credential_broker', migration: '20260627070000_agent_pam_credential_broker.sql',
      typeFile: 'agent-pam-credential-broker.ts', skillDir: 'pam-credential-broker',
      interfaces: ['PamCredentialBrokerConfig', 'BrokerRequest', 'BrokerEvent'],
      bk: 'pam_credential_broker', eks: ['pmcb.request_received', 'pmcb.policy_evaluated', 'pmcb.credential_brokered', 'pmcb.audit_recorded'],
      subjects: ['sven.pmcb.request_received', 'sven.pmcb.policy_evaluated', 'sven.pmcb.credential_brokered', 'sven.pmcb.audit_recorded'],
      cases: ['pmcb_receive', 'pmcb_evaluate', 'pmcb_broker', 'pmcb_audit', 'pmcb_report', 'pmcb_monitor'],
    },
    {
      name: 'pam_session_terminator', migration: '20260627080000_agent_pam_session_terminator.sql',
      typeFile: 'agent-pam-session-terminator.ts', skillDir: 'pam-session-terminator',
      interfaces: ['PamSessionTerminatorConfig', 'TerminateRequest', 'TerminatorEvent'],
      bk: 'pam_session_terminator', eks: ['pmst.request_received', 'pmst.policy_evaluated', 'pmst.session_terminated', 'pmst.audit_recorded'],
      subjects: ['sven.pmst.request_received', 'sven.pmst.policy_evaluated', 'sven.pmst.session_terminated', 'sven.pmst.audit_recorded'],
      cases: ['pmst_receive', 'pmst_evaluate', 'pmst_terminate', 'pmst_audit', 'pmst_report', 'pmst_monitor'],
    },
    {
      name: 'pam_audit_logger', migration: '20260627090000_agent_pam_audit_logger.sql',
      typeFile: 'agent-pam-audit-logger.ts', skillDir: 'pam-audit-logger',
      interfaces: ['PamAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'pam_audit_logger', eks: ['pmau.record_received', 'pmau.fields_validated', 'pmau.record_persisted', 'pmau.export_emitted'],
      subjects: ['sven.pmau.record_received', 'sven.pmau.fields_validated', 'sven.pmau.record_persisted', 'sven.pmau.export_emitted'],
      cases: ['pmau_receive', 'pmau_validate', 'pmau_persist', 'pmau_emit', 'pmau_report', 'pmau_monitor'],
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
