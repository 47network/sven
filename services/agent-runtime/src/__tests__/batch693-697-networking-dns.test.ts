import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 693-697: Networking & DNS', () => {
  const verticals = [
    {
      name: 'dns_zone_manager', migration: '20260623300000_agent_dns_zone_manager.sql',
      typeFile: 'agent-dns-zone-manager.ts', skillDir: 'dns-zone-manager',
      interfaces: ['DnsZoneManagerConfig', 'DnsRecord', 'ZoneEvent'],
      bk: 'dns_zone_manager', eks: ['dnzm.zone_created', 'dnzm.record_updated', 'dnzm.dnssec_signed', 'dnzm.transfer_completed'],
      subjects: ['sven.dnzm.zone_created', 'sven.dnzm.record_updated', 'sven.dnzm.dnssec_signed', 'sven.dnzm.transfer_completed'],
      cases: ['dnzm_create', 'dnzm_update', 'dnzm_sign', 'dnzm_transfer', 'dnzm_report', 'dnzm_monitor'],
    },
    {
      name: 'bgp_advertiser', migration: '20260623310000_agent_bgp_advertiser.sql',
      typeFile: 'agent-bgp-advertiser.ts', skillDir: 'bgp-advertiser',
      interfaces: ['BgpAdvertiserConfig', 'BgpRoute', 'BgpEvent'],
      bk: 'bgp_advertiser', eks: ['bgpa.prefix_advertised', 'bgpa.session_established', 'bgpa.route_withdrawn', 'bgpa.community_tagged'],
      subjects: ['sven.bgpa.prefix_advertised', 'sven.bgpa.session_established', 'sven.bgpa.route_withdrawn', 'sven.bgpa.community_tagged'],
      cases: ['bgpa_advertise', 'bgpa_establish', 'bgpa_withdraw', 'bgpa_tag', 'bgpa_report', 'bgpa_monitor'],
    },
    {
      name: 'anycast_balancer', migration: '20260623320000_agent_anycast_balancer.sql',
      typeFile: 'agent-anycast-balancer.ts', skillDir: 'anycast-balancer',
      interfaces: ['AnycastBalancerConfig', 'AnycastNode', 'BalancerEvent'],
      bk: 'anycast_balancer', eks: ['acbl.node_added', 'acbl.health_check_passed', 'acbl.traffic_steered', 'acbl.node_drained'],
      subjects: ['sven.acbl.node_added', 'sven.acbl.health_check_passed', 'sven.acbl.traffic_steered', 'sven.acbl.node_drained'],
      cases: ['acbl_add', 'acbl_check', 'acbl_steer', 'acbl_drain', 'acbl_report', 'acbl_monitor'],
    },
    {
      name: 'subnet_allocator', migration: '20260623330000_agent_subnet_allocator.sql',
      typeFile: 'agent-subnet-allocator.ts', skillDir: 'subnet-allocator',
      interfaces: ['SubnetAllocatorConfig', 'SubnetAllocation', 'AllocatorEvent'],
      bk: 'subnet_allocator', eks: ['sbna.subnet_allocated', 'sbna.cidr_split', 'sbna.allocation_released', 'sbna.utilization_alerted'],
      subjects: ['sven.sbna.subnet_allocated', 'sven.sbna.cidr_split', 'sven.sbna.allocation_released', 'sven.sbna.utilization_alerted'],
      cases: ['sbna_allocate', 'sbna_split', 'sbna_release', 'sbna_alert', 'sbna_report', 'sbna_monitor'],
    },
    {
      name: 'route_propagator', migration: '20260623340000_agent_route_propagator.sql',
      typeFile: 'agent-route-propagator.ts', skillDir: 'route-propagator',
      interfaces: ['RoutePropagatorConfig', 'RouteEntry', 'PropagatorEvent'],
      bk: 'route_propagator', eks: ['rtpr.route_added', 'rtpr.route_redistributed', 'rtpr.metric_adjusted', 'rtpr.convergence_completed'],
      subjects: ['sven.rtpr.route_added', 'sven.rtpr.route_redistributed', 'sven.rtpr.metric_adjusted', 'sven.rtpr.convergence_completed'],
      cases: ['rtpr_add', 'rtpr_redistribute', 'rtpr_adjust', 'rtpr_converge', 'rtpr_report', 'rtpr_monitor'],
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
