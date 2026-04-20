import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 348-352 — Observability & Infrastructure', () => {
  // ── Batch 348: Log Router ──
  describe('Batch 348: log_router migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260619850000_agent_log_router.sql'), 'utf-8');
    it('creates agent_log_router_configs table', () => { expect(sql).toContain('agent_log_router_configs'); });
    it('creates agent_log_pipelines table', () => { expect(sql).toContain('agent_log_pipelines'); });
    it('creates agent_log_entries table', () => { expect(sql).toContain('agent_log_entries'); });
    it('has agent_id column', () => { expect(sql).toContain('agent_id'); });
    it('has sampling_rate column', () => { expect(sql).toContain('sampling_rate'); });
    it('has indexes', () => { expect(sql).toContain('idx_log_router_configs_agent'); });
  });

  describe('Batch 348: log_router types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-log-router.ts'), 'utf-8');
    it('exports LogLevel type', () => { expect(ts).toContain('LogLevel'); });
    it('exports PipelineStatus type', () => { expect(ts).toContain('PipelineStatus'); });
    it('exports LogDestination type', () => { expect(ts).toContain('LogDestination'); });
    it('exports SamplingMode type', () => { expect(ts).toContain('SamplingMode'); });
    it('exports LogRouterConfig interface', () => { expect(ts).toContain('LogRouterConfig'); });
    it('exports LogPipeline interface', () => { expect(ts).toContain('LogPipeline'); });
    it('exports LogEntry interface', () => { expect(ts).toContain('LogEntry'); });
  });

  describe('Batch 348: log_router SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/log-router/SKILL.md'), 'utf-8');
    it('has name field', () => { expect(md).toContain('name: log-router'); });
    it('has price', () => { expect(md).toContain('11.99'); });
    it('has Actions heading', () => { expect(md).toContain('## Actions'); });
    it('has create-pipeline action', () => { expect(md).toContain('create-pipeline'); });
    it('has route-logs action', () => { expect(md).toContain('route-logs'); });
  });

  describe('Batch 348: log_router wiring', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const eventBus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const executor = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has BK value', () => { expect(types).toContain("'log_router'"); });
    it('has EK lgrt.pipeline_created', () => { expect(types).toContain("'lgrt.pipeline_created'"); });
    it('has EK lgrt.logs_routed', () => { expect(types).toContain("'lgrt.logs_routed'"); });
    it('has EK lgrt.filter_applied', () => { expect(types).toContain("'lgrt.filter_applied'"); });
    it('has EK lgrt.pipeline_drained', () => { expect(types).toContain("'lgrt.pipeline_drained'"); });
    it('has SUBJECT_MAP lgrt.pipeline_created', () => { expect(eventBus).toContain("'sven.lgrt.pipeline_created'"); });
    it('has SUBJECT_MAP lgrt.logs_routed', () => { expect(eventBus).toContain("'sven.lgrt.logs_routed'"); });
    it('has SUBJECT_MAP lgrt.filter_applied', () => { expect(eventBus).toContain("'sven.lgrt.filter_applied'"); });
    it('has SUBJECT_MAP lgrt.pipeline_drained', () => { expect(eventBus).toContain("'sven.lgrt.pipeline_drained'"); });
    it('has switch case lgrt_create_pipeline', () => { expect(executor).toContain("case 'lgrt_create_pipeline'"); });
    it('has switch case lgrt_route_logs', () => { expect(executor).toContain("case 'lgrt_route_logs'"); });
    it('has handler handleLgrtCreatePipeline', () => { expect(executor).toContain('handleLgrtCreatePipeline'); });
    it('has handler handleLgrtRouteLogs', () => { expect(executor).toContain('handleLgrtRouteLogs'); });
  });

  // ── Batch 349: Config Sync ──
  describe('Batch 349: config_sync migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260619860000_agent_config_sync.sql'), 'utf-8');
    it('creates agent_config_sync_configs table', () => { expect(sql).toContain('agent_config_sync_configs'); });
    it('creates agent_config_entries table', () => { expect(sql).toContain('agent_config_entries'); });
    it('creates agent_config_history table', () => { expect(sql).toContain('agent_config_history'); });
    it('has conflict_resolution column', () => { expect(sql).toContain('conflict_resolution'); });
    it('has encryption_enabled column', () => { expect(sql).toContain('encryption_enabled'); });
    it('has UNIQUE constraint', () => { expect(sql).toContain('UNIQUE(config_id, key)'); });
  });

  describe('Batch 349: config_sync types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-config-sync.ts'), 'utf-8');
    it('exports SyncStrategy type', () => { expect(ts).toContain('SyncStrategy'); });
    it('exports ConflictResolution type', () => { expect(ts).toContain('ConflictResolution'); });
    it('exports ConfigChangeType type', () => { expect(ts).toContain('ConfigChangeType'); });
    it('exports ConfigSyncConfig interface', () => { expect(ts).toContain('ConfigSyncConfig'); });
    it('exports ConfigEntry interface', () => { expect(ts).toContain('ConfigEntry'); });
    it('exports ConfigHistory interface', () => { expect(ts).toContain('ConfigHistory'); });
  });

  describe('Batch 349: config_sync SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/config-sync/SKILL.md'), 'utf-8');
    it('has name field', () => { expect(md).toContain('name: config-sync'); });
    it('has price', () => { expect(md).toContain('13.99'); });
    it('has Actions heading', () => { expect(md).toContain('## Actions'); });
    it('has sync-namespace action', () => { expect(md).toContain('sync-namespace'); });
    it('has resolve-conflict action', () => { expect(md).toContain('resolve-conflict'); });
  });

  describe('Batch 349: config_sync wiring', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const eventBus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const executor = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has BK value', () => { expect(types).toContain("'config_sync'"); });
    it('has EK cfsn.namespace_synced', () => { expect(types).toContain("'cfsn.namespace_synced'"); });
    it('has EK cfsn.conflict_resolved', () => { expect(types).toContain("'cfsn.conflict_resolved'"); });
    it('has EK cfsn.config_encrypted', () => { expect(types).toContain("'cfsn.config_encrypted'"); });
    it('has EK cfsn.version_rolled_back', () => { expect(types).toContain("'cfsn.version_rolled_back'"); });
    it('has SUBJECT_MAP cfsn.namespace_synced', () => { expect(eventBus).toContain("'sven.cfsn.namespace_synced'"); });
    it('has SUBJECT_MAP cfsn.conflict_resolved', () => { expect(eventBus).toContain("'sven.cfsn.conflict_resolved'"); });
    it('has switch case cfsn_sync_namespace', () => { expect(executor).toContain("case 'cfsn_sync_namespace'"); });
    it('has switch case cfsn_resolve_conflict', () => { expect(executor).toContain("case 'cfsn_resolve_conflict'"); });
    it('has handler handleCfsnSyncNamespace', () => { expect(executor).toContain('handleCfsnSyncNamespace'); });
    it('has handler handleCfsnExportSnapshot', () => { expect(executor).toContain('handleCfsnExportSnapshot'); });
  });

  // ── Batch 350: Health Prober ──
  describe('Batch 350: health_prober migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260619870000_agent_health_prober.sql'), 'utf-8');
    it('creates agent_health_prober_configs table', () => { expect(sql).toContain('agent_health_prober_configs'); });
    it('creates agent_probe_results table', () => { expect(sql).toContain('agent_probe_results'); });
    it('creates agent_probe_alerts table', () => { expect(sql).toContain('agent_probe_alerts'); });
    it('has probe_type column', () => { expect(sql).toContain('probe_type'); });
    it('has failure_threshold column', () => { expect(sql).toContain('failure_threshold'); });
    it('has severity index', () => { expect(sql).toContain('idx_probe_alerts_severity'); });
  });

  describe('Batch 350: health_prober types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-health-prober.ts'), 'utf-8');
    it('exports ProbeType type', () => { expect(ts).toContain('ProbeType'); });
    it('exports ProbeStatus type', () => { expect(ts).toContain('ProbeStatus'); });
    it('exports AlertSeverity type', () => { expect(ts).toContain('AlertSeverity'); });
    it('exports HealthProberConfig interface', () => { expect(ts).toContain('HealthProberConfig'); });
    it('exports ProbeResult interface', () => { expect(ts).toContain('ProbeResult'); });
    it('exports ProbeAlert interface', () => { expect(ts).toContain('ProbeAlert'); });
  });

  describe('Batch 350: health_prober SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/health-prober/SKILL.md'), 'utf-8');
    it('has name field', () => { expect(md).toContain('name: health-prober'); });
    it('has price', () => { expect(md).toContain('9.99'); });
    it('has Actions heading', () => { expect(md).toContain('## Actions'); });
    it('has create-probe action', () => { expect(md).toContain('create-probe'); });
    it('has generate-report action', () => { expect(md).toContain('generate-report'); });
  });

  describe('Batch 350: health_prober wiring', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const eventBus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const executor = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has BK value', () => { expect(types).toContain("'health_prober'"); });
    it('has EK htpr.probe_succeeded', () => { expect(types).toContain("'htpr.probe_succeeded'"); });
    it('has EK htpr.probe_failed', () => { expect(types).toContain("'htpr.probe_failed'"); });
    it('has EK htpr.alert_triggered', () => { expect(types).toContain("'htpr.alert_triggered'"); });
    it('has EK htpr.target_recovered', () => { expect(types).toContain("'htpr.target_recovered'"); });
    it('has SUBJECT_MAP htpr.probe_succeeded', () => { expect(eventBus).toContain("'sven.htpr.probe_succeeded'"); });
    it('has SUBJECT_MAP htpr.alert_triggered', () => { expect(eventBus).toContain("'sven.htpr.alert_triggered'"); });
    it('has switch case htpr_create_probe', () => { expect(executor).toContain("case 'htpr_create_probe'"); });
    it('has switch case htpr_run_probe', () => { expect(executor).toContain("case 'htpr_run_probe'"); });
    it('has handler handleHtprCreateProbe', () => { expect(executor).toContain('handleHtprCreateProbe'); });
    it('has handler handleHtprGenerateReport', () => { expect(executor).toContain('handleHtprGenerateReport'); });
  });

  // ── Batch 351: Quota Enforcer ──
  describe('Batch 351: quota_enforcer migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260619880000_agent_quota_enforcer.sql'), 'utf-8');
    it('creates agent_quota_enforcer_configs table', () => { expect(sql).toContain('agent_quota_enforcer_configs'); });
    it('creates agent_quota_usage table', () => { expect(sql).toContain('agent_quota_usage'); });
    it('creates agent_quota_violations table', () => { expect(sql).toContain('agent_quota_violations'); });
    it('has enforcement_mode column', () => { expect(sql).toContain('enforcement_mode'); });
    it('has overage_policy column', () => { expect(sql).toContain('overage_policy'); });
    it('has indexes', () => { expect(sql).toContain('idx_quota_enforcer_agent'); });
  });

  describe('Batch 351: quota_enforcer types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-quota-enforcer.ts'), 'utf-8');
    it('exports QuotaPeriod type', () => { expect(ts).toContain('QuotaPeriod'); });
    it('exports EnforcementMode type', () => { expect(ts).toContain('EnforcementMode'); });
    it('exports OveragePolicy type', () => { expect(ts).toContain('OveragePolicy'); });
    it('exports QuotaEnforcerConfig interface', () => { expect(ts).toContain('QuotaEnforcerConfig'); });
    it('exports QuotaUsage interface', () => { expect(ts).toContain('QuotaUsage'); });
    it('exports QuotaViolation interface', () => { expect(ts).toContain('QuotaViolation'); });
  });

  describe('Batch 351: quota_enforcer SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/quota-enforcer/SKILL.md'), 'utf-8');
    it('has name field', () => { expect(md).toContain('name: quota-enforcer'); });
    it('has price', () => { expect(md).toContain('14.99'); });
    it('has Actions heading', () => { expect(md).toContain('## Actions'); });
    it('has set-quota action', () => { expect(md).toContain('set-quota'); });
    it('has enforce-policy action', () => { expect(md).toContain('enforce-policy'); });
  });

  describe('Batch 351: quota_enforcer wiring', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const eventBus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const executor = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has BK value', () => { expect(types).toContain("'quota_enforcer'"); });
    it('has EK qten.quota_set', () => { expect(types).toContain("'qten.quota_set'"); });
    it('has EK qten.limit_exceeded', () => { expect(types).toContain("'qten.limit_exceeded'"); });
    it('has EK qten.policy_enforced', () => { expect(types).toContain("'qten.policy_enforced'"); });
    it('has EK qten.period_reset', () => { expect(types).toContain("'qten.period_reset'"); });
    it('has SUBJECT_MAP qten.quota_set', () => { expect(eventBus).toContain("'sven.qten.quota_set'"); });
    it('has SUBJECT_MAP qten.limit_exceeded', () => { expect(eventBus).toContain("'sven.qten.limit_exceeded'"); });
    it('has switch case qten_set_quota', () => { expect(executor).toContain("case 'qten_set_quota'"); });
    it('has switch case qten_enforce_policy', () => { expect(executor).toContain("case 'qten_enforce_policy'"); });
    it('has handler handleQtenSetQuota', () => { expect(executor).toContain('handleQtenSetQuota'); });
    it('has handler handleQtenAdjustLimits', () => { expect(executor).toContain('handleQtenAdjustLimits'); });
  });

  // ── Batch 352: Topology Mapper ──
  describe('Batch 352: topology_mapper migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260619890000_agent_topology_mapper.sql'), 'utf-8');
    it('creates agent_topology_mapper_configs table', () => { expect(sql).toContain('agent_topology_mapper_configs'); });
    it('creates agent_topology_nodes table', () => { expect(sql).toContain('agent_topology_nodes'); });
    it('creates agent_topology_edges table', () => { expect(sql).toContain('agent_topology_edges'); });
    it('has discovery_method column', () => { expect(sql).toContain('discovery_method'); });
    it('has depth_limit column', () => { expect(sql).toContain('depth_limit'); });
    it('has edge indexes', () => { expect(sql).toContain('idx_topology_edges_source'); });
  });

  describe('Batch 352: topology_mapper types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-topology-mapper.ts'), 'utf-8');
    it('exports DiscoveryMethod type', () => { expect(ts).toContain('DiscoveryMethod'); });
    it('exports NodeType type', () => { expect(ts).toContain('NodeType'); });
    it('exports NodeHealth type', () => { expect(ts).toContain('NodeHealth'); });
    it('exports EdgeType type', () => { expect(ts).toContain('EdgeType'); });
    it('exports TopologyMapperConfig interface', () => { expect(ts).toContain('TopologyMapperConfig'); });
    it('exports TopologyNode interface', () => { expect(ts).toContain('TopologyNode'); });
    it('exports TopologyEdge interface', () => { expect(ts).toContain('TopologyEdge'); });
  });

  describe('Batch 352: topology_mapper SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/topology-mapper/SKILL.md'), 'utf-8');
    it('has name field', () => { expect(md).toContain('name: topology-mapper'); });
    it('has price', () => { expect(md).toContain('16.99'); });
    it('has Actions heading', () => { expect(md).toContain('## Actions'); });
    it('has discover-nodes action', () => { expect(md).toContain('discover-nodes'); });
    it('has export-map action', () => { expect(md).toContain('export-map'); });
  });

  describe('Batch 352: topology_mapper wiring', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const eventBus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const executor = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has BK value', () => { expect(types).toContain("'topology_mapper'"); });
    it('has EK tpmp.nodes_discovered', () => { expect(types).toContain("'tpmp.nodes_discovered'"); });
    it('has EK tpmp.edges_mapped', () => { expect(types).toContain("'tpmp.edges_mapped'"); });
    it('has EK tpmp.changes_detected', () => { expect(types).toContain("'tpmp.changes_detected'"); });
    it('has EK tpmp.map_exported', () => { expect(types).toContain("'tpmp.map_exported'"); });
    it('has SUBJECT_MAP tpmp.nodes_discovered', () => { expect(eventBus).toContain("'sven.tpmp.nodes_discovered'"); });
    it('has SUBJECT_MAP tpmp.edges_mapped', () => { expect(eventBus).toContain("'sven.tpmp.edges_mapped'"); });
    it('has SUBJECT_MAP tpmp.changes_detected', () => { expect(eventBus).toContain("'sven.tpmp.changes_detected'"); });
    it('has SUBJECT_MAP tpmp.map_exported', () => { expect(eventBus).toContain("'sven.tpmp.map_exported'"); });
    it('has switch case tpmp_discover_nodes', () => { expect(executor).toContain("case 'tpmp_discover_nodes'"); });
    it('has switch case tpmp_map_edges', () => { expect(executor).toContain("case 'tpmp_map_edges'"); });
    it('has switch case tpmp_export_map', () => { expect(executor).toContain("case 'tpmp_export_map'"); });
    it('has handler handleTpmpDiscoverNodes', () => { expect(executor).toContain('handleTpmpDiscoverNodes'); });
    it('has handler handleTpmpAnalyzeDependencies', () => { expect(executor).toContain('handleTpmpAnalyzeDependencies'); });
    it('has handler handleTpmpCheckHealth', () => { expect(executor).toContain('handleTpmpCheckHealth'); });
  });

  // ── Cross-cutting: barrel exports + .gitattributes ──
  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-log-router', () => { expect(idx).toContain("'./agent-log-router'"); });
    it('exports agent-config-sync', () => { expect(idx).toContain("'./agent-config-sync'"); });
    it('exports agent-health-prober', () => { expect(idx).toContain("'./agent-health-prober'"); });
    it('exports agent-quota-enforcer', () => { expect(idx).toContain("'./agent-quota-enforcer'"); });
    it('exports agent-topology-mapper', () => { expect(idx).toContain("'./agent-topology-mapper'"); });
  });

  describe('.gitattributes entries', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('has entry for log-router migration', () => { expect(ga).toContain('20260619850000_agent_log_router.sql'); });
    it('has entry for config-sync migration', () => { expect(ga).toContain('20260619860000_agent_config_sync.sql'); });
    it('has entry for health-prober migration', () => { expect(ga).toContain('20260619870000_agent_health_prober.sql'); });
    it('has entry for quota-enforcer migration', () => { expect(ga).toContain('20260619880000_agent_quota_enforcer.sql'); });
    it('has entry for topology-mapper migration', () => { expect(ga).toContain('20260619890000_agent_topology_mapper.sql'); });
    it('has entry for log-router types', () => { expect(ga).toContain('agent-log-router.ts'); });
    it('has entry for config-sync types', () => { expect(ga).toContain('agent-config-sync.ts'); });
    it('has entry for health-prober types', () => { expect(ga).toContain('agent-health-prober.ts'); });
    it('has entry for quota-enforcer types', () => { expect(ga).toContain('agent-quota-enforcer.ts'); });
    it('has entry for topology-mapper types', () => { expect(ga).toContain('agent-topology-mapper.ts'); });
    it('has entry for log-router SKILL.md', () => { expect(ga).toContain('log-router/SKILL.md'); });
    it('has entry for config-sync SKILL.md', () => { expect(ga).toContain('config-sync/SKILL.md'); });
    it('has entry for health-prober SKILL.md', () => { expect(ga).toContain('health-prober/SKILL.md'); });
    it('has entry for quota-enforcer SKILL.md', () => { expect(ga).toContain('quota-enforcer/SKILL.md'); });
    it('has entry for topology-mapper SKILL.md', () => { expect(ga).toContain('topology-mapper/SKILL.md'); });
  });
});
