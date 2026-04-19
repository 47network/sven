import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 668-672: Edge Computing', () => {
  const verticals = [
    {
      name: 'edge_deployer', migration: '20260623050000_agent_edge_deployer.sql',
      typeFile: 'agent-edge-deployer.ts', skillDir: 'edge-deployer',
      interfaces: ['EdgeDeployerConfig', 'DeploymentTarget', 'DeployerEvent'],
      bk: 'edge_deployer', eks: ['edde.function_deployed', 'edde.region_activated', 'edde.rollback_triggered', 'edde.health_verified'],
      subjects: ['sven.edde.function_deployed', 'sven.edde.region_activated', 'sven.edde.rollback_triggered', 'sven.edde.health_verified'],
      cases: ['edde_deploy', 'edde_activate', 'edde_rollback', 'edde_health', 'edde_report', 'edde_monitor'],
    },
    {
      name: 'cdn_optimizer', migration: '20260623060000_agent_cdn_optimizer.sql',
      typeFile: 'agent-cdn-optimizer.ts', skillDir: 'cdn-optimizer',
      interfaces: ['CdnOptimizerConfig', 'CachePolicy', 'OptimizerEvent'],
      bk: 'cdn_optimizer', eks: ['cdno.cache_invalidated', 'cdno.origin_shielded', 'cdno.compression_applied', 'cdno.hit_ratio_improved'],
      subjects: ['sven.cdno.cache_invalidated', 'sven.cdno.origin_shielded', 'sven.cdno.compression_applied', 'sven.cdno.hit_ratio_improved'],
      cases: ['cdno_invalidate', 'cdno_shield', 'cdno_compress', 'cdno_ratio', 'cdno_report', 'cdno_monitor'],
    },
    {
      name: 'latency_reducer', migration: '20260623070000_agent_latency_reducer.sql',
      typeFile: 'agent-latency-reducer.ts', skillDir: 'latency-reducer',
      interfaces: ['LatencyReducerConfig', 'LatencyMeasurement', 'ReducerEvent'],
      bk: 'latency_reducer', eks: ['ltre.bottleneck_found', 'ltre.route_optimized', 'ltre.prefetch_enabled', 'ltre.p99_improved'],
      subjects: ['sven.ltre.bottleneck_found', 'sven.ltre.route_optimized', 'sven.ltre.prefetch_enabled', 'sven.ltre.p99_improved'],
      cases: ['ltre_bottleneck', 'ltre_route', 'ltre_prefetch', 'ltre_p99', 'ltre_report', 'ltre_monitor'],
    },
    {
      name: 'geo_router', migration: '20260623080000_agent_geo_router.sql',
      typeFile: 'agent-geo-router.ts', skillDir: 'geo-router',
      interfaces: ['GeoRouterConfig', 'RoutingRule', 'RouterEvent'],
      bk: 'geo_router', eks: ['geor.request_routed', 'geor.failover_triggered', 'geor.region_weighted', 'geor.compliance_enforced'],
      subjects: ['sven.geor.request_routed', 'sven.geor.failover_triggered', 'sven.geor.region_weighted', 'sven.geor.compliance_enforced'],
      cases: ['geor_route', 'geor_failover', 'geor_weight', 'geor_comply', 'geor_report', 'geor_monitor'],
    },
    {
      name: 'edge_cache_manager', migration: '20260623090000_agent_edge_cache_manager.sql',
      typeFile: 'agent-edge-cache-manager.ts', skillDir: 'edge-cache-manager',
      interfaces: ['EdgeCacheManagerConfig', 'CacheEntry', 'ManagerEvent'],
      bk: 'edge_cache_manager', eks: ['ecmg.entry_cached', 'ecmg.ttl_adjusted', 'ecmg.stale_purged', 'ecmg.capacity_rebalanced'],
      subjects: ['sven.ecmg.entry_cached', 'sven.ecmg.ttl_adjusted', 'sven.ecmg.stale_purged', 'sven.ecmg.capacity_rebalanced'],
      cases: ['ecmg_cache', 'ecmg_ttl', 'ecmg_purge', 'ecmg_rebalance', 'ecmg_report', 'ecmg_monitor'],
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
