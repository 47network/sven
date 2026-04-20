/**
 * Batch 158-162 — Agent Operations: Telemetry Export, Cost Allocation,
 * Network Policy, Disaster Recovery, Performance Profiling
 *
 * 145 tests across migration SQL, shared types, SKILL.md, Eidolon wiring,
 * event-bus SUBJECT_MAP, and task-executor handler coverage.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/* ────────── helpers ────────── */
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));

/* ────────── file contents ────────── */
const migTelemetry = read('services/gateway-api/migrations/20260617950000_agent_telemetry_export.sql');
const migCost      = read('services/gateway-api/migrations/20260617960000_agent_cost_allocation.sql');
const migNetwork   = read('services/gateway-api/migrations/20260617970000_agent_network_policy.sql');
const migDr        = read('services/gateway-api/migrations/20260617980000_agent_disaster_recovery.sql');
const migPerf      = read('services/gateway-api/migrations/20260617990000_agent_performance_profiling.sql');

const typesTs      = read('services/sven-eidolon/src/types.ts');
const eventBusTs   = read('services/sven-eidolon/src/event-bus.ts');
const indexTs      = read('packages/shared/src/index.ts');
const taskExec     = read('services/sven-marketplace/src/task-executor.ts');
const gitattr      = read('.gitattributes');

const skillTelemetry = read('skills/agent-telemetry-export/SKILL.md');
const skillCost      = read('skills/agent-cost-allocation/SKILL.md');
const skillNetwork   = read('skills/agent-network-policy/SKILL.md');
const skillDr        = read('skills/agent-disaster-recovery/SKILL.md');
const skillPerf      = read('skills/agent-performance-profiling/SKILL.md');

const sharedTelemetry = read('packages/shared/src/agent-telemetry-export.ts');
const sharedCost      = read('packages/shared/src/agent-cost-allocation.ts');
const sharedNetwork   = read('packages/shared/src/agent-network-policy.ts');
const sharedDr        = read('packages/shared/src/agent-disaster-recovery.ts');
const sharedPerf      = read('packages/shared/src/agent-performance-profiling.ts');

/* ══════════════════════════════════════════════════════════════════
   BATCH 158 — Agent Telemetry Export
   ══════════════════════════════════════════════════════════════════ */
describe('Batch 158 — Agent Telemetry Export', () => {
  describe('Migration SQL', () => {
    it('creates agent_telemetry_sinks table', () => expect(migTelemetry).toContain('agent_telemetry_sinks'));
    it('creates agent_telemetry_pipelines table', () => expect(migTelemetry).toContain('agent_telemetry_pipelines'));
    it('creates agent_telemetry_export_log table', () => expect(migTelemetry).toContain('agent_telemetry_export_log'));
    it('has sink_type CHECK', () => expect(migTelemetry).toMatch(/prometheus.*grafana.*datadog.*otlp/));
    it('has signal_type CHECK', () => expect(migTelemetry).toMatch(/metrics.*traces.*logs.*events/));
    it('has export status CHECK', () => expect(migTelemetry).toMatch(/pending.*exporting.*completed.*failed/));
    it('creates indexes', () => expect(migTelemetry).toContain('idx_telemetry_sinks_tenant'));
  });

  describe('Shared types', () => {
    it('exports AgentTelemetrySinkType', () => expect(sharedTelemetry).toContain('AgentTelemetrySinkType'));
    it('exports AgentTelemetryPipeline', () => expect(sharedTelemetry).toContain('AgentTelemetryPipeline'));
    it('exports AgentTelemetryExportEntry', () => expect(sharedTelemetry).toContain('AgentTelemetryExportEntry'));
    it('exports AgentTelemetryExportStats', () => expect(sharedTelemetry).toContain('AgentTelemetryExportStats'));
    it('barrel exports agent-telemetry-export', () => expect(indexTs).toContain("agent-telemetry-export"));
  });

  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-telemetry-export/SKILL.md')).toBe(true));
    it('has correct name', () => expect(skillTelemetry).toContain('name: agent-telemetry-export'));
    it('has archetype infrastructure', () => expect(skillTelemetry).toContain('archetype: infrastructure'));
    it('has pricing', () => expect(skillTelemetry).toContain('0.49 47T'));
    it('lists create-sink action', () => expect(skillTelemetry).toContain('create-sink'));
    it('lists export-batch action', () => expect(skillTelemetry).toContain('export-batch'));
  });
});

/* ══════════════════════════════════════════════════════════════════
   BATCH 159 — Agent Cost Allocation
   ══════════════════════════════════════════════════════════════════ */
describe('Batch 159 — Agent Cost Allocation', () => {
  describe('Migration SQL', () => {
    it('creates agent_cost_centers table', () => expect(migCost).toContain('agent_cost_centers'));
    it('creates agent_cost_entries table', () => expect(migCost).toContain('agent_cost_entries'));
    it('creates agent_cost_reports table', () => expect(migCost).toContain('agent_cost_reports'));
    it('has center_type CHECK', () => expect(migCost).toMatch(/agent.*crew.*project.*department/));
    it('has entry_type CHECK', () => expect(migCost).toMatch(/compute.*storage.*network.*api_call/));
    it('has budget_period CHECK', () => expect(migCost).toMatch(/daily.*weekly.*monthly.*quarterly/));
    it('creates indexes', () => expect(migCost).toContain('idx_cost_centers_tenant'));
  });

  describe('Shared types', () => {
    it('exports AgentCostCenterType', () => expect(sharedCost).toContain('AgentCostCenterType'));
    it('exports AgentCostEntry', () => expect(sharedCost).toContain('AgentCostEntry'));
    it('exports AgentCostReport', () => expect(sharedCost).toContain('AgentCostReport'));
    it('exports AgentCostAllocationStats', () => expect(sharedCost).toContain('AgentCostAllocationStats'));
    it('barrel exports agent-cost-allocation', () => expect(indexTs).toContain("agent-cost-allocation"));
  });

  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-cost-allocation/SKILL.md')).toBe(true));
    it('has correct name', () => expect(skillCost).toContain('name: agent-cost-allocation'));
    it('has archetype analyst', () => expect(skillCost).toContain('archetype: analyst'));
    it('has pricing', () => expect(skillCost).toContain('0.29 47T'));
    it('lists create-center action', () => expect(skillCost).toContain('create-center'));
    it('lists cost-forecast action', () => expect(skillCost).toContain('cost-forecast'));
  });
});

/* ══════════════════════════════════════════════════════════════════
   BATCH 160 — Agent Network Policy
   ══════════════════════════════════════════════════════════════════ */
describe('Batch 160 — Agent Network Policy', () => {
  describe('Migration SQL', () => {
    it('creates agent_network_policies table', () => expect(migNetwork).toContain('agent_network_policies'));
    it('creates agent_network_segments table', () => expect(migNetwork).toContain('agent_network_segments'));
    it('creates agent_network_audit_log table', () => expect(migNetwork).toContain('agent_network_audit_log'));
    it('has policy_type CHECK', () => expect(migNetwork).toMatch(/ingress.*egress.*internal.*isolation/));
    it('has segment_type CHECK', () => expect(migNetwork).toMatch(/trusted.*dmz.*isolated.*quarantine/));
    it('has event_type CHECK', () => expect(migNetwork).toMatch(/allowed.*denied.*logged.*rate_limited/));
    it('creates indexes', () => expect(migNetwork).toContain('idx_network_policies_tenant'));
  });

  describe('Shared types', () => {
    it('exports AgentNetPolicyType', () => expect(sharedNetwork).toContain('AgentNetPolicyType'));
    it('exports AgentNetworkPolicyRule', () => expect(sharedNetwork).toContain('AgentNetworkPolicyRule'));
    it('exports AgentNetworkSegment', () => expect(sharedNetwork).toContain('AgentNetworkSegment'));
    it('exports AgentNetworkPolicyStats', () => expect(sharedNetwork).toContain('AgentNetworkPolicyStats'));
    it('barrel exports agent-network-policy', () => expect(indexTs).toContain("agent-network-policy"));
  });

  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-network-policy/SKILL.md')).toBe(true));
    it('has correct name', () => expect(skillNetwork).toContain('name: agent-network-policy'));
    it('has archetype infrastructure', () => expect(skillNetwork).toContain('archetype: infrastructure'));
    it('has pricing', () => expect(skillNetwork).toContain('0.59 47T'));
    it('lists create-policy action', () => expect(skillNetwork).toContain('create-policy'));
    it('lists enforce-isolation action', () => expect(skillNetwork).toContain('enforce-isolation'));
  });
});

/* ══════════════════════════════════════════════════════════════════
   BATCH 161 — Agent Disaster Recovery
   ══════════════════════════════════════════════════════════════════ */
describe('Batch 161 — Agent Disaster Recovery', () => {
  describe('Migration SQL', () => {
    it('creates agent_dr_plans table', () => expect(migDr).toContain('agent_dr_plans'));
    it('creates agent_dr_failovers table', () => expect(migDr).toContain('agent_dr_failovers'));
    it('creates agent_dr_checkpoints table', () => expect(migDr).toContain('agent_dr_checkpoints'));
    it('has tier CHECK', () => expect(migDr).toMatch(/critical.*high.*medium.*low/));
    it('has strategy CHECK', () => expect(migDr).toMatch(/active_active.*active_passive.*pilot_light/));
    it('has failover_status CHECK', () => expect(migDr).toMatch(/initiated.*in_progress.*completed.*failed/));
    it('creates indexes', () => expect(migDr).toContain('idx_dr_plans_tenant'));
  });

  describe('Shared types', () => {
    it('exports AgentDrTier', () => expect(sharedDr).toContain('AgentDrTier'));
    it('exports AgentDrPlan', () => expect(sharedDr).toContain('AgentDrPlan'));
    it('exports AgentDrFailover', () => expect(sharedDr).toContain('AgentDrFailover'));
    it('exports AgentDisasterRecoveryStats', () => expect(sharedDr).toContain('AgentDisasterRecoveryStats'));
    it('barrel exports agent-disaster-recovery', () => expect(indexTs).toContain("agent-disaster-recovery"));
  });

  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-disaster-recovery/SKILL.md')).toBe(true));
    it('has correct name', () => expect(skillDr).toContain('name: agent-disaster-recovery'));
    it('has archetype operations', () => expect(skillDr).toContain('archetype: operations'));
    it('has pricing', () => expect(skillDr).toContain('1.99 47T'));
    it('lists create-plan action', () => expect(skillDr).toContain('create-plan'));
    it('lists trigger-failover action', () => expect(skillDr).toContain('trigger-failover'));
  });
});

/* ══════════════════════════════════════════════════════════════════
   BATCH 162 — Agent Performance Profiling
   ══════════════════════════════════════════════════════════════════ */
describe('Batch 162 — Agent Performance Profiling', () => {
  describe('Migration SQL', () => {
    it('creates agent_perf_profiles table', () => expect(migPerf).toContain('agent_perf_profiles'));
    it('creates agent_perf_bottlenecks table', () => expect(migPerf).toContain('agent_perf_bottlenecks'));
    it('creates agent_perf_baselines table', () => expect(migPerf).toContain('agent_perf_baselines'));
    it('has profile_type CHECK', () => expect(migPerf).toMatch(/cpu.*memory.*io.*network.*latency/));
    it('has bottleneck_type CHECK', () => expect(migPerf).toMatch(/cpu_bound.*memory_leak.*io_wait/));
    it('has trend CHECK', () => expect(migPerf).toMatch(/improving.*stable.*degrading.*critical/));
    it('creates indexes', () => expect(migPerf).toContain('idx_perf_profiles_agent'));
  });

  describe('Shared types', () => {
    it('exports AgentPerfProfileType', () => expect(sharedPerf).toContain('AgentPerfProfileType'));
    it('exports AgentPerfBottleneck', () => expect(sharedPerf).toContain('AgentPerfBottleneck'));
    it('exports AgentPerfBaseline', () => expect(sharedPerf).toContain('AgentPerfBaseline'));
    it('exports AgentPerformanceProfilingStats', () => expect(sharedPerf).toContain('AgentPerformanceProfilingStats'));
    it('barrel exports agent-performance-profiling', () => expect(indexTs).toContain("agent-performance-profiling"));
  });

  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-performance-profiling/SKILL.md')).toBe(true));
    it('has correct name', () => expect(skillPerf).toContain('name: agent-performance-profiling'));
    it('has archetype analyst', () => expect(skillPerf).toContain('archetype: analyst'));
    it('has pricing', () => expect(skillPerf).toContain('0.79 47T'));
    it('lists start-profile action', () => expect(skillPerf).toContain('start-profile'));
    it('lists auto-optimize action', () => expect(skillPerf).toContain('auto-optimize'));
  });
});

/* ══════════════════════════════════════════════════════════════════
   CROSS-CUTTING — Eidolon types.ts wiring
   ══════════════════════════════════════════════════════════════════ */
describe('Eidolon types.ts wiring (Batches 158-162)', () => {
  describe('EidolonBuildingKind', () => {
    const bkMatch = typesTs.match(/'[a-z_]+'/g) || [];
    it('telemetry_hub appears', () => expect(bkMatch).toContain("'telemetry_hub'"));
    it('cost_ledger appears', () => expect(bkMatch).toContain("'cost_ledger'"));
    it('net_firewall appears', () => expect(bkMatch).toContain("'net_firewall'"));
    it('recovery_vault appears', () => expect(bkMatch).toContain("'recovery_vault'"));
    it('perf_lab appears', () => expect(bkMatch).toContain("'perf_lab'"));
  });

  describe('EidolonEventKind', () => {
    it('has telemetry.sink_created', () => expect(typesTs).toContain("'telemetry.sink_created'"));
    it('has telemetry.batch_exported', () => expect(typesTs).toContain("'telemetry.batch_exported'"));
    it('has costalloc.center_created', () => expect(typesTs).toContain("'costalloc.center_created'"));
    it('has costalloc.budget_exceeded', () => expect(typesTs).toContain("'costalloc.budget_exceeded'"));
    it('has netpolicy.rule_created', () => expect(typesTs).toContain("'netpolicy.rule_created'"));
    it('has netpolicy.traffic_denied', () => expect(typesTs).toContain("'netpolicy.traffic_denied'"));
    it('has dr.plan_created', () => expect(typesTs).toContain("'dr.plan_created'"));
    it('has dr.failover_triggered', () => expect(typesTs).toContain("'dr.failover_triggered'"));
    it('has perfprof.profile_started', () => expect(typesTs).toContain("'perfprof.profile_started'"));
    it('has perfprof.bottleneck_found', () => expect(typesTs).toContain("'perfprof.bottleneck_found'"));
  });

  describe('districtFor()', () => {
    it('maps telemetry_hub → civic', () => expect(typesTs).toMatch(/case 'telemetry_hub'[\s\S]*?return 'civic'/));
    it('maps cost_ledger → market', () => expect(typesTs).toMatch(/case 'cost_ledger'[\s\S]*?return 'market'/));
    it('maps net_firewall → civic', () => expect(typesTs).toMatch(/case 'net_firewall'[\s\S]*?return 'civic'/));
    it('maps recovery_vault → civic', () => expect(typesTs).toMatch(/case 'recovery_vault'[\s\S]*?return 'civic'/));
    it('maps perf_lab → civic', () => expect(typesTs).toMatch(/case 'perf_lab'[\s\S]*?return 'civic'/));
  });
});

/* ══════════════════════════════════════════════════════════════════
   CROSS-CUTTING — Event-bus SUBJECT_MAP
   ══════════════════════════════════════════════════════════════════ */
describe('Event-bus SUBJECT_MAP (Batches 158-162)', () => {
  it('maps sven.telemetry.sink_created', () => expect(eventBusTs).toContain("'sven.telemetry.sink_created'"));
  it('maps sven.telemetry.sink_error', () => expect(eventBusTs).toContain("'sven.telemetry.sink_error'"));
  it('maps sven.costalloc.center_created', () => expect(eventBusTs).toContain("'sven.costalloc.center_created'"));
  it('maps sven.costalloc.budget_exceeded', () => expect(eventBusTs).toContain("'sven.costalloc.budget_exceeded'"));
  it('maps sven.netpolicy.rule_created', () => expect(eventBusTs).toContain("'sven.netpolicy.rule_created'"));
  it('maps sven.netpolicy.audit_logged', () => expect(eventBusTs).toContain("'sven.netpolicy.audit_logged'"));
  it('maps sven.dr.plan_created', () => expect(eventBusTs).toContain("'sven.dr.plan_created'"));
  it('maps sven.dr.checkpoint_stale', () => expect(eventBusTs).toContain("'sven.dr.checkpoint_stale'"));
  it('maps sven.perfprof.profile_started', () => expect(eventBusTs).toContain("'sven.perfprof.profile_started'"));
  it('maps sven.perfprof.trend_degrading', () => expect(eventBusTs).toContain("'sven.perfprof.trend_degrading'"));
  it('has 20 new entries (590+ total)', () => {
    const count = (eventBusTs.match(/'sven\.\w+\.\w+'/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(590);
  });
});

/* ══════════════════════════════════════════════════════════════════
   CROSS-CUTTING — Task executor
   ══════════════════════════════════════════════════════════════════ */
describe('Task executor (Batches 158-162)', () => {
  describe('Switch cases', () => {
    it('has telemetry_create_sink', () => expect(taskExec).toContain("case 'telemetry_create_sink'"));
    it('has telemetry_export_batch', () => expect(taskExec).toContain("case 'telemetry_export_batch'"));
    it('has costalloc_create_center', () => expect(taskExec).toContain("case 'costalloc_create_center'"));
    it('has costalloc_forecast', () => expect(taskExec).toContain("case 'costalloc_forecast'"));
    it('has netpolicy_create_rule', () => expect(taskExec).toContain("case 'netpolicy_create_rule'"));
    it('has netpolicy_enforce', () => expect(taskExec).toContain("case 'netpolicy_enforce'"));
    it('has dr_create_plan', () => expect(taskExec).toContain("case 'dr_create_plan'"));
    it('has dr_trigger_failover', () => expect(taskExec).toContain("case 'dr_trigger_failover'"));
    it('has perfprof_start_profile', () => expect(taskExec).toContain("case 'perfprof_start_profile'"));
    it('has perfprof_auto_optimize', () => expect(taskExec).toContain("case 'perfprof_auto_optimize'"));
  });

  describe('Handler methods', () => {
    it('has handleTelemetryCreateSink', () => expect(taskExec).toContain('handleTelemetryCreateSink'));
    it('has handleCostallocGenerateReport', () => expect(taskExec).toContain('handleCostallocGenerateReport'));
    it('has handleNetpolicyCreateSegment', () => expect(taskExec).toContain('handleNetpolicyCreateSegment'));
    it('has handleDrTriggerFailover', () => expect(taskExec).toContain('handleDrTriggerFailover'));
    it('has handlePerfprofDetectBottlenecks', () => expect(taskExec).toContain('handlePerfprofDetectBottlenecks'));
  });

  describe('Handler count sanity', () => {
    const switches = (taskExec.match(/case '[a-z_]+'/g) || []).length;
    const handlers = (taskExec.match(/private async handle/g) || []).length;
    it('has 845+ switch cases', () => expect(switches).toBeGreaterThanOrEqual(845));
    it('has 630+ handler methods', () => expect(handlers).toBeGreaterThanOrEqual(630));
  });
});

/* ══════════════════════════════════════════════════════════════════
   CROSS-CUTTING — .gitattributes
   ══════════════════════════════════════════════════════════════════ */
describe('.gitattributes (Batches 158-162)', () => {
  it('guards telemetry export migration', () => expect(gitattr).toContain('20260617950000_agent_telemetry_export.sql'));
  it('guards cost allocation types', () => expect(gitattr).toContain('agent-cost-allocation.ts'));
  it('guards network policy SKILL.md', () => expect(gitattr).toContain('agent-network-policy/SKILL.md'));
  it('guards disaster recovery migration', () => expect(gitattr).toContain('20260617980000_agent_disaster_recovery.sql'));
  it('guards performance profiling types', () => expect(gitattr).toContain('agent-performance-profiling.ts'));
});
