import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1073-1077: Secrets Management', () => {
  const verticals = [
    {
      name: 'secrets_mgmt_writer', migration: '20260627100000_agent_secrets_mgmt_writer.sql',
      typeFile: 'agent-secrets-mgmt-writer.ts', skillDir: 'secrets-mgmt-writer',
      interfaces: ['SecretsMgmtWriterConfig', 'WriteRequest', 'WriterEvent'],
      bk: 'secrets_mgmt_writer', eks: ['smwr.request_received', 'smwr.fields_validated', 'smwr.secret_persisted', 'smwr.audit_recorded'],
      subjects: ['sven.smwr.request_received', 'sven.smwr.fields_validated', 'sven.smwr.secret_persisted', 'sven.smwr.audit_recorded'],
      cases: ['smwr_receive', 'smwr_validate', 'smwr_persist', 'smwr_audit', 'smwr_report', 'smwr_monitor'],
    },
    {
      name: 'secrets_mgmt_reader', migration: '20260627110000_agent_secrets_mgmt_reader.sql',
      typeFile: 'agent-secrets-mgmt-reader.ts', skillDir: 'secrets-mgmt-reader',
      interfaces: ['SecretsMgmtReaderConfig', 'ReadRequest', 'ReaderEvent'],
      bk: 'secrets_mgmt_reader', eks: ['smrd.request_received', 'smrd.policy_evaluated', 'smrd.secret_returned', 'smrd.audit_recorded'],
      subjects: ['sven.smrd.request_received', 'sven.smrd.policy_evaluated', 'sven.smrd.secret_returned', 'sven.smrd.audit_recorded'],
      cases: ['smrd_receive', 'smrd_evaluate', 'smrd_return', 'smrd_audit', 'smrd_report', 'smrd_monitor'],
    },
    {
      name: 'secrets_mgmt_rotator', migration: '20260627120000_agent_secrets_mgmt_rotator.sql',
      typeFile: 'agent-secrets-mgmt-rotator.ts', skillDir: 'secrets-mgmt-rotator',
      interfaces: ['SecretsMgmtRotatorConfig', 'RotateRequest', 'RotatorEvent'],
      bk: 'secrets_mgmt_rotator', eks: ['smro.request_received', 'smro.policy_evaluated', 'smro.secret_rotated', 'smro.audit_recorded'],
      subjects: ['sven.smro.request_received', 'sven.smro.policy_evaluated', 'sven.smro.secret_rotated', 'sven.smro.audit_recorded'],
      cases: ['smro_receive', 'smro_evaluate', 'smro_rotate', 'smro_audit', 'smro_report', 'smro_monitor'],
    },
    {
      name: 'secrets_mgmt_revoker', migration: '20260627130000_agent_secrets_mgmt_revoker.sql',
      typeFile: 'agent-secrets-mgmt-revoker.ts', skillDir: 'secrets-mgmt-revoker',
      interfaces: ['SecretsMgmtRevokerConfig', 'RevokeRequest', 'RevokerEvent'],
      bk: 'secrets_mgmt_revoker', eks: ['smrv.request_received', 'smrv.policy_evaluated', 'smrv.secret_revoked', 'smrv.audit_recorded'],
      subjects: ['sven.smrv.request_received', 'sven.smrv.policy_evaluated', 'sven.smrv.secret_revoked', 'sven.smrv.audit_recorded'],
      cases: ['smrv_receive', 'smrv_evaluate', 'smrv_revoke', 'smrv_audit', 'smrv_report', 'smrv_monitor'],
    },
    {
      name: 'secrets_mgmt_audit_logger', migration: '20260627140000_agent_secrets_mgmt_audit_logger.sql',
      typeFile: 'agent-secrets-mgmt-audit-logger.ts', skillDir: 'secrets-mgmt-audit-logger',
      interfaces: ['SecretsMgmtAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'secrets_mgmt_audit_logger', eks: ['smau.record_received', 'smau.fields_validated', 'smau.record_persisted', 'smau.export_emitted'],
      subjects: ['sven.smau.record_received', 'sven.smau.fields_validated', 'sven.smau.record_persisted', 'sven.smau.export_emitted'],
      cases: ['smau_receive', 'smau_validate', 'smau_persist', 'smau_emit', 'smau_report', 'smau_monitor'],
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
