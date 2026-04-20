import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 703-707: Storage Management', () => {
  const verticals = [
    {
      name: 'storage_provisioner', migration: '20260623400000_agent_storage_provisioner.sql',
      typeFile: 'agent-storage-provisioner.ts', skillDir: 'storage-provisioner',
      interfaces: ['StorageProvisionerConfig', 'StorageClass', 'ProvisionerEvent'],
      bk: 'storage_provisioner', eks: ['stpv.volume_provisioned', 'stpv.class_created', 'stpv.binding_completed', 'stpv.reclaim_executed'],
      subjects: ['sven.stpv.volume_provisioned', 'sven.stpv.class_created', 'sven.stpv.binding_completed', 'sven.stpv.reclaim_executed'],
      cases: ['stpv_provision', 'stpv_create', 'stpv_bind', 'stpv_reclaim', 'stpv_report', 'stpv_monitor'],
    },
    {
      name: 'volume_snapshotter', migration: '20260623410000_agent_volume_snapshotter.sql',
      typeFile: 'agent-volume-snapshotter.ts', skillDir: 'volume-snapshotter',
      interfaces: ['VolumeSnapshotterConfig', 'Snapshot', 'SnapshotterEvent'],
      bk: 'volume_snapshotter', eks: ['vlsn.snapshot_taken', 'vlsn.snapshot_restored', 'vlsn.retention_pruned', 'vlsn.consistency_verified'],
      subjects: ['sven.vlsn.snapshot_taken', 'sven.vlsn.snapshot_restored', 'sven.vlsn.retention_pruned', 'sven.vlsn.consistency_verified'],
      cases: ['vlsn_take', 'vlsn_restore', 'vlsn_prune', 'vlsn_verify', 'vlsn_report', 'vlsn_monitor'],
    },
    {
      name: 'pvc_resizer', migration: '20260623420000_agent_pvc_resizer.sql',
      typeFile: 'agent-pvc-resizer.ts', skillDir: 'pvc-resizer',
      interfaces: ['PvcResizerConfig', 'ResizeRequest', 'ResizerEvent'],
      bk: 'pvc_resizer', eks: ['pvcr.expansion_requested', 'pvcr.filesystem_grown', 'pvcr.capacity_validated', 'pvcr.resize_completed'],
      subjects: ['sven.pvcr.expansion_requested', 'sven.pvcr.filesystem_grown', 'sven.pvcr.capacity_validated', 'sven.pvcr.resize_completed'],
      cases: ['pvcr_request', 'pvcr_grow', 'pvcr_validate', 'pvcr_complete', 'pvcr_report', 'pvcr_monitor'],
    },
    {
      name: 'csi_driver_manager', migration: '20260623430000_agent_csi_driver_manager.sql',
      typeFile: 'agent-csi-driver-manager.ts', skillDir: 'csi-driver-manager',
      interfaces: ['CsiDriverManagerConfig', 'CsiDriver', 'ManagerEvent'],
      bk: 'csi_driver_manager', eks: ['csdm.driver_installed', 'csdm.capability_registered', 'csdm.upgrade_rolled', 'csdm.health_verified'],
      subjects: ['sven.csdm.driver_installed', 'sven.csdm.capability_registered', 'sven.csdm.upgrade_rolled', 'sven.csdm.health_verified'],
      cases: ['csdm_install', 'csdm_register', 'csdm_upgrade', 'csdm_verify', 'csdm_report', 'csdm_monitor'],
    },
    {
      name: 'storage_tiering_engine', migration: '20260623440000_agent_storage_tiering_engine.sql',
      typeFile: 'agent-storage-tiering-engine.ts', skillDir: 'storage-tiering-engine',
      interfaces: ['StorageTieringEngineConfig', 'TierPolicy', 'TieringEvent'],
      bk: 'storage_tiering_engine', eks: ['stte.tier_promoted', 'stte.tier_demoted', 'stte.access_pattern_analyzed', 'stte.cost_optimized'],
      subjects: ['sven.stte.tier_promoted', 'sven.stte.tier_demoted', 'sven.stte.access_pattern_analyzed', 'sven.stte.cost_optimized'],
      cases: ['stte_promote', 'stte_demote', 'stte_analyze', 'stte_optimize', 'stte_report', 'stte_monitor'],
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
