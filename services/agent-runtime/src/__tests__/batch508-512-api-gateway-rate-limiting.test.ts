import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 508-512: API Gateway & Rate Limiting', () => {
  const verticals = [
    {
      name: 'throttle_controller', migration: '20260621450000_agent_throttle_controller.sql',
      typeFile: 'agent-throttle-controller.ts', skillDir: 'throttle-controller',
      interfaces: ['ThrottleControllerConfig', 'ThrottleRule', 'ThrottleMetric'],
      bk: 'throttle_controller', eks: ['thct.throttle_applied', 'thct.limit_exceeded', 'thct.burst_allowed', 'thct.rule_updated'],
      subjects: ['sven.thct.throttle_applied', 'sven.thct.limit_exceeded', 'sven.thct.burst_allowed', 'sven.thct.rule_updated'],
      cases: ['thct_apply', 'thct_limit', 'thct_burst', 'thct_monitor', 'thct_report', 'thct_configure'],
    },
    {
      name: 'api_key_rotator', migration: '20260621460000_agent_api_key_rotator.sql',
      typeFile: 'agent-api-key-rotator.ts', skillDir: 'api-key-rotator',
      interfaces: ['ApiKeyRotatorConfig', 'KeyRotation', 'KeyMetadata'],
      bk: 'api_key_rotator', eks: ['akrt.key_rotated', 'akrt.key_expired', 'akrt.key_revoked', 'akrt.rotation_scheduled'],
      subjects: ['sven.akrt.key_rotated', 'sven.akrt.key_expired', 'sven.akrt.key_revoked', 'sven.akrt.rotation_scheduled'],
      cases: ['akrt_rotate', 'akrt_expire', 'akrt_revoke', 'akrt_schedule', 'akrt_report', 'akrt_monitor'],
    },
    {
      name: 'route_balancer', migration: '20260621470000_agent_route_balancer.sql',
      typeFile: 'agent-route-balancer.ts', skillDir: 'route-balancer',
      interfaces: ['RouteBalancerConfig', 'RouteWeight', 'BalancerSnapshot'],
      bk: 'route_balancer', eks: ['rtbl.route_shifted', 'rtbl.weight_updated', 'rtbl.failover_triggered', 'rtbl.health_changed'],
      subjects: ['sven.rtbl.route_shifted', 'sven.rtbl.weight_updated', 'sven.rtbl.failover_triggered', 'sven.rtbl.health_changed'],
      cases: ['rtbl_shift', 'rtbl_update', 'rtbl_failover', 'rtbl_health', 'rtbl_report', 'rtbl_monitor'],
    },
    {
      name: 'endpoint_cache', migration: '20260621480000_agent_endpoint_cache.sql',
      typeFile: 'agent-endpoint-cache.ts', skillDir: 'endpoint-cache',
      interfaces: ['EndpointCacheConfig', 'CacheEntry', 'CacheStats'],
      bk: 'endpoint_cache', eks: ['epch.cache_hit', 'epch.cache_miss', 'epch.cache_evicted', 'epch.ttl_expired'],
      subjects: ['sven.epch.cache_hit', 'sven.epch.cache_miss', 'sven.epch.cache_evicted', 'sven.epch.ttl_expired'],
      cases: ['epch_hit', 'epch_miss', 'epch_evict', 'epch_expire', 'epch_report', 'epch_monitor'],
    },
    {
      name: 'response_compressor', migration: '20260621490000_agent_response_compressor.sql',
      typeFile: 'agent-response-compressor.ts', skillDir: 'response-compressor',
      interfaces: ['ResponseCompressorConfig', 'CompressionResult', 'CompressionProfile'],
      bk: 'response_compressor', eks: ['rscp.compression_applied', 'rscp.ratio_improved', 'rscp.format_changed', 'rscp.bypass_triggered'],
      subjects: ['sven.rscp.compression_applied', 'sven.rscp.ratio_improved', 'sven.rscp.format_changed', 'sven.rscp.bypass_triggered'],
      cases: ['rscp_compress', 'rscp_improve', 'rscp_format', 'rscp_bypass', 'rscp_report', 'rscp_monitor'],
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
