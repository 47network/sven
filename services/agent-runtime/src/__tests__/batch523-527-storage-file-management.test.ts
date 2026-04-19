import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 523-527: Storage & File Management', () => {
  const verticals = [
    {
      name: 'blob_archiver', migration: '20260621600000_agent_blob_archiver.sql',
      typeFile: 'agent-blob-archiver.ts', skillDir: 'blob-archiver',
      interfaces: ['BlobArchiverConfig', 'ArchiveEntry', 'ArchiveManifest'],
      bk: 'blob_archiver', eks: ['blar.blob_archived', 'blar.tier_migrated', 'blar.retention_applied', 'blar.archive_verified'],
      subjects: ['sven.blar.blob_archived', 'sven.blar.tier_migrated', 'sven.blar.retention_applied', 'sven.blar.archive_verified'],
      cases: ['blar_archive', 'blar_migrate', 'blar_retain', 'blar_verify', 'blar_report', 'blar_monitor'],
    },
    {
      name: 'file_deduplicator', migration: '20260621610000_agent_file_deduplicator.sql',
      typeFile: 'agent-file-deduplicator.ts', skillDir: 'file-deduplicator',
      interfaces: ['FileDeduplicatorConfig', 'DuplicateGroup', 'DeduplicationReport'],
      bk: 'file_deduplicator', eks: ['fldp.duplicate_found', 'fldp.hash_computed', 'fldp.dedup_completed', 'fldp.space_reclaimed'],
      subjects: ['sven.fldp.duplicate_found', 'sven.fldp.hash_computed', 'sven.fldp.dedup_completed', 'sven.fldp.space_reclaimed'],
      cases: ['fldp_find', 'fldp_hash', 'fldp_dedup', 'fldp_reclaim', 'fldp_report', 'fldp_monitor'],
    },
    {
      name: 'storage_tierer', migration: '20260621620000_agent_storage_tierer.sql',
      typeFile: 'agent-storage-tierer.ts', skillDir: 'storage-tierer',
      interfaces: ['StorageTiererConfig', 'TierPolicy', 'MigrationResult'],
      bk: 'storage_tierer', eks: ['sttr.tier_assigned', 'sttr.data_migrated', 'sttr.policy_evaluated', 'sttr.cost_optimized'],
      subjects: ['sven.sttr.tier_assigned', 'sven.sttr.data_migrated', 'sven.sttr.policy_evaluated', 'sven.sttr.cost_optimized'],
      cases: ['sttr_assign', 'sttr_migrate', 'sttr_evaluate', 'sttr_optimize', 'sttr_report', 'sttr_monitor'],
    },
    {
      name: 'media_transcoder', migration: '20260621630000_agent_media_transcoder.sql',
      typeFile: 'agent-media-transcoder.ts', skillDir: 'media-transcoder',
      interfaces: ['MediaTranscoderConfig', 'TranscodeJob', 'TranscodeOutput'],
      bk: 'media_transcoder', eks: ['mdtc.transcode_started', 'mdtc.format_converted', 'mdtc.quality_adjusted', 'mdtc.job_completed'],
      subjects: ['sven.mdtc.transcode_started', 'sven.mdtc.format_converted', 'sven.mdtc.quality_adjusted', 'sven.mdtc.job_completed'],
      cases: ['mdtc_start', 'mdtc_convert', 'mdtc_adjust', 'mdtc_complete', 'mdtc_report', 'mdtc_monitor'],
    },
    {
      name: 'thumbnail_generator', migration: '20260621640000_agent_thumbnail_generator.sql',
      typeFile: 'agent-thumbnail-generator.ts', skillDir: 'thumbnail-generator',
      interfaces: ['ThumbnailGeneratorConfig', 'ThumbnailSpec', 'GenerationResult'],
      bk: 'thumbnail_generator', eks: ['thgn.thumbnail_created', 'thgn.size_variant_generated', 'thgn.cache_populated', 'thgn.batch_processed'],
      subjects: ['sven.thgn.thumbnail_created', 'sven.thgn.size_variant_generated', 'sven.thgn.cache_populated', 'sven.thgn.batch_processed'],
      cases: ['thgn_create', 'thgn_variant', 'thgn_populate', 'thgn_batch', 'thgn_report', 'thgn_monitor'],
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
      test('type file exports interfaces', () => {
        const content = fs.readFileSync(path.join(ROOT, 'packages/shared/src', v.typeFile), 'utf-8');
        v.interfaces.forEach((iface) => { expect(content).toContain(`export interface ${iface}`); });
      });
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`from './${v.typeFile.replace('.ts', '')}'`);
      });
      test('SKILL.md exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'))).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const content = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(content).toContain('## Actions');
      });
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => { expect(types).toContain(`'${ek}'`); });
      });
      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((subj) => { expect(eb).toContain(`'${subj}'`); });
      });
      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((cs) => { expect(te).toContain(`case '${cs}'`); });
      });
    });
  });
});
