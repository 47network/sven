import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 318-322: Networking & Traffic', () => {

  const migrations = [
    { file: '20260619550000_agent_network_router.sql', tables: ['agent_network_router_configs', 'agent_network_routes', 'agent_network_policies'] },
    { file: '20260619560000_agent_dns_gateway.sql', tables: ['agent_dns_gateway_configs', 'agent_dns_records', 'agent_dns_queries'] },
    { file: '20260619570000_agent_lb_orchestrator.sql', tables: ['agent_lb_orchestrator_configs', 'agent_lb_backends', 'agent_lb_rules'] },
    { file: '20260619580000_agent_cdn_proxy.sql', tables: ['agent_cdn_proxy_configs', 'agent_cdn_cache_entries', 'agent_cdn_purge_requests'] },
    { file: '20260619590000_agent_rate_controller.sql', tables: ['agent_rate_controller_configs', 'agent_rate_limit_rules', 'agent_rate_limit_events'] },
  ];

  describe('Migration SQL files', () => {
    for (const m of migrations) {
      it(`${m.file} exists`, () => {
        expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', m.file))).toBe(true);
      });
      for (const t of m.tables) {
        it(`${m.file} creates table ${t}`, () => {
          const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', m.file), 'utf-8');
          expect(sql).toContain(t);
        });
      }
    }
  });

  const typeFiles = [
    { file: 'agent-network-router.ts', exports: ['RoutingAlgorithm', 'RouteStatus', 'PolicyAction'] },
    { file: 'agent-dns-gateway.ts', exports: ['DnsRecordType', 'DnsResponseCode'] },
    { file: 'agent-lb-orchestrator.ts', exports: ['LbAlgorithm', 'BackendStatus'] },
    { file: 'agent-cdn-proxy.ts', exports: ['CachePolicy', 'PurgeType'] },
    { file: 'agent-rate-controller.ts', exports: ['RateLimitAlgorithm', 'ExceedAction'] },
  ];

  describe('Shared type files', () => {
    for (const tf of typeFiles) {
      it(`${tf.file} exists`, () => {
        expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', tf.file))).toBe(true);
      });
      for (const exp of tf.exports) {
        it(`${tf.file} exports ${exp}`, () => {
          const content = fs.readFileSync(path.join(ROOT, 'packages/shared/src', tf.file), 'utf-8');
          expect(content).toContain(exp);
        });
      }
    }
  });

  describe('Barrel exports in index.ts', () => {
    const indexContent = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    for (const b of ['agent-network-router', 'agent-dns-gateway', 'agent-lb-orchestrator', 'agent-cdn-proxy', 'agent-rate-controller']) {
      it(`exports ${b}`, () => { expect(indexContent).toContain(b); });
    }
  });

  const skills = [
    { dir: 'network-router', price: '16.99', archetype: 'engineer' },
    { dir: 'dns-gateway', price: '12.99', archetype: 'engineer' },
    { dir: 'lb-orchestrator', price: '18.99', archetype: 'engineer' },
    { dir: 'cdn-proxy', price: '21.99', archetype: 'engineer' },
    { dir: 'rate-controller', price: '13.99', archetype: 'engineer' },
  ];

  describe('SKILL.md files', () => {
    for (const s of skills) {
      const p = path.join(ROOT, 'skills/autonomous-economy', s.dir, 'SKILL.md');
      it(`${s.dir}/SKILL.md exists`, () => { expect(fs.existsSync(p)).toBe(true); });
      it(`${s.dir}/SKILL.md has correct price`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.price); });
      it(`${s.dir}/SKILL.md has correct archetype`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.archetype); });
      it(`${s.dir}/SKILL.md has Actions section`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain('## Actions'); });
    }
  });

  describe('Eidolon types.ts', () => {
    const typesContent = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    for (const bk of ['network_router', 'dns_gateway', 'lb_orchestrator', 'cdn_proxy', 'rate_controller']) {
      it(`has BK '${bk}'`, () => { expect(typesContent).toContain(`'${bk}'`); });
    }
    for (const ek of ['nrtr.route_created', 'dngw.domain_resolved', 'lbor.backend_added', 'cdnp.cache_populated', 'rtcl.rule_created']) {
      it(`has EK '${ek}'`, () => { expect(typesContent).toContain(`'${ek}'`); });
    }
    for (const bk of ['network_router', 'dns_gateway', 'lb_orchestrator', 'cdn_proxy', 'rate_controller']) {
      it(`has districtFor case '${bk}'`, () => { expect(typesContent).toContain(`case '${bk}':`); });
    }
  });

  describe('Event bus SUBJECT_MAP', () => {
    const busContent = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.nrtr.route_created', 'sven.nrtr.policy_applied', 'sven.nrtr.traffic_routed', 'sven.nrtr.failover_triggered',
      'sven.dngw.domain_resolved', 'sven.dngw.record_created', 'sven.dngw.cache_warmed', 'sven.dngw.query_completed',
      'sven.lbor.backend_added', 'sven.lbor.health_checked', 'sven.lbor.traffic_distributed', 'sven.lbor.backend_drained',
      'sven.cdnp.cache_populated', 'sven.cdnp.content_purged', 'sven.cdnp.origin_configured', 'sven.cdnp.edge_optimized',
      'sven.rtcl.rule_created', 'sven.rtcl.client_limited', 'sven.rtcl.limit_updated', 'sven.rtcl.client_blocked',
    ];
    for (const s of subjects) {
      it(`has subject '${s}'`, () => { expect(busContent).toContain(`'${s}'`); });
    }
  });

  describe('Task executor', () => {
    const execContent = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'nrtr_create_route', 'nrtr_apply_policy', 'nrtr_route_traffic', 'nrtr_trigger_failover', 'nrtr_health_check', 'nrtr_analyze_traffic',
      'dngw_resolve_domain', 'dngw_create_record', 'dngw_warm_cache', 'dngw_validate_dnssec', 'dngw_query_analytics', 'dngw_check_upstream',
      'lbor_add_backend', 'lbor_remove_backend', 'lbor_update_weights', 'lbor_check_health', 'lbor_create_rule', 'lbor_traffic_stats',
      'cdnp_configure_origin', 'cdnp_warmup_cache', 'cdnp_purge_cache', 'cdnp_edge_analytics', 'cdnp_optimize_content', 'cdnp_manage_ssl',
      'rtcl_create_rule', 'rtcl_update_limits', 'rtcl_check_status', 'rtcl_block_client', 'rtcl_analytics_report', 'rtcl_configure_algo',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => { expect(execContent).toContain(`case '${c}'`); });
    }
    for (const h of ['handleNrtrCreateRoute', 'handleDngwResolveDomain', 'handleLborAddBackend', 'handleCdnpConfigureOrigin', 'handleRtclCreateRule']) {
      it(`has handler ${h}`, () => { expect(execContent).toContain(h); });
    }
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    for (const e of [
      'agent_network_router.sql', 'agent_dns_gateway.sql', 'agent_lb_orchestrator.sql', 'agent_cdn_proxy.sql', 'agent_rate_controller.sql',
      'agent-network-router.ts', 'agent-dns-gateway.ts', 'agent-lb-orchestrator.ts', 'agent-cdn-proxy.ts', 'agent-rate-controller.ts',
      'network-router/SKILL.md', 'dns-gateway/SKILL.md', 'lb-orchestrator/SKILL.md', 'cdn-proxy/SKILL.md', 'rate-controller/SKILL.md',
    ]) {
      it(`has entry for ${e}`, () => { expect(ga).toContain(e); });
    }
  });
});
