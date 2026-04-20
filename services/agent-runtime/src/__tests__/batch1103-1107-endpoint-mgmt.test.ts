import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1103-1107: Endpoint Management', () => {
  const verticals = [
    {
      name: 'endpoint_mgmt_enrollment', migration: '20260627400000_agent_endpoint_mgmt_enrollment.sql',
      typeFile: 'agent-endpoint-mgmt-enrollment.ts', skillDir: 'endpoint-mgmt-enrollment',
      interfaces: ['EndpointMgmtEnrollmentConfig', 'EnrollRequest', 'EnrollmentEvent'],
      bk: 'endpoint_mgmt_enrollment', eks: ['emen.request_received', 'emen.policy_evaluated', 'emen.endpoint_enrolled', 'emen.audit_recorded'],
      subjects: ['sven.emen.request_received', 'sven.emen.policy_evaluated', 'sven.emen.endpoint_enrolled', 'sven.emen.audit_recorded'],
      cases: ['emen_receive', 'emen_evaluate', 'emen_enroll', 'emen_audit', 'emen_report', 'emen_monitor'],
    },
    {
      name: 'endpoint_mgmt_policy_pusher', migration: '20260627410000_agent_endpoint_mgmt_policy_pusher.sql',
      typeFile: 'agent-endpoint-mgmt-policy-pusher.ts', skillDir: 'endpoint-mgmt-policy-pusher',
      interfaces: ['EndpointMgmtPolicyPusherConfig', 'PushRequest', 'PusherEvent'],
      bk: 'endpoint_mgmt_policy_pusher', eks: ['empp.request_received', 'empp.policy_evaluated', 'empp.policy_pushed', 'empp.audit_recorded'],
      subjects: ['sven.empp.request_received', 'sven.empp.policy_evaluated', 'sven.empp.policy_pushed', 'sven.empp.audit_recorded'],
      cases: ['empp_receive', 'empp_evaluate', 'empp_push', 'empp_audit', 'empp_report', 'empp_monitor'],
    },
    {
      name: 'endpoint_mgmt_compliance_checker', migration: '20260627420000_agent_endpoint_mgmt_compliance_checker.sql',
      typeFile: 'agent-endpoint-mgmt-compliance-checker.ts', skillDir: 'endpoint-mgmt-compliance-checker',
      interfaces: ['EndpointMgmtComplianceCheckerConfig', 'CheckRequest', 'CheckerEvent'],
      bk: 'endpoint_mgmt_compliance_checker', eks: ['emcc.request_received', 'emcc.compliance_evaluated', 'emcc.results_emitted', 'emcc.audit_recorded'],
      subjects: ['sven.emcc.request_received', 'sven.emcc.compliance_evaluated', 'sven.emcc.results_emitted', 'sven.emcc.audit_recorded'],
      cases: ['emcc_receive', 'emcc_evaluate', 'emcc_emit', 'emcc_audit', 'emcc_report', 'emcc_monitor'],
    },
    {
      name: 'endpoint_mgmt_action_dispatcher', migration: '20260627430000_agent_endpoint_mgmt_action_dispatcher.sql',
      typeFile: 'agent-endpoint-mgmt-action-dispatcher.ts', skillDir: 'endpoint-mgmt-action-dispatcher',
      interfaces: ['EndpointMgmtActionDispatcherConfig', 'ActionRequest', 'DispatcherEvent'],
      bk: 'endpoint_mgmt_action_dispatcher', eks: ['emad.request_received', 'emad.policy_evaluated', 'emad.action_dispatched', 'emad.audit_recorded'],
      subjects: ['sven.emad.request_received', 'sven.emad.policy_evaluated', 'sven.emad.action_dispatched', 'sven.emad.audit_recorded'],
      cases: ['emad_receive', 'emad_evaluate', 'emad_dispatch', 'emad_audit', 'emad_report', 'emad_monitor'],
    },
    {
      name: 'endpoint_mgmt_audit_logger', migration: '20260627440000_agent_endpoint_mgmt_audit_logger.sql',
      typeFile: 'agent-endpoint-mgmt-audit-logger.ts', skillDir: 'endpoint-mgmt-audit-logger',
      interfaces: ['EndpointMgmtAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'endpoint_mgmt_audit_logger', eks: ['emau.record_received', 'emau.fields_validated', 'emau.record_persisted', 'emau.export_emitted'],
      subjects: ['sven.emau.record_received', 'sven.emau.fields_validated', 'sven.emau.record_persisted', 'sven.emau.export_emitted'],
      cases: ['emau_receive', 'emau_validate', 'emau_persist', 'emau_emit', 'emau_report', 'emau_monitor'],
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
