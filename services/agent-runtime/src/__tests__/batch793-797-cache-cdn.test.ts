import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 793-797: Cache & CDN Operations', () => {
  const verticals = [
    {
      name: 'distributed_cache_warmer', migration: '20260624300000_agent_distributed_cache_warmer.sql',
      typeFile: 'agent-distributed-cache-warmer.ts', skillDir: 'distributed-cache-warmer',
      interfaces: ['DistributedCacheWarmerConfig', 'WarmupJob', 'WarmerEvent'],
      bk: 'distributed_cache_warmer', eks: ['dcwm.targets_selected', 'dcwm.payload_prefetched', 'dcwm.cache_populated', 'dcwm.coverage_measured'],
      subjects: ['sven.dcwm.targets_selected', 'sven.dcwm.payload_prefetched', 'sven.dcwm.cache_populated', 'sven.dcwm.coverage_measured'],
      cases: ['dcwm_select', 'dcwm_prefetch', 'dcwm_populate', 'dcwm_measure', 'dcwm_report', 'dcwm_monitor'],
    },
    {
      name: 'cache_invalidator', migration: '20260624310000_agent_cache_invalidator.sql',
      typeFile: 'agent-cache-invalidator.ts', skillDir: 'cache-invalidator',
      interfaces: ['CacheInvalidatorConfig', 'InvalidationEvent', 'InvalidatorEvent'],
      bk: 'cache_invalidator', eks: ['cinv.event_received', 'cinv.keys_resolved', 'cinv.invalidation_dispatched', 'cinv.confirmation_received'],
      subjects: ['sven.cinv.event_received', 'sven.cinv.keys_resolved', 'sven.cinv.invalidation_dispatched', 'sven.cinv.confirmation_received'],
      cases: ['cinv_receive', 'cinv_resolve', 'cinv_dispatch', 'cinv_confirm', 'cinv_report', 'cinv_monitor'],
    },
    {
      name: 'cdn_purger', migration: '20260624320000_agent_cdn_purger.sql',
      typeFile: 'agent-cdn-purger.ts', skillDir: 'cdn-purger',
      interfaces: ['CdnPurgerConfig', 'PurgeJob', 'PurgerEvent'],
      bk: 'cdn_purger', eks: ['cdnp.purge_requested', 'cdnp.edges_targeted', 'cdnp.purge_executed', 'cdnp.completion_verified'],
      subjects: ['sven.cdnp.purge_requested', 'sven.cdnp.edges_targeted', 'sven.cdnp.purge_executed', 'sven.cdnp.completion_verified'],
      cases: ['cdnp_request', 'cdnp_target', 'cdnp_execute', 'cdnp_verify', 'cdnp_report', 'cdnp_monitor'],
    },
    {
      name: 'asset_optimizer', migration: '20260624330000_agent_asset_optimizer.sql',
      typeFile: 'agent-asset-optimizer.ts', skillDir: 'asset-optimizer',
      interfaces: ['AssetOptimizerConfig', 'AssetOptimization', 'OptimizerEvent'],
      bk: 'asset_optimizer', eks: ['asop.asset_received', 'asop.compression_applied', 'asop.format_converted', 'asop.upload_completed'],
      subjects: ['sven.asop.asset_received', 'sven.asop.compression_applied', 'sven.asop.format_converted', 'sven.asop.upload_completed'],
      cases: ['asop_receive', 'asop_compress', 'asop_convert', 'asop_upload', 'asop_report', 'asop_monitor'],
    },
    {
      name: 'media_thumbnail_generator', migration: '20260624340000_agent_media_thumbnail_generator.sql',
      typeFile: 'agent-media-thumbnail-generator.ts', skillDir: 'media-thumbnail-generator',
      interfaces: ['MediaThumbnailGeneratorConfig', 'ThumbnailJob', 'GeneratorEvent'],
      bk: 'media_thumbnail_generator', eks: ['mtgn.media_received', 'mtgn.frames_extracted', 'mtgn.thumbnails_rendered', 'mtgn.storage_uploaded'],
      subjects: ['sven.mtgn.media_received', 'sven.mtgn.frames_extracted', 'sven.mtgn.thumbnails_rendered', 'sven.mtgn.storage_uploaded'],
      cases: ['mtgn_receive', 'mtgn_extract', 'mtgn_render', 'mtgn_upload', 'mtgn_report', 'mtgn_monitor'],
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
