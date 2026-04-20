import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ─── Batch 143: Agent Dependency Graph ───
describe('Batch 143 — Agent Dependency Graph', () => {
  const migrationPath = 'services/gateway-api/migrations/20260617800000_agent_dependency_graph.sql';
  const typesPath = 'packages/shared/src/agent-dependency-graph.ts';
  const skillPath = 'skills/agent-dependency-graph/SKILL.md';

  describe('Migration', () => {
    const sql = readFile(migrationPath);
    it('creates dependency_graphs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS dependency_graphs'));
    it('creates dependency_nodes table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS dependency_nodes'));
    it('creates dependency_edges table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS dependency_edges'));
    it('has graph_id column on nodes', () => expect(sql).toContain('graph_id'));
    it('has source/target on edges', () => { expect(sql).toContain('source_node_id'); expect(sql).toContain('target_node_id'); });
    it('has indexes', () => expect((sql.match(/CREATE INDEX/gi) || []).length).toBeGreaterThanOrEqual(4));
  });

  describe('Shared types', () => {
    const src = readFile(typesPath);
    it('exports DepGraphKind', () => expect(src).toContain('DepGraphKind'));
    it('exports DepNodeType', () => expect(src).toContain('DepNodeType'));
    it('exports DepEdgeType', () => expect(src).toContain('DepEdgeType'));
    it('exports DependencyGraph interface', () => expect(src).toContain('DependencyGraph'));
    it('exports DependencyNode interface', () => expect(src).toContain('DependencyNode'));
    it('exports DependencyEdge interface', () => expect(src).toContain('DependencyEdge'));
    it('exports DependencyGraphStats', () => expect(src).toContain('DependencyGraphStats'));
  });

  describe('Skill', () => {
    it('SKILL.md exists', () => expect(fileExists(skillPath)).toBe(true));
    const md = readFile(skillPath);
    it('has name field', () => expect(md).toContain('name:'));
    it('has actions', () => expect(md).toContain('actions:'));
    it('has pricing', () => expect(md).toContain('pricing:'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-dependency-graph', () => expect(idx).toContain("'./agent-dependency-graph.js'"));
  });
});

// ─── Batch 144: Agent Blueprint System ───
describe('Batch 144 — Agent Blueprint System', () => {
  const migrationPath = 'services/gateway-api/migrations/20260617810000_agent_blueprint_system.sql';
  const typesPath = 'packages/shared/src/agent-blueprint-system.ts';
  const skillPath = 'skills/agent-blueprint-system/SKILL.md';

  describe('Migration', () => {
    const sql = readFile(migrationPath);
    it('creates system_blueprints table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS system_blueprints'));
    it('creates blueprint_components table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS blueprint_components'));
    it('creates blueprint_instances table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS blueprint_instances'));
    it('has scope column', () => expect(sql).toContain('scope'));
    it('has status column', () => expect(sql).toContain('status'));
    it('has indexes', () => expect((sql.match(/CREATE INDEX/gi) || []).length).toBeGreaterThanOrEqual(4));
  });

  describe('Shared types', () => {
    const src = readFile(typesPath);
    it('exports BlueprintScope', () => expect(src).toContain('BlueprintScope'));
    it('exports BlueprintStatus', () => expect(src).toContain('BlueprintStatus'));
    it('exports ComponentSlot', () => expect(src).toContain('ComponentSlot'));
    it('exports SystemBlueprint interface', () => expect(src).toContain('SystemBlueprint'));
    it('exports BlueprintComponent interface', () => expect(src).toContain('BlueprintComponent'));
    it('exports BlueprintInstance interface', () => expect(src).toContain('BlueprintInstance'));
    it('exports BlueprintSystemStats', () => expect(src).toContain('BlueprintSystemStats'));
  });

  describe('Skill', () => {
    it('SKILL.md exists', () => expect(fileExists(skillPath)).toBe(true));
    const md = readFile(skillPath);
    it('has name field', () => expect(md).toContain('name:'));
    it('has archetype', () => expect(md).toContain('archetype:'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-blueprint-system', () => expect(idx).toContain("'./agent-blueprint-system.js'"));
  });
});

// ─── Batch 145: Agent Signal Dispatch ───
describe('Batch 145 — Agent Signal Dispatch', () => {
  const migrationPath = 'services/gateway-api/migrations/20260617820000_agent_signal_dispatch.sql';
  const typesPath = 'packages/shared/src/agent-signal-dispatch.ts';
  const skillPath = 'skills/agent-signal-dispatch/SKILL.md';

  describe('Migration', () => {
    const sql = readFile(migrationPath);
    it('creates agent_signals table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_signals'));
    it('creates signal_subscriptions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS signal_subscriptions'));
    it('creates signal_deliveries table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS signal_deliveries'));
    it('has priority column', () => expect(sql).toContain('priority'));
    it('has dispatch_mode', () => expect(sql).toContain('dispatch_mode'));
    it('has indexes', () => expect((sql.match(/CREATE INDEX/gi) || []).length).toBeGreaterThanOrEqual(4));
  });

  describe('Shared types', () => {
    const src = readFile(typesPath);
    it('exports SignalKind', () => expect(src).toContain('SignalKind'));
    it('exports SignalPriority', () => expect(src).toContain('SignalPriority'));
    it('exports DispatchMode', () => expect(src).toContain('DispatchMode'));
    it('exports DeliveryStatus', () => expect(src).toContain('DeliveryStatus'));
    it('exports AgentSignal interface', () => expect(src).toContain('AgentSignal'));
    it('exports SignalSubscription interface', () => expect(src).toContain('SignalSubscription'));
    it('exports SignalDelivery interface', () => expect(src).toContain('SignalDelivery'));
    it('exports SignalDispatchStats', () => expect(src).toContain('SignalDispatchStats'));
  });

  describe('Skill', () => {
    it('SKILL.md exists', () => expect(fileExists(skillPath)).toBe(true));
    const md = readFile(skillPath);
    it('has name field', () => expect(md).toContain('name:'));
    it('has pricing', () => expect(md).toContain('pricing:'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-signal-dispatch', () => expect(idx).toContain("'./agent-signal-dispatch.js'"));
  });
});

// ─── Batch 146: Agent Throttle Control ───
describe('Batch 146 — Agent Throttle Control', () => {
  const migrationPath = 'services/gateway-api/migrations/20260617830000_agent_throttle_control.sql';
  const typesPath = 'packages/shared/src/agent-throttle-control.ts';
  const skillPath = 'skills/agent-throttle-control/SKILL.md';

  describe('Migration', () => {
    const sql = readFile(migrationPath);
    it('creates throttle_rules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS throttle_rules'));
    it('creates throttle_events table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS throttle_events'));
    it('creates throttle_counters table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS throttle_counters'));
    it('has scope column', () => expect(sql).toContain('scope'));
    it('has mode column', () => expect(sql).toContain('mode'));
    it('has indexes', () => expect((sql.match(/CREATE INDEX/gi) || []).length).toBeGreaterThanOrEqual(4));
  });

  describe('Shared types', () => {
    const src = readFile(typesPath);
    it('exports ThrottleScope', () => expect(src).toContain('ThrottleScope'));
    it('exports ThrottleMode', () => expect(src).toContain('ThrottleMode'));
    it('exports ThrottleAction', () => expect(src).toContain('ThrottleAction'));
    it('exports ThrottleRule interface', () => expect(src).toContain('ThrottleRule'));
    it('exports ThrottleEvent interface', () => expect(src).toContain('ThrottleEvent'));
    it('exports ThrottleCounter interface', () => expect(src).toContain('ThrottleCounter'));
    it('exports ThrottleControlStats', () => expect(src).toContain('ThrottleControlStats'));
  });

  describe('Skill', () => {
    it('SKILL.md exists', () => expect(fileExists(skillPath)).toBe(true));
    const md = readFile(skillPath);
    it('has name field', () => expect(md).toContain('name:'));
    it('has archetype', () => expect(md).toContain('archetype:'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-throttle-control', () => expect(idx).toContain("'./agent-throttle-control.js'"));
  });
});

// ─── Batch 147: Agent State Sync ───
describe('Batch 147 — Agent State Sync', () => {
  const migrationPath = 'services/gateway-api/migrations/20260617840000_agent_state_sync.sql';
  const typesPath = 'packages/shared/src/agent-state-sync.ts';
  const skillPath = 'skills/agent-state-sync/SKILL.md';

  describe('Migration', () => {
    const sql = readFile(migrationPath);
    it('creates sync_peers table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS sync_peers'));
    it('creates sync_states table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS sync_states'));
    it('creates sync_operations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS sync_operations'));
    it('has direction column', () => expect(sql).toContain('direction'));
    it('has conflict_policy', () => expect(sql).toContain('conflict_policy'));
    it('has indexes', () => expect((sql.match(/CREATE INDEX/gi) || []).length).toBeGreaterThanOrEqual(4));
  });

  describe('Shared types', () => {
    const src = readFile(typesPath);
    it('exports SyncDirection', () => expect(src).toContain('SyncDirection'));
    it('exports ConflictPolicy', () => expect(src).toContain('ConflictPolicy'));
    it('exports SyncOperation', () => expect(src).toContain('SyncOperation'));
    it('exports SyncOpStatus', () => expect(src).toContain('SyncOpStatus'));
    it('exports SyncPeer interface', () => expect(src).toContain('SyncPeer'));
    it('exports SyncState interface', () => expect(src).toContain('SyncState'));
    it('exports SyncOperationRecord', () => expect(src).toContain('SyncOperationRecord'));
    it('exports StateSyncStats', () => expect(src).toContain('StateSyncStats'));
  });

  describe('Skill', () => {
    it('SKILL.md exists', () => expect(fileExists(skillPath)).toBe(true));
    const md = readFile(skillPath);
    it('has name field', () => expect(md).toContain('name:'));
    it('has pricing', () => expect(md).toContain('pricing:'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-state-sync', () => expect(idx).toContain("'./agent-state-sync.js'"));
  });
});

// ─── Eidolon Integration ───
describe('Eidolon Integration — Batches 143-147', () => {
  const typesTs = readFile('services/sven-eidolon/src/types.ts');

  describe('BuildingKind', () => {
    it('has dep_graph_lab', () => expect(typesTs).toContain("'dep_graph_lab'"));
    it('has blueprint_forge', () => expect(typesTs).toContain("'blueprint_forge'"));
    it('has signal_tower', () => expect(typesTs).toContain("'signal_tower'"));
    it('has throttle_station', () => expect(typesTs).toContain("'throttle_station'"));
    it('has sync_bridge', () => expect(typesTs).toContain("'sync_bridge'"));
  });

  describe('EventKind', () => {
    it('has depgraph.graph_created', () => expect(typesTs).toContain("'depgraph.graph_created'"));
    it('has depgraph.node_added', () => expect(typesTs).toContain("'depgraph.node_added'"));
    it('has depgraph.edge_added', () => expect(typesTs).toContain("'depgraph.edge_added'"));
    it('has depgraph.analysis_completed', () => expect(typesTs).toContain("'depgraph.analysis_completed'"));
    it('has blueprint.created', () => expect(typesTs).toContain("'blueprint.created'"));
    it('has blueprint.validated', () => expect(typesTs).toContain("'blueprint.validated'"));
    it('has blueprint.instantiated', () => expect(typesTs).toContain("'blueprint.instantiated'"));
    it('has blueprint.deprecated', () => expect(typesTs).toContain("'blueprint.deprecated'"));
    it('has signal.sent', () => expect(typesTs).toContain("'signal.sent'"));
    it('has signal.delivered', () => expect(typesTs).toContain("'signal.delivered'"));
    it('has signal.acknowledged', () => expect(typesTs).toContain("'signal.acknowledged'"));
    it('has signal.expired', () => expect(typesTs).toContain("'signal.expired'"));
    it('has throttle.rule_created', () => expect(typesTs).toContain("'throttle.rule_created'"));
    it('has throttle.request_throttled', () => expect(typesTs).toContain("'throttle.request_throttled'"));
    it('has throttle.circuit_opened', () => expect(typesTs).toContain("'throttle.circuit_opened'"));
    it('has throttle.circuit_closed', () => expect(typesTs).toContain("'throttle.circuit_closed'"));
    it('has statesync.peer_created', () => expect(typesTs).toContain("'statesync.peer_created'"));
    it('has statesync.state_pushed', () => expect(typesTs).toContain("'statesync.state_pushed'"));
    it('has statesync.state_pulled', () => expect(typesTs).toContain("'statesync.state_pulled'"));
    it('has statesync.conflict_resolved', () => expect(typesTs).toContain("'statesync.conflict_resolved'"));
  });

  describe('districtFor', () => {
    it('maps dep_graph_lab to civic', () => expect(typesTs).toContain("case 'dep_graph_lab':"));
    it('maps blueprint_forge to civic', () => expect(typesTs).toContain("case 'blueprint_forge':"));
    it('maps signal_tower to civic', () => expect(typesTs).toContain("case 'signal_tower':"));
    it('maps throttle_station to civic', () => expect(typesTs).toContain("case 'throttle_station':"));
    it('maps sync_bridge to civic', () => expect(typesTs).toContain("case 'sync_bridge':"));
  });
});

// ─── Event Bus ───
describe('Event Bus — Batches 143-147', () => {
  const eventBus = readFile('services/sven-eidolon/src/event-bus.ts');

  it('has sven.depgraph.graph_created', () => expect(eventBus).toContain("'sven.depgraph.graph_created'"));
  it('has sven.depgraph.node_added', () => expect(eventBus).toContain("'sven.depgraph.node_added'"));
  it('has sven.depgraph.edge_added', () => expect(eventBus).toContain("'sven.depgraph.edge_added'"));
  it('has sven.depgraph.analysis_completed', () => expect(eventBus).toContain("'sven.depgraph.analysis_completed'"));
  it('has sven.blueprint.created', () => expect(eventBus).toContain("'sven.blueprint.created'"));
  it('has sven.blueprint.validated', () => expect(eventBus).toContain("'sven.blueprint.validated'"));
  it('has sven.blueprint.instantiated', () => expect(eventBus).toContain("'sven.blueprint.instantiated'"));
  it('has sven.blueprint.deprecated', () => expect(eventBus).toContain("'sven.blueprint.deprecated'"));
  it('has sven.signal.sent', () => expect(eventBus).toContain("'sven.signal.sent'"));
  it('has sven.signal.delivered', () => expect(eventBus).toContain("'sven.signal.delivered'"));
  it('has sven.signal.acknowledged', () => expect(eventBus).toContain("'sven.signal.acknowledged'"));
  it('has sven.signal.expired', () => expect(eventBus).toContain("'sven.signal.expired'"));
  it('has sven.throttle.rule_created', () => expect(eventBus).toContain("'sven.throttle.rule_created'"));
  it('has sven.throttle.request_throttled', () => expect(eventBus).toContain("'sven.throttle.request_throttled'"));
  it('has sven.throttle.circuit_opened', () => expect(eventBus).toContain("'sven.throttle.circuit_opened'"));
  it('has sven.throttle.circuit_closed', () => expect(eventBus).toContain("'sven.throttle.circuit_closed'"));
  it('has sven.statesync.peer_created', () => expect(eventBus).toContain("'sven.statesync.peer_created'"));
  it('has sven.statesync.state_pushed', () => expect(eventBus).toContain("'sven.statesync.state_pushed'"));
  it('has sven.statesync.state_pulled', () => expect(eventBus).toContain("'sven.statesync.state_pulled'"));
  it('has sven.statesync.conflict_resolved', () => expect(eventBus).toContain("'sven.statesync.conflict_resolved'"));
});

// ─── Task Executor ───
describe('Task Executor — Batches 143-147', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');

  describe('Dependency Graph handlers', () => {
    it('has depgraph_create case', () => expect(te).toContain("case 'depgraph_create'"));
    it('has depgraph_add_node case', () => expect(te).toContain("case 'depgraph_add_node'"));
    it('has depgraph_add_edge case', () => expect(te).toContain("case 'depgraph_add_edge'"));
    it('has depgraph_analyse case', () => expect(te).toContain("case 'depgraph_analyse'"));
    it('has depgraph_list case', () => expect(te).toContain("case 'depgraph_list'"));
    it('has depgraph_report case', () => expect(te).toContain("case 'depgraph_report'"));
  });

  describe('Blueprint System handlers', () => {
    it('has blueprint_create case', () => expect(te).toContain("case 'blueprint_create'"));
    it('has blueprint_add_component case', () => expect(te).toContain("case 'blueprint_add_component'"));
    it('has blueprint_validate case', () => expect(te).toContain("case 'blueprint_validate'"));
    it('has blueprint_instantiate case', () => expect(te).toContain("case 'blueprint_instantiate'"));
    it('has blueprint_list case', () => expect(te).toContain("case 'blueprint_list'"));
    it('has blueprint_report case', () => expect(te).toContain("case 'blueprint_report'"));
  });

  describe('Signal Dispatch handlers', () => {
    it('has signal_send case', () => expect(te).toContain("case 'signal_send'"));
    it('has signal_subscribe case', () => expect(te).toContain("case 'signal_subscribe'"));
    it('has signal_broadcast case', () => expect(te).toContain("case 'signal_broadcast'"));
    it('has signal_acknowledge case', () => expect(te).toContain("case 'signal_acknowledge'"));
    it('has signal_list case', () => expect(te).toContain("case 'signal_list'"));
    it('has signal_report case', () => expect(te).toContain("case 'signal_report'"));
  });

  describe('Throttle Control handlers', () => {
    it('has throttle_create_rule case', () => expect(te).toContain("case 'throttle_create_rule'"));
    it('has throttle_check case', () => expect(te).toContain("case 'throttle_check'"));
    it('has throttle_update_rule case', () => expect(te).toContain("case 'throttle_update_rule'"));
    it('has throttle_reset case', () => expect(te).toContain("case 'throttle_reset'"));
    it('has throttle_list case', () => expect(te).toContain("case 'throttle_list'"));
    it('has throttle_report case', () => expect(te).toContain("case 'throttle_report'"));
  });

  describe('State Sync handlers', () => {
    it('has sync_create_peer case', () => expect(te).toContain("case 'sync_create_peer'"));
    it('has sync_push case', () => expect(te).toContain("case 'sync_push'"));
    it('has sync_pull case', () => expect(te).toContain("case 'sync_pull'"));
    it('has sync_resolve case', () => expect(te).toContain("case 'sync_resolve'"));
    it('has sync_list case', () => expect(te).toContain("case 'sync_list'"));
    it('has sync_report case', () => expect(te).toContain("case 'sync_report'"));
  });
});

// ─── .gitattributes ───
describe('.gitattributes — Batches 143-147', () => {
  const ga = readFile('.gitattributes');
  it('has dependency-graph migration', () => expect(ga).toContain('20260617800000_agent_dependency_graph.sql'));
  it('has dependency-graph types', () => expect(ga).toContain('agent-dependency-graph.ts'));
  it('has dependency-graph skill', () => expect(ga).toContain('agent-dependency-graph/SKILL.md'));
  it('has blueprint-system migration', () => expect(ga).toContain('20260617810000_agent_blueprint_system.sql'));
  it('has blueprint-system types', () => expect(ga).toContain('agent-blueprint-system.ts'));
  it('has blueprint-system skill', () => expect(ga).toContain('agent-blueprint-system/SKILL.md'));
  it('has signal-dispatch migration', () => expect(ga).toContain('20260617820000_agent_signal_dispatch.sql'));
  it('has signal-dispatch types', () => expect(ga).toContain('agent-signal-dispatch.ts'));
  it('has signal-dispatch skill', () => expect(ga).toContain('agent-signal-dispatch/SKILL.md'));
  it('has throttle-control migration', () => expect(ga).toContain('20260617830000_agent_throttle_control.sql'));
  it('has throttle-control types', () => expect(ga).toContain('agent-throttle-control.ts'));
  it('has throttle-control skill', () => expect(ga).toContain('agent-throttle-control/SKILL.md'));
  it('has state-sync migration', () => expect(ga).toContain('20260617840000_agent_state_sync.sql'));
  it('has state-sync types', () => expect(ga).toContain('agent-state-sync.ts'));
  it('has state-sync skill', () => expect(ga).toContain('agent-state-sync/SKILL.md'));
});
