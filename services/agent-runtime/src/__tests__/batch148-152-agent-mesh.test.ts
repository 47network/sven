import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/* ─── helpers ─── */
const readFile = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');
const fileExists = (rel: string) => fs.existsSync(path.join(ROOT, rel));

/* ══════════════════════════════════════════════════════════════════
   BATCH 148 — Agent Mesh Routing
   ══════════════════════════════════════════════════════════════════ */

describe('Batch 148 — Mesh Routing migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617850000_agent_mesh_routing.sql');
  it('creates mesh_route_tables', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS mesh_route_tables'));
  it('creates mesh_route_entries', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS mesh_route_entries'));
  it('creates mesh_route_logs', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS mesh_route_logs'));
  it('has agent_id column', () => expect(sql).toContain('agent_id'));
  it('has policy column', () => expect(sql).toContain('policy'));
  it('creates indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 148 — Mesh Routing types', () => {
  const src = readFile('packages/shared/src/agent-mesh-routing.ts');
  it('exports MeshRoutingPolicy', () => expect(src).toContain('MeshRoutingPolicy'));
  it('exports RouteHealthStatus', () => expect(src).toContain('RouteHealthStatus'));
  it('exports MeshRouteTable interface', () => expect(src).toContain('interface MeshRouteTable'));
  it('exports MeshRouteEntry interface', () => expect(src).toContain('interface MeshRouteEntry'));
  it('exports MeshRouteLog interface', () => expect(src).toContain('interface MeshRouteLog'));
  it('exports MeshRoutingStats interface', () => expect(src).toContain('interface MeshRoutingStats'));
  it('has round_robin policy', () => expect(src).toContain("'round_robin'"));
  it('has failover policy', () => expect(src).toContain("'failover'"));
  it('has broadcast policy', () => expect(src).toContain("'broadcast'"));
});

describe('Batch 148 — Mesh Routing skill', () => {
  const md = readFile('skills/agent-mesh-routing/SKILL.md');
  it('file exists', () => expect(fileExists('skills/agent-mesh-routing/SKILL.md')).toBe(true));
  it('has YAML frontmatter', () => expect(md).toMatch(/^---/));
  it('has name field', () => expect(md).toContain('name: agent-mesh-routing'));
  it('has archetype', () => expect(md).toContain('archetype: infrastructure'));
  it('has create-table action', () => expect(md).toContain('create-table'));
  it('has evaluate-route action', () => expect(md).toContain('evaluate-route'));
});

describe('Batch 148 — Mesh Routing barrel export', () => {
  const idx = readFile('packages/shared/src/index.ts');
  it('exports agent-mesh-routing', () => expect(idx).toContain("from './agent-mesh-routing.js'"));
});

/* ══════════════════════════════════════════════════════════════════
   BATCH 149 — Agent Hot Patching
   ══════════════════════════════════════════════════════════════════ */

describe('Batch 149 — Hot Patching migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617860000_agent_hot_patching.sql');
  it('creates agent_patches', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_patches'));
  it('creates patch_chains', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS patch_chains'));
  it('creates patch_audit_log', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS patch_audit_log'));
  it('has target column', () => expect(sql).toContain('target'));
  it('has operation column', () => expect(sql).toContain('operation'));
  it('creates indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 149 — Hot Patching types', () => {
  const src = readFile('packages/shared/src/agent-hot-patching.ts');
  it('exports PatchTarget', () => expect(src).toContain('PatchTarget'));
  it('exports PatchOp', () => expect(src).toContain('PatchOp'));
  it('exports PatchChainStatus', () => expect(src).toContain('PatchChainStatus'));
  it('exports AgentPatch interface', () => expect(src).toContain('interface AgentPatch'));
  it('exports PatchChain interface', () => expect(src).toContain('interface PatchChain'));
  it('exports PatchAuditEntry interface', () => expect(src).toContain('interface PatchAuditEntry'));
  it('exports HotPatchingStats interface', () => expect(src).toContain('interface HotPatchingStats'));
  it('has prompt target', () => expect(src).toContain("'prompt'"));
  it('has merge operation', () => expect(src).toContain("'merge'"));
});

describe('Batch 149 — Hot Patching skill', () => {
  const md = readFile('skills/agent-hot-patching/SKILL.md');
  it('file exists', () => expect(fileExists('skills/agent-hot-patching/SKILL.md')).toBe(true));
  it('has name field', () => expect(md).toContain('name: agent-hot-patching'));
  it('has archetype', () => expect(md).toContain('archetype: operations'));
  it('has apply-patch action', () => expect(md).toContain('apply-patch'));
  it('has rollback-patch action', () => expect(md).toContain('rollback-patch'));
});

describe('Batch 149 — Hot Patching barrel export', () => {
  const idx = readFile('packages/shared/src/index.ts');
  it('exports agent-hot-patching', () => expect(idx).toContain("from './agent-hot-patching.js'"));
});

/* ══════════════════════════════════════════════════════════════════
   BATCH 150 — Agent Inventory Tracking
   ══════════════════════════════════════════════════════════════════ */

describe('Batch 150 — Inventory Tracking migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617870000_agent_inventory_tracking.sql');
  it('creates agent_inventories', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_inventories'));
  it('creates inventory_transactions', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS inventory_transactions'));
  it('creates inventory_reservations', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS inventory_reservations'));
  it('has slot column', () => expect(sql).toContain('slot'));
  it('has quantity column', () => expect(sql).toContain('quantity'));
  it('creates indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 150 — Inventory Tracking types', () => {
  const src = readFile('packages/shared/src/agent-inventory-tracking.ts');
  it('exports InventorySlot', () => expect(src).toContain('InventorySlot'));
  it('exports InventoryTxType', () => expect(src).toContain('InventoryTxType'));
  it('exports ReservationStatus', () => expect(src).toContain('ReservationStatus'));
  it('exports AgentInventoryItem interface', () => expect(src).toContain('interface AgentInventoryItem'));
  it('exports InventoryTransaction interface', () => expect(src).toContain('interface InventoryTransaction'));
  it('exports InventoryReservation interface', () => expect(src).toContain('interface InventoryReservation'));
  it('exports InventoryTrackingStats interface', () => expect(src).toContain('interface InventoryTrackingStats'));
  it('has skill slot', () => expect(src).toContain("'skill'"));
  it('has artifact slot', () => expect(src).toContain("'artifact'"));
});

describe('Batch 150 — Inventory Tracking skill', () => {
  const md = readFile('skills/agent-inventory-tracking/SKILL.md');
  it('file exists', () => expect(fileExists('skills/agent-inventory-tracking/SKILL.md')).toBe(true));
  it('has name field', () => expect(md).toContain('name: agent-inventory-tracking'));
  it('has archetype', () => expect(md).toContain('archetype: analytics'));
  it('has acquire-item action', () => expect(md).toContain('acquire-item'));
  it('has transfer-item action', () => expect(md).toContain('transfer-item'));
});

describe('Batch 150 — Inventory Tracking barrel export', () => {
  const idx = readFile('packages/shared/src/index.ts');
  it('exports agent-inventory-tracking', () => expect(idx).toContain("from './agent-inventory-tracking.js'"));
});

/* ══════════════════════════════════════════════════════════════════
   BATCH 151 — Agent Service Discovery
   ══════════════════════════════════════════════════════════════════ */

describe('Batch 151 — Service Discovery migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617880000_agent_service_discovery.sql');
  it('creates service_registry', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_registry'));
  it('creates discovery_probes', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS discovery_probes'));
  it('creates service_dependencies', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_dependencies'));
  it('has service_type column', () => expect(sql).toContain('service_type'));
  it('has healthy column', () => expect(sql).toContain('healthy'));
  it('creates indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 151 — Service Discovery types', () => {
  const src = readFile('packages/shared/src/agent-service-discovery.ts');
  it('exports ServiceType', () => expect(src).toContain('ServiceType'));
  it('exports ProbeType', () => expect(src).toContain('ProbeType'));
  it('exports ProbeResult', () => expect(src).toContain('ProbeResult'));
  it('exports ServiceRegistryEntry interface', () => expect(src).toContain('interface ServiceRegistryEntry'));
  it('exports DiscoveryProbe interface', () => expect(src).toContain('interface DiscoveryProbe'));
  it('exports ServiceDependency interface', () => expect(src).toContain('interface ServiceDependency'));
  it('exports ServiceDiscoveryStats interface', () => expect(src).toContain('interface ServiceDiscoveryStats'));
  it('has rpc service type', () => expect(src).toContain("'rpc'"));
  it('has latency probe', () => expect(src).toContain("'latency'"));
});

describe('Batch 151 — Service Discovery skill', () => {
  const md = readFile('skills/agent-service-discovery/SKILL.md');
  it('file exists', () => expect(fileExists('skills/agent-service-discovery/SKILL.md')).toBe(true));
  it('has name field', () => expect(md).toContain('name: agent-service-discovery'));
  it('has archetype', () => expect(md).toContain('archetype: infrastructure'));
  it('has register-service action', () => expect(md).toContain('register-service'));
  it('has dependency-map action', () => expect(md).toContain('dependency-map'));
});

describe('Batch 151 — Service Discovery barrel export', () => {
  const idx = readFile('packages/shared/src/index.ts');
  it('exports agent-service-discovery', () => expect(idx).toContain("from './agent-service-discovery.js'"));
});

/* ══════════════════════════════════════════════════════════════════
   BATCH 152 — Agent Federation Protocol
   ══════════════════════════════════════════════════════════════════ */

describe('Batch 152 — Federation Protocol migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617890000_agent_federation_protocol.sql');
  it('creates federation_peers', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_peers'));
  it('creates federation_links', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_links'));
  it('creates federation_messages', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_messages'));
  it('has auth_method column', () => expect(sql).toContain('auth_method'));
  it('has trust_level column', () => expect(sql).toContain('trust_level'));
  it('creates indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 152 — Federation Protocol types', () => {
  const src = readFile('packages/shared/src/agent-federation-protocol.ts');
  it('exports FederationAuthMethod', () => expect(src).toContain('FederationAuthMethod'));
  it('exports FederationPeerStatus', () => expect(src).toContain('FederationPeerStatus'));
  it('exports FederationLinkType', () => expect(src).toContain('FederationLinkType'));
  it('exports FederationMsgType', () => expect(src).toContain('FederationMsgType'));
  it('exports FederationPeer interface', () => expect(src).toContain('interface FederationPeer'));
  it('exports FederationLink interface', () => expect(src).toContain('interface FederationLink'));
  it('exports FederationMessage interface', () => expect(src).toContain('interface FederationMessage'));
  it('exports FederationProtocolStats interface', () => expect(src).toContain('interface FederationProtocolStats'));
  it('has mtls auth', () => expect(src).toContain("'mtls'"));
  it('has mirroring link type', () => expect(src).toContain("'mirroring'"));
});

describe('Batch 152 — Federation Protocol skill', () => {
  const md = readFile('skills/agent-federation-protocol/SKILL.md');
  it('file exists', () => expect(fileExists('skills/agent-federation-protocol/SKILL.md')).toBe(true));
  it('has name field', () => expect(md).toContain('name: agent-federation-protocol'));
  it('has archetype', () => expect(md).toContain('archetype: infrastructure'));
  it('has register-peer action', () => expect(md).toContain('register-peer'));
  it('has send-message action', () => expect(md).toContain('send-message'));
});

describe('Batch 152 — Federation Protocol barrel export', () => {
  const idx = readFile('packages/shared/src/index.ts');
  it('exports agent-federation-protocol', () => expect(idx).toContain("from './agent-federation-protocol.js'"));
});

/* ══════════════════════════════════════════════════════════════════
   EIDOLON WIRING
   ══════════════════════════════════════════════════════════════════ */

describe('Eidolon BuildingKind — Batches 148-152', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  it('has mesh_router BK', () => expect(types).toContain("'mesh_router'"));
  it('has patch_workshop BK', () => expect(types).toContain("'patch_workshop'"));
  it('has inventory_vault BK', () => expect(types).toContain("'inventory_vault'"));
  it('has discovery_beacon BK', () => expect(types).toContain("'discovery_beacon'"));
  it('has federation_hub BK', () => expect(types).toContain("'federation_hub'"));
});

describe('Eidolon EventKind — Batches 148-152', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  it('has meshroute.table_created', () => expect(types).toContain("'meshroute.table_created'"));
  it('has meshroute.route_added', () => expect(types).toContain("'meshroute.route_added'"));
  it('has meshroute.route_evaluated', () => expect(types).toContain("'meshroute.route_evaluated'"));
  it('has meshroute.health_updated', () => expect(types).toContain("'meshroute.health_updated'"));
  it('has hotpatch.patch_created', () => expect(types).toContain("'hotpatch.patch_created'"));
  it('has hotpatch.patch_applied', () => expect(types).toContain("'hotpatch.patch_applied'"));
  it('has hotpatch.patch_rolled_back', () => expect(types).toContain("'hotpatch.patch_rolled_back'"));
  it('has hotpatch.chain_executed', () => expect(types).toContain("'hotpatch.chain_executed'"));
  it('has inventory.item_acquired', () => expect(types).toContain("'inventory.item_acquired'"));
  it('has inventory.item_consumed', () => expect(types).toContain("'inventory.item_consumed'"));
  it('has inventory.item_transferred', () => expect(types).toContain("'inventory.item_transferred'"));
  it('has inventory.reservation_created', () => expect(types).toContain("'inventory.reservation_created'"));
  it('has discovery.service_registered', () => expect(types).toContain("'discovery.service_registered'"));
  it('has discovery.probe_completed', () => expect(types).toContain("'discovery.probe_completed'"));
  it('has discovery.service_unhealthy', () => expect(types).toContain("'discovery.service_unhealthy'"));
  it('has discovery.dependency_mapped', () => expect(types).toContain("'discovery.dependency_mapped'"));
  it('has federation.peer_registered', () => expect(types).toContain("'federation.peer_registered'"));
  it('has federation.link_created', () => expect(types).toContain("'federation.link_created'"));
  it('has federation.message_sent', () => expect(types).toContain("'federation.message_sent'"));
  it('has federation.state_synced', () => expect(types).toContain("'federation.state_synced'"));
});

describe('Eidolon districtFor — Batches 148-152', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  it('maps mesh_router to civic', () => expect(types).toContain("case 'mesh_router':"));
  it('maps patch_workshop to civic', () => expect(types).toContain("case 'patch_workshop':"));
  it('maps inventory_vault to market', () => expect(types).toContain("case 'inventory_vault':"));
  it('maps discovery_beacon to civic', () => expect(types).toContain("case 'discovery_beacon':"));
  it('maps federation_hub to civic', () => expect(types).toContain("case 'federation_hub':"));
});

/* ══════════════════════════════════════════════════════════════════
   EVENT BUS WIRING
   ══════════════════════════════════════════════════════════════════ */

describe('Event Bus SUBJECT_MAP — Batches 148-152', () => {
  const eb = readFile('services/sven-eidolon/src/event-bus.ts');
  it('has sven.meshroute.table_created', () => expect(eb).toContain("'sven.meshroute.table_created'"));
  it('has sven.meshroute.route_added', () => expect(eb).toContain("'sven.meshroute.route_added'"));
  it('has sven.meshroute.route_evaluated', () => expect(eb).toContain("'sven.meshroute.route_evaluated'"));
  it('has sven.meshroute.health_updated', () => expect(eb).toContain("'sven.meshroute.health_updated'"));
  it('has sven.hotpatch.patch_created', () => expect(eb).toContain("'sven.hotpatch.patch_created'"));
  it('has sven.hotpatch.patch_applied', () => expect(eb).toContain("'sven.hotpatch.patch_applied'"));
  it('has sven.hotpatch.patch_rolled_back', () => expect(eb).toContain("'sven.hotpatch.patch_rolled_back'"));
  it('has sven.hotpatch.chain_executed', () => expect(eb).toContain("'sven.hotpatch.chain_executed'"));
  it('has sven.inventory.item_acquired', () => expect(eb).toContain("'sven.inventory.item_acquired'"));
  it('has sven.inventory.item_consumed', () => expect(eb).toContain("'sven.inventory.item_consumed'"));
  it('has sven.inventory.item_transferred', () => expect(eb).toContain("'sven.inventory.item_transferred'"));
  it('has sven.inventory.reservation_created', () => expect(eb).toContain("'sven.inventory.reservation_created'"));
  it('has sven.discovery.service_registered', () => expect(eb).toContain("'sven.discovery.service_registered'"));
  it('has sven.discovery.probe_completed', () => expect(eb).toContain("'sven.discovery.probe_completed'"));
  it('has sven.discovery.service_unhealthy', () => expect(eb).toContain("'sven.discovery.service_unhealthy'"));
  it('has sven.discovery.dependency_mapped', () => expect(eb).toContain("'sven.discovery.dependency_mapped'"));
  it('has sven.federation.peer_registered', () => expect(eb).toContain("'sven.federation.peer_registered'"));
  it('has sven.federation.link_created', () => expect(eb).toContain("'sven.federation.link_created'"));
  it('has sven.federation.message_sent', () => expect(eb).toContain("'sven.federation.message_sent'"));
  it('has sven.federation.state_synced', () => expect(eb).toContain("'sven.federation.state_synced'"));
});

/* ══════════════════════════════════════════════════════════════════
   TASK EXECUTOR WIRING
   ══════════════════════════════════════════════════════════════════ */

describe('Task Executor switch cases — Batches 148-152', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');
  const cases = [
    'meshroute_create_table', 'meshroute_add_entry', 'meshroute_route',
    'meshroute_health_check', 'meshroute_list', 'meshroute_report',
    'hotpatch_create', 'hotpatch_apply', 'hotpatch_rollback',
    'hotpatch_chain', 'hotpatch_list', 'hotpatch_report',
    'inventory_acquire', 'inventory_consume', 'inventory_transfer',
    'inventory_reserve', 'inventory_list', 'inventory_report',
    'discovery_register', 'discovery_probe', 'discovery_unregister',
    'discovery_map_deps', 'discovery_list', 'discovery_report',
    'federation_connect', 'federation_link', 'federation_send',
    'federation_sync', 'federation_list', 'federation_report',
  ];
  for (const c of cases) {
    it(`has case '${c}'`, () => expect(te).toContain(`case '${c}'`));
  }
});

describe('Task Executor handlers — Batches 148-152', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');
  const handlers = [
    'handleMeshrouteCreateTable', 'handleMeshrouteAddEntry', 'handleMeshrouteRoute',
    'handleMeshrouteHealthCheck', 'handleMeshrouteList', 'handleMeshrouteReport',
    'handleHotpatchCreate', 'handleHotpatchApply', 'handleHotpatchRollback',
    'handleHotpatchChain', 'handleHotpatchList', 'handleHotpatchReport',
    'handleInventoryAcquire', 'handleInventoryConsume', 'handleInventoryTransfer',
    'handleInventoryReserve', 'handleInventoryList', 'handleInventoryReport',
    'handleDiscoveryRegister', 'handleDiscoveryProbe', 'handleDiscoveryUnregister',
    'handleDiscoveryMapDeps', 'handleDiscoveryList', 'handleDiscoveryReport',
    'handleFederationConnect', 'handleFederationLink', 'handleFederationSend',
    'handleFederationSync', 'handleFederationList', 'handleFederationReport',
  ];
  for (const h of handlers) {
    it(`has ${h}()`, () => expect(te).toContain(`${h}(task`));
  }
});

/* ══════════════════════════════════════════════════════════════════
   .gitattributes
   ══════════════════════════════════════════════════════════════════ */

describe('.gitattributes — Batches 148-152', () => {
  const ga = readFile('.gitattributes');
  it('has mesh-routing migration', () => expect(ga).toContain('20260617850000_agent_mesh_routing.sql'));
  it('has hot-patching migration', () => expect(ga).toContain('20260617860000_agent_hot_patching.sql'));
  it('has inventory-tracking migration', () => expect(ga).toContain('20260617870000_agent_inventory_tracking.sql'));
  it('has service-discovery migration', () => expect(ga).toContain('20260617880000_agent_service_discovery.sql'));
  it('has federation-protocol migration', () => expect(ga).toContain('20260617890000_agent_federation_protocol.sql'));
  it('has mesh-routing types', () => expect(ga).toContain('agent-mesh-routing.ts'));
  it('has hot-patching types', () => expect(ga).toContain('agent-hot-patching.ts'));
  it('has inventory-tracking types', () => expect(ga).toContain('agent-inventory-tracking.ts'));
  it('has service-discovery types', () => expect(ga).toContain('agent-service-discovery.ts'));
  it('has federation-protocol types', () => expect(ga).toContain('agent-federation-protocol.ts'));
  it('has mesh-routing skill', () => expect(ga).toContain('skills/agent-mesh-routing/SKILL.md'));
  it('has hot-patching skill', () => expect(ga).toContain('skills/agent-hot-patching/SKILL.md'));
  it('has inventory-tracking skill', () => expect(ga).toContain('skills/agent-inventory-tracking/SKILL.md'));
  it('has service-discovery skill', () => expect(ga).toContain('skills/agent-service-discovery/SKILL.md'));
  it('has federation-protocol skill', () => expect(ga).toContain('skills/agent-federation-protocol/SKILL.md'));
});
