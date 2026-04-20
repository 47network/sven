import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 733-737: Edge & CDN', () => {
  const verticals = [
    {
      name: 'api_gateway_router', migration: '20260623700000_agent_api_gateway_router.sql',
      typeFile: 'agent-api-gateway-router.ts', skillDir: 'api-gateway-router',
      interfaces: ['ApiGatewayRouterConfig', 'GatewayRoute', 'RouterEvent'],
      bk: 'api_gateway_router', eks: ['agwr.route_registered', 'agwr.request_proxied', 'agwr.policy_applied', 'agwr.upstream_failed'],
      subjects: ['sven.agwr.route_registered', 'sven.agwr.request_proxied', 'sven.agwr.policy_applied', 'sven.agwr.upstream_failed'],
      cases: ['agwr_register', 'agwr_proxy', 'agwr_apply', 'agwr_fail', 'agwr_report', 'agwr_monitor'],
    },
    {
      name: 'service_mesh_proxy', migration: '20260623710000_agent_service_mesh_proxy.sql',
      typeFile: 'agent-service-mesh-proxy.ts', skillDir: 'service-mesh-proxy',
      interfaces: ['ServiceMeshProxyConfig', 'MeshProxy', 'ProxyEvent'],
      bk: 'service_mesh_proxy', eks: ['smpx.proxy_attached', 'smpx.mtls_negotiated', 'smpx.policy_enforced', 'smpx.circuit_opened'],
      subjects: ['sven.smpx.proxy_attached', 'sven.smpx.mtls_negotiated', 'sven.smpx.policy_enforced', 'sven.smpx.circuit_opened'],
      cases: ['smpx_attach', 'smpx_negotiate', 'smpx_enforce', 'smpx_open', 'smpx_report', 'smpx_monitor'],
    },
    {
      name: 'edge_compute_dispatcher', migration: '20260623720000_agent_edge_compute_dispatcher.sql',
      typeFile: 'agent-edge-compute-dispatcher.ts', skillDir: 'edge-compute-dispatcher',
      interfaces: ['EdgeComputeDispatcherConfig', 'EdgeFunction', 'DispatcherEvent'],
      bk: 'edge_compute_dispatcher', eks: ['ecdp.function_deployed', 'ecdp.invocation_routed', 'ecdp.region_failover', 'ecdp.cold_start_warmed'],
      subjects: ['sven.ecdp.function_deployed', 'sven.ecdp.invocation_routed', 'sven.ecdp.region_failover', 'sven.ecdp.cold_start_warmed'],
      cases: ['ecdp_deploy', 'ecdp_route', 'ecdp_failover', 'ecdp_warm', 'ecdp_report', 'ecdp_monitor'],
    },
    {
      name: 'cdn_purge_orchestrator', migration: '20260623730000_agent_cdn_purge_orchestrator.sql',
      typeFile: 'agent-cdn-purge-orchestrator.ts', skillDir: 'cdn-purge-orchestrator',
      interfaces: ['CdnPurgeOrchestratorConfig', 'PurgeRequest', 'OrchestratorEvent'],
      bk: 'cdn_purge_orchestrator', eks: ['cdnp.purge_requested', 'cdnp.invalidation_propagated', 'cdnp.cache_warmed', 'cdnp.purge_verified'],
      subjects: ['sven.cdnp.purge_requested', 'sven.cdnp.invalidation_propagated', 'sven.cdnp.cache_warmed', 'sven.cdnp.purge_verified'],
      cases: ['cdnp_request', 'cdnp_propagate', 'cdnp_warm', 'cdnp_verify', 'cdnp_report', 'cdnp_monitor'],
    },
    {
      name: 'http_cache_warmer', migration: '20260623740000_agent_http_cache_warmer.sql',
      typeFile: 'agent-http-cache-warmer.ts', skillDir: 'http-cache-warmer',
      interfaces: ['HttpCacheWarmerConfig', 'WarmTarget', 'WarmerEvent'],
      bk: 'http_cache_warmer', eks: ['hcwm.target_queued', 'hcwm.warm_executed', 'hcwm.hit_ratio_measured', 'hcwm.schedule_updated'],
      subjects: ['sven.hcwm.target_queued', 'sven.hcwm.warm_executed', 'sven.hcwm.hit_ratio_measured', 'sven.hcwm.schedule_updated'],
      cases: ['hcwm_queue', 'hcwm_execute', 'hcwm_measure', 'hcwm_update', 'hcwm_report', 'hcwm_monitor'],
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
