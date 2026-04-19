import * as fs from 'fs';
import * as path from 'path';
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
function readFile(rel: string): string { return fs.readFileSync(path.join(ROOT, rel), 'utf-8'); }

describe('Batches 258-262 — Network Advanced Services', () => {
  describe('Batch 258 — Service Mesh migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618950000_agent_service_mesh.sql');
    test('creates agent_mesh_configs', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_mesh_configs'));
    test('creates agent_mesh_services', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_mesh_services'));
    test('creates agent_mesh_traffic_rules', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_mesh_traffic_rules'));
    test('has mtls_enabled', () => expect(sql).toContain('mtls_enabled'));
  });
  describe('Batch 258 — Service Mesh types', () => {
    const src = readFile('packages/shared/src/agent-service-mesh.ts');
    test('exports MeshSidecarMode', () => expect(src).toContain('MeshSidecarMode'));
    test('exports AgentMeshConfig', () => expect(src).toContain('AgentMeshConfig'));
    test('exports AgentMeshService', () => expect(src).toContain('AgentMeshService'));
    test('exports AgentMeshTrafficRule', () => expect(src).toContain('AgentMeshTrafficRule'));
  });
  describe('Batch 258 — Service Mesh SKILL.md', () => {
    const s = readFile('skills/autonomous-economy/service-mesh/SKILL.md');
    test('has name', () => expect(s).toContain('name: Service Mesh'));
    test('has price', () => expect(s).toContain('price: 12.99'));
    test('has archetype', () => expect(s).toContain('archetype: engineer'));
    test('has Actions', () => expect(s).toContain('## Actions'));
  });
  describe('Batch 259 — WAN Optimizer migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618960000_agent_wan_optimizer.sql');
    test('creates agent_wan_configs', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_wan_configs'));
    test('creates agent_wan_tunnels', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_wan_tunnels'));
    test('creates agent_wan_metrics', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_wan_metrics'));
  });
  describe('Batch 259 — WAN Optimizer types', () => {
    const src = readFile('packages/shared/src/agent-wan-optimizer.ts');
    test('exports WanCompressionAlgo', () => expect(src).toContain('WanCompressionAlgo'));
    test('exports AgentWanConfig', () => expect(src).toContain('AgentWanConfig'));
    test('exports AgentWanTunnel', () => expect(src).toContain('AgentWanTunnel'));
    test('exports AgentWanMetric', () => expect(src).toContain('AgentWanMetric'));
  });
  describe('Batch 259 — WAN Optimizer SKILL.md', () => {
    const s = readFile('skills/autonomous-economy/wan-optimizer/SKILL.md');
    test('has name', () => expect(s).toContain('name: WAN Optimizer'));
    test('has price', () => expect(s).toContain('price: 11.99'));
    test('has Actions', () => expect(s).toContain('## Actions'));
  });
  describe('Batch 260 — Link Aggregator migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618970000_agent_link_aggregator.sql');
    test('creates agent_lag_groups', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_lag_groups'));
    test('creates agent_lag_members', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_lag_members'));
    test('creates agent_lag_stats', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_lag_stats'));
  });
  describe('Batch 260 — Link Aggregator types', () => {
    const src = readFile('packages/shared/src/agent-link-aggregator.ts');
    test('exports LagMode', () => expect(src).toContain('LagMode'));
    test('exports AgentLagGroup', () => expect(src).toContain('AgentLagGroup'));
    test('exports AgentLagMember', () => expect(src).toContain('AgentLagMember'));
    test('exports AgentLagStat', () => expect(src).toContain('AgentLagStat'));
  });
  describe('Batch 260 — Link Aggregator SKILL.md', () => {
    const s = readFile('skills/autonomous-economy/link-aggregator/SKILL.md');
    test('has name', () => expect(s).toContain('name: Link Aggregator'));
    test('has price', () => expect(s).toContain('price: 8.99'));
    test('has Actions', () => expect(s).toContain('## Actions'));
  });
  describe('Batch 261 — Protocol Gateway migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618980000_agent_protocol_gateway.sql');
    test('creates agent_proto_gateways', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proto_gateways'));
    test('creates agent_proto_mappings', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proto_mappings'));
    test('creates agent_proto_metrics', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proto_metrics'));
  });
  describe('Batch 261 — Protocol Gateway types', () => {
    const src = readFile('packages/shared/src/agent-protocol-gateway.ts');
    test('exports ProtoTransformType', () => expect(src).toContain('ProtoTransformType'));
    test('exports AgentProtoGateway', () => expect(src).toContain('AgentProtoGateway'));
    test('exports AgentProtoMapping', () => expect(src).toContain('AgentProtoMapping'));
    test('exports AgentProtoMetric', () => expect(src).toContain('AgentProtoMetric'));
  });
  describe('Batch 261 — Protocol Gateway SKILL.md', () => {
    const s = readFile('skills/autonomous-economy/protocol-gateway/SKILL.md');
    test('has name', () => expect(s).toContain('name: Protocol Gateway'));
    test('has price', () => expect(s).toContain('price: 9.99'));
    test('has Actions', () => expect(s).toContain('## Actions'));
  });
  describe('Batch 262 — VLAN Manager migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618990000_agent_vlan_manager.sql');
    test('creates agent_vlan_configs', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_vlan_configs'));
    test('creates agent_vlan_ports', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_vlan_ports'));
    test('creates agent_vlan_acls', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_vlan_acls'));
  });
  describe('Batch 262 — VLAN Manager types', () => {
    const src = readFile('packages/shared/src/agent-vlan-manager.ts');
    test('exports VlanPortType', () => expect(src).toContain('VlanPortType'));
    test('exports AgentVlanConfig', () => expect(src).toContain('AgentVlanConfig'));
    test('exports AgentVlanPort', () => expect(src).toContain('AgentVlanPort'));
    test('exports AgentVlanAcl', () => expect(src).toContain('AgentVlanAcl'));
  });
  describe('Batch 262 — VLAN Manager SKILL.md', () => {
    const s = readFile('skills/autonomous-economy/vlan-manager/SKILL.md');
    test('has name', () => expect(s).toContain('name: VLAN Manager'));
    test('has price', () => expect(s).toContain('price: 7.99'));
    test('has Actions', () => expect(s).toContain('## Actions'));
  });
  describe('Barrel exports 258-262', () => {
    const idx = readFile('packages/shared/src/index.ts');
    test('exports service-mesh', () => expect(idx).toContain("from './agent-service-mesh.js'"));
    test('exports wan-optimizer', () => expect(idx).toContain("from './agent-wan-optimizer.js'"));
    test('exports link-aggregator', () => expect(idx).toContain("from './agent-link-aggregator.js'"));
    test('exports protocol-gateway', () => expect(idx).toContain("from './agent-protocol-gateway.js'"));
    test('exports vlan-manager', () => expect(idx).toContain("from './agent-vlan-manager.js'"));
  });
  describe('Eidolon wiring 258-262', () => {
    const types = readFile('services/sven-eidolon/src/types.ts');
    test('BK service_mesh', () => expect(types).toContain("'service_mesh'"));
    test('BK wan_optimizer', () => expect(types).toContain("'wan_optimizer'"));
    test('BK link_aggregator', () => expect(types).toContain("'link_aggregator'"));
    test('BK protocol_gateway', () => expect(types).toContain("'protocol_gateway'"));
    test('BK vlan_manager', () => expect(types).toContain("'vlan_manager'"));
    test('EK mesh.deployed', () => expect(types).toContain("'mesh.deployed'"));
    test('EK wan.tunnel_established', () => expect(types).toContain("'wan.tunnel_established'"));
    test('EK lag.group_created', () => expect(types).toContain("'lag.group_created'"));
    test('EK proto.gateway_created', () => expect(types).toContain("'proto.gateway_created'"));
    test('EK vlan.created', () => expect(types).toContain("'vlan.created'"));
    test('districtFor service_mesh', () => expect(types).toContain("case 'service_mesh':"));
    test('districtFor vlan_manager', () => expect(types).toContain("case 'vlan_manager':"));
  });
  describe('SUBJECT_MAP 258-262', () => {
    const bus = readFile('services/sven-eidolon/src/event-bus.ts');
    test('mesh.deployed', () => expect(bus).toContain("'sven.mesh.deployed'"));
    test('wan.optimizer_created', () => expect(bus).toContain("'sven.wan.optimizer_created'"));
    test('lag.member_added', () => expect(bus).toContain("'sven.lag.member_added'"));
    test('proto.mapping_added', () => expect(bus).toContain("'sven.proto.mapping_added'"));
    test('vlan.acl_applied', () => expect(bus).toContain("'sven.vlan.acl_applied'"));
  });
  describe('Task executor cases 258-262', () => {
    const te = readFile('services/sven-marketplace/src/task-executor.ts');
    test('mesh_deploy', () => expect(te).toContain("case 'mesh_deploy'"));
    test('wan_create_optimizer', () => expect(te).toContain("case 'wan_create_optimizer'"));
    test('lag_create_group', () => expect(te).toContain("case 'lag_create_group'"));
    test('proto_create_gateway', () => expect(te).toContain("case 'proto_create_gateway'"));
    test('vlan_create', () => expect(te).toContain("case 'vlan_create'"));
  });
  describe('Task executor handlers 258-262', () => {
    const te = readFile('services/sven-marketplace/src/task-executor.ts');
    test('handleMeshDeploy', () => expect(te).toContain('handleMeshDeploy'));
    test('handleWanCreateOptimizer', () => expect(te).toContain('handleWanCreateOptimizer'));
    test('handleLagCreateGroup', () => expect(te).toContain('handleLagCreateGroup'));
    test('handleProtoCreateGateway', () => expect(te).toContain('handleProtoCreateGateway'));
    test('handleVlanCreate', () => expect(te).toContain('handleVlanCreate'));
    test('handleVlanStats', () => expect(te).toContain('handleVlanStats'));
  });
  describe('.gitattributes 258-262', () => {
    const ga = readFile('.gitattributes');
    test('service_mesh migration', () => expect(ga).toContain('20260618950000_agent_service_mesh.sql'));
    test('wan-optimizer types', () => expect(ga).toContain('agent-wan-optimizer.ts'));
    test('link-aggregator skill', () => expect(ga).toContain('link-aggregator/**'));
    test('protocol-gateway skill', () => expect(ga).toContain('protocol-gateway/**'));
    test('vlan-manager skill', () => expect(ga).toContain('vlan-manager/**'));
  });
});
