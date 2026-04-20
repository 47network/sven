import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1078-1082: Key Management', () => {
  const verticals = [
    {
      name: 'key_mgmt_generator', migration: '20260627150000_agent_key_mgmt_generator.sql',
      typeFile: 'agent-key-mgmt-generator.ts', skillDir: 'key-mgmt-generator',
      interfaces: ['KeyMgmtGeneratorConfig', 'GenerateRequest', 'GeneratorEvent'],
      bk: 'key_mgmt_generator', eks: ['kmgn.request_received', 'kmgn.policy_evaluated', 'kmgn.key_generated', 'kmgn.audit_recorded'],
      subjects: ['sven.kmgn.request_received', 'sven.kmgn.policy_evaluated', 'sven.kmgn.key_generated', 'sven.kmgn.audit_recorded'],
      cases: ['kmgn_receive', 'kmgn_evaluate', 'kmgn_generate', 'kmgn_audit', 'kmgn_report', 'kmgn_monitor'],
    },
    {
      name: 'key_mgmt_distributor', migration: '20260627160000_agent_key_mgmt_distributor.sql',
      typeFile: 'agent-key-mgmt-distributor.ts', skillDir: 'key-mgmt-distributor',
      interfaces: ['KeyMgmtDistributorConfig', 'DistributeRequest', 'DistributorEvent'],
      bk: 'key_mgmt_distributor', eks: ['kmds.request_received', 'kmds.policy_evaluated', 'kmds.key_distributed', 'kmds.audit_recorded'],
      subjects: ['sven.kmds.request_received', 'sven.kmds.policy_evaluated', 'sven.kmds.key_distributed', 'sven.kmds.audit_recorded'],
      cases: ['kmds_receive', 'kmds_evaluate', 'kmds_distribute', 'kmds_audit', 'kmds_report', 'kmds_monitor'],
    },
    {
      name: 'key_mgmt_rotator', migration: '20260627170000_agent_key_mgmt_rotator.sql',
      typeFile: 'agent-key-mgmt-rotator.ts', skillDir: 'key-mgmt-rotator',
      interfaces: ['KeyMgmtRotatorConfig', 'RotateRequest', 'RotatorEvent'],
      bk: 'key_mgmt_rotator', eks: ['kmrt.request_received', 'kmrt.policy_evaluated', 'kmrt.key_rotated', 'kmrt.audit_recorded'],
      subjects: ['sven.kmrt.request_received', 'sven.kmrt.policy_evaluated', 'sven.kmrt.key_rotated', 'sven.kmrt.audit_recorded'],
      cases: ['kmrt_receive', 'kmrt_evaluate', 'kmrt_rotate', 'kmrt_audit', 'kmrt_report', 'kmrt_monitor'],
    },
    {
      name: 'key_mgmt_revoker', migration: '20260627180000_agent_key_mgmt_revoker.sql',
      typeFile: 'agent-key-mgmt-revoker.ts', skillDir: 'key-mgmt-revoker',
      interfaces: ['KeyMgmtRevokerConfig', 'RevokeRequest', 'RevokerEvent'],
      bk: 'key_mgmt_revoker', eks: ['kmrv.request_received', 'kmrv.policy_evaluated', 'kmrv.key_revoked', 'kmrv.audit_recorded'],
      subjects: ['sven.kmrv.request_received', 'sven.kmrv.policy_evaluated', 'sven.kmrv.key_revoked', 'sven.kmrv.audit_recorded'],
      cases: ['kmrv_receive', 'kmrv_evaluate', 'kmrv_revoke', 'kmrv_audit', 'kmrv_report', 'kmrv_monitor'],
    },
    {
      name: 'key_mgmt_audit_logger', migration: '20260627190000_agent_key_mgmt_audit_logger.sql',
      typeFile: 'agent-key-mgmt-audit-logger.ts', skillDir: 'key-mgmt-audit-logger',
      interfaces: ['KeyMgmtAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'key_mgmt_audit_logger', eks: ['kmau.record_received', 'kmau.fields_validated', 'kmau.record_persisted', 'kmau.export_emitted'],
      subjects: ['sven.kmau.record_received', 'sven.kmau.fields_validated', 'sven.kmau.record_persisted', 'sven.kmau.export_emitted'],
      cases: ['kmau_receive', 'kmau_validate', 'kmau_persist', 'kmau_emit', 'kmau_report', 'kmau_monitor'],
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
