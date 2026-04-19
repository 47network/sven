import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 908-912: Object Storage', () => {
  const verticals = [
    {
      name: 'object_storage_uploader', migration: '20260625450000_agent_object_storage_uploader.sql',
      typeFile: 'agent-object-storage-uploader.ts', skillDir: 'object-storage-uploader',
      interfaces: ['ObjectStorageUploaderConfig', 'UploadRequest', 'UploaderEvent'],
      bk: 'object_storage_uploader', eks: ['osup.request_received', 'osup.parts_streamed', 'osup.checksum_verified', 'osup.object_committed'],
      subjects: ['sven.osup.request_received', 'sven.osup.parts_streamed', 'sven.osup.checksum_verified', 'sven.osup.object_committed'],
      cases: ['osup_receive', 'osup_stream', 'osup_verify', 'osup_commit', 'osup_report', 'osup_monitor'],
    },
    {
      name: 'object_storage_lifecycle_manager', migration: '20260625460000_agent_object_storage_lifecycle_manager.sql',
      typeFile: 'agent-object-storage-lifecycle-manager.ts', skillDir: 'object-storage-lifecycle-manager',
      interfaces: ['ObjectStorageLifecycleManagerConfig', 'LifecycleRule', 'ManagerEvent'],
      bk: 'object_storage_lifecycle_manager', eks: ['oslm.rule_received', 'oslm.objects_evaluated', 'oslm.transitions_applied', 'oslm.audit_recorded'],
      subjects: ['sven.oslm.rule_received', 'sven.oslm.objects_evaluated', 'sven.oslm.transitions_applied', 'sven.oslm.audit_recorded'],
      cases: ['oslm_receive', 'oslm_evaluate', 'oslm_apply', 'oslm_audit', 'oslm_report', 'oslm_monitor'],
    },
    {
      name: 'object_storage_replicator', migration: '20260625470000_agent_object_storage_replicator.sql',
      typeFile: 'agent-object-storage-replicator.ts', skillDir: 'object-storage-replicator',
      interfaces: ['ObjectStorageReplicatorConfig', 'ReplicationJob', 'ReplicatorEvent'],
      bk: 'object_storage_replicator', eks: ['osrp.job_received', 'osrp.diff_computed', 'osrp.objects_replicated', 'osrp.checksum_validated'],
      subjects: ['sven.osrp.job_received', 'sven.osrp.diff_computed', 'sven.osrp.objects_replicated', 'sven.osrp.checksum_validated'],
      cases: ['osrp_receive', 'osrp_diff', 'osrp_replicate', 'osrp_validate', 'osrp_report', 'osrp_monitor'],
    },
    {
      name: 'object_storage_signed_url_minter', migration: '20260625480000_agent_object_storage_signed_url_minter.sql',
      typeFile: 'agent-object-storage-signed-url-minter.ts', skillDir: 'object-storage-signed-url-minter',
      interfaces: ['ObjectStorageSignedUrlMinterConfig', 'UrlRequest', 'MinterEvent'],
      bk: 'object_storage_signed_url_minter', eks: ['osum.request_received', 'osum.policy_evaluated', 'osum.url_minted', 'osum.audit_recorded'],
      subjects: ['sven.osum.request_received', 'sven.osum.policy_evaluated', 'sven.osum.url_minted', 'sven.osum.audit_recorded'],
      cases: ['osum_receive', 'osum_evaluate', 'osum_mint', 'osum_audit', 'osum_report', 'osum_monitor'],
    },
    {
      name: 'object_storage_integrity_checker', migration: '20260625490000_agent_object_storage_integrity_checker.sql',
      typeFile: 'agent-object-storage-integrity-checker.ts', skillDir: 'object-storage-integrity-checker',
      interfaces: ['ObjectStorageIntegrityCheckerConfig', 'IntegrityScan', 'CheckerEvent'],
      bk: 'object_storage_integrity_checker', eks: ['osic.scan_scheduled', 'osic.objects_hashed', 'osic.mismatches_flagged', 'osic.report_emitted'],
      subjects: ['sven.osic.scan_scheduled', 'sven.osic.objects_hashed', 'sven.osic.mismatches_flagged', 'sven.osic.report_emitted'],
      cases: ['osic_schedule', 'osic_hash', 'osic_flag', 'osic_emit', 'osic_report', 'osic_monitor'],
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
