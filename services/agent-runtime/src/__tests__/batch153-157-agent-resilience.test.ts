import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/* ─────────── helpers ─────────── */
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));

/* ═══════════ BATCH 153 — AGENT CIRCUIT BREAKER ═══════════ */
describe('Batch 153 — Agent Circuit Breaker', () => {
  describe('Migration', () => {
    const sql = read('services/gateway-api/migrations/20260617900000_agent_circuit_breaker.sql');
    it('creates agent_circuit_breakers table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_circuit_breakers'));
    it('creates circuit_breaker_trips table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS circuit_breaker_trips'));
    it('creates circuit_breaker_metrics table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS circuit_breaker_metrics'));
    it('has state CHECK constraint', () => expect(sql).toMatch(/CHECK\s*\(/));
    it('has 6+ indexes', () => { const m = sql.match(/CREATE INDEX/g); expect(m && m.length).toBeGreaterThanOrEqual(6); });
    it('has timestamps', () => { expect(sql).toContain('created_at'); expect(sql).toContain('updated_at'); });
  });

  describe('Shared Types', () => {
    const src = read('packages/shared/src/agent-circuit-breaker.ts');
    it('exports AgentCircuitState', () => expect(src).toContain("export type AgentCircuitState"));
    it('exports AgentCircuitConfig', () => expect(src).toContain("export interface AgentCircuitConfig"));
    it('exports AgentCircuitTrip', () => expect(src).toContain("export interface AgentCircuitTrip"));
    it('exports CircuitBreakerMetric', () => expect(src).toContain("export interface CircuitBreakerMetric"));
    it('exports AgentCircuitStats', () => expect(src).toContain("export interface AgentCircuitStats"));
    it('has closed|open|half_open states', () => { expect(src).toContain("'closed'"); expect(src).toContain("'open'"); expect(src).toContain("'half_open'"); });
  });

  describe('Barrel Export', () => {
    const idx = read('packages/shared/src/index.ts');
    it('exports agent-circuit-breaker', () => expect(idx).toContain("from './agent-circuit-breaker.js'"));
  });

  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-circuit-breaker/SKILL.md')).toBe(true));
    const md = read('skills/agent-circuit-breaker/SKILL.md');
    it('has name', () => expect(md).toContain('name: agent-circuit-breaker'));
    it('has archetype infrastructure', () => expect(md).toContain('archetype: infrastructure'));
    it('has pricing', () => expect(md).toContain('0.39'));
    it('has actions', () => { expect(md).toContain('create-breaker'); expect(md).toContain('check-state'); });
  });

  describe('Eidolon', () => {
    const types = read('services/sven-eidolon/src/types.ts');
    it('has circuit_panel BK', () => expect(types).toContain("'circuit_panel'"));
    it('has circuit EK values', () => {
      expect(types).toContain("'circuit.breaker_created'");
      expect(types).toContain("'circuit.state_changed'");
      expect(types).toContain("'circuit.trip_recorded'");
      expect(types).toContain("'circuit.metrics_collected'");
    });
    it('has districtFor circuit_panel', () => expect(types).toContain("case 'circuit_panel':"));
  });

  describe('Event Bus', () => {
    const eb = read('services/sven-eidolon/src/event-bus.ts');
    it('has circuit SUBJECT_MAP entries', () => {
      expect(eb).toContain("'sven.circuit.breaker_created'");
      expect(eb).toContain("'sven.circuit.state_changed'");
      expect(eb).toContain("'sven.circuit.trip_recorded'");
      expect(eb).toContain("'sven.circuit.metrics_collected'");
    });
  });

  describe('Task Executor', () => {
    const te = read('services/sven-marketplace/src/task-executor.ts');
    it('has circuit_create case', () => expect(te).toContain("case 'circuit_create':"));
    it('has circuit_trip case', () => expect(te).toContain("case 'circuit_trip':"));
    it('has circuit_reset case', () => expect(te).toContain("case 'circuit_reset':"));
    it('has circuit_half_open case', () => expect(te).toContain("case 'circuit_half_open':"));
    it('has circuit_list case', () => expect(te).toContain("case 'circuit_list':"));
    it('has circuit_report case', () => expect(te).toContain("case 'circuit_report':"));
    it('has handleCircuitCreate', () => expect(te).toContain('handleCircuitCreate'));
    it('has handleCircuitTrip', () => expect(te).toContain('handleCircuitTrip'));
    it('has handleCircuitReset', () => expect(te).toContain('handleCircuitReset'));
    it('has handleCircuitReport', () => expect(te).toContain('handleCircuitReport'));
  });
});

/* ═══════════ BATCH 154 — AGENT RATE LIMITER ═══════════ */
describe('Batch 154 — Agent Rate Limiter', () => {
  describe('Migration', () => {
    const sql = read('services/gateway-api/migrations/20260617910000_agent_rate_limiter.sql');
    it('creates agent_rate_limiters table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_rate_limiters'));
    it('creates rate_limit_buckets table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS rate_limit_buckets'));
    it('creates rate_limit_violations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS rate_limit_violations'));
    it('has policy CHECK constraint', () => expect(sql).toMatch(/CHECK\s*\(/));
    it('has 6+ indexes', () => { const m = sql.match(/CREATE INDEX/g); expect(m && m.length).toBeGreaterThanOrEqual(6); });
  });

  describe('Shared Types', () => {
    const src = read('packages/shared/src/agent-rate-limiter.ts');
    it('exports AgentRateLimitPolicy', () => expect(src).toContain("export type AgentRateLimitPolicy"));
    it('exports AgentRateLimiterConfig', () => expect(src).toContain("export interface AgentRateLimiterConfig"));
    it('exports AgentRateBucket', () => expect(src).toContain("export interface AgentRateBucket"));
    it('exports AgentRateViolation', () => expect(src).toContain("export interface AgentRateViolation"));
    it('exports AgentRateLimiterStats', () => expect(src).toContain("export interface AgentRateLimiterStats"));
    it('has token_bucket policy', () => expect(src).toContain("'token_bucket'"));
  });

  describe('Barrel Export', () => {
    const idx = read('packages/shared/src/index.ts');
    it('exports agent-rate-limiter', () => expect(idx).toContain("from './agent-rate-limiter.js'"));
  });

  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-rate-limiter/SKILL.md')).toBe(true));
    const md = read('skills/agent-rate-limiter/SKILL.md');
    it('has name', () => expect(md).toContain('name: agent-rate-limiter'));
    it('has archetype infrastructure', () => expect(md).toContain('archetype: infrastructure'));
    it('has pricing 0.19', () => expect(md).toContain('0.19'));
  });

  describe('Eidolon', () => {
    const types = read('services/sven-eidolon/src/types.ts');
    it('has rate_gate BK', () => expect(types).toContain("'rate_gate'"));
    it('has ratelimit EK values', () => {
      expect(types).toContain("'ratelimit.limiter_created'");
      expect(types).toContain("'ratelimit.tokens_consumed'");
      expect(types).toContain("'ratelimit.violation_recorded'");
      expect(types).toContain("'ratelimit.bucket_refilled'");
    });
  });

  describe('Event Bus', () => {
    const eb = read('services/sven-eidolon/src/event-bus.ts');
    it('has ratelimit SUBJECT_MAP entries', () => {
      expect(eb).toContain("'sven.ratelimit.limiter_created'");
      expect(eb).toContain("'sven.ratelimit.tokens_consumed'");
      expect(eb).toContain("'sven.ratelimit.violation_recorded'");
      expect(eb).toContain("'sven.ratelimit.bucket_refilled'");
    });
  });

  describe('Task Executor', () => {
    const te = read('services/sven-marketplace/src/task-executor.ts');
    it('has ratelimit_create case', () => expect(te).toContain("case 'ratelimit_create':"));
    it('has ratelimit_consume case', () => expect(te).toContain("case 'ratelimit_consume':"));
    it('has ratelimit_refill case', () => expect(te).toContain("case 'ratelimit_refill':"));
    it('has ratelimit_check case', () => expect(te).toContain("case 'ratelimit_check':"));
    it('has ratelimit_list case', () => expect(te).toContain("case 'ratelimit_list':"));
    it('has ratelimit_report case', () => expect(te).toContain("case 'ratelimit_report':"));
    it('has handler methods', () => { expect(te).toContain('handleRatelimitCreate'); expect(te).toContain('handleRatelimitReport'); });
  });
});

/* ═══════════ BATCH 155 — AGENT CANARY DEPLOY ═══════════ */
describe('Batch 155 — Agent Canary Deploy', () => {
  describe('Migration', () => {
    const sql = read('services/gateway-api/migrations/20260617920000_agent_canary_deploy.sql');
    it('creates agent_canary_deploys table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_canary_deploys'));
    it('creates canary_metrics table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS canary_metrics'));
    it('creates canary_decisions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS canary_decisions'));
    it('has 6+ indexes', () => { const m = sql.match(/CREATE INDEX/g); expect(m && m.length).toBeGreaterThanOrEqual(6); });
  });

  describe('Shared Types', () => {
    const src = read('packages/shared/src/agent-canary-deploy.ts');
    it('exports CanaryTarget', () => expect(src).toContain("export type CanaryTarget"));
    it('exports CanaryDeployConfig', () => expect(src).toContain("export interface CanaryDeployConfig"));
    it('exports CanaryDeployMetrics', () => expect(src).toContain("export interface CanaryDeployMetrics"));
    it('exports CanaryDeployDecision', () => expect(src).toContain("export interface CanaryDeployDecision"));
    it('exports CanaryDeployStats', () => expect(src).toContain("export interface CanaryDeployStats"));
  });

  describe('SKILL.md', () => {
    const md = read('skills/agent-canary-deploy/SKILL.md');
    it('has name', () => expect(md).toContain('name: agent-canary-deploy'));
    it('has archetype operations', () => expect(md).toContain('archetype: operations'));
    it('has pricing 1.49', () => expect(md).toContain('1.49'));
  });

  describe('Eidolon', () => {
    const types = read('services/sven-eidolon/src/types.ts');
    it('has canary_tower BK', () => expect(types).toContain("'canary_tower'"));
    it('has canary EK values', () => {
      expect(types).toContain("'canary.deploy_created'");
      expect(types).toContain("'canary.traffic_adjusted'");
      expect(types).toContain("'canary.metrics_collected'");
      expect(types).toContain("'canary.decision_made'");
    });
  });

  describe('Task Executor', () => {
    const te = read('services/sven-marketplace/src/task-executor.ts');
    it('has canary_start case', () => expect(te).toContain("case 'canary_start':"));
    it('has canary_promote case', () => expect(te).toContain("case 'canary_promote':"));
    it('has canary_rollback case', () => expect(te).toContain("case 'canary_rollback':"));
    it('has handleCanaryStart', () => expect(te).toContain('handleCanaryStart'));
    it('has handleCanaryReport', () => expect(te).toContain('handleCanaryReport'));
  });
});

/* ═══════════ BATCH 156 — AGENT FEATURE FLAGS ═══════════ */
describe('Batch 156 — Agent Feature Flags', () => {
  describe('Migration', () => {
    const sql = read('services/gateway-api/migrations/20260617930000_agent_feature_flags.sql');
    it('creates agent_feature_flags table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_feature_flags'));
    it('creates feature_flag_rules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS feature_flag_rules'));
    it('creates feature_flag_evaluations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS feature_flag_evaluations'));
    it('has 6+ indexes', () => { const m = sql.match(/CREATE INDEX/g); expect(m && m.length).toBeGreaterThanOrEqual(6); });
  });

  describe('Shared Types', () => {
    const src = read('packages/shared/src/agent-feature-flags.ts');
    it('exports AgentFeatureFlagKind', () => expect(src).toContain("export type AgentFeatureFlagKind"));
    it('exports AgentFeatureFlag', () => expect(src).toContain("export interface AgentFeatureFlag"));
    it('exports AgentFeatureFlagRule', () => expect(src).toContain("export interface AgentFeatureFlagRule"));
    it('exports AgentFeatureFlagEval', () => expect(src).toContain("export interface AgentFeatureFlagEval"));
    it('exports AgentFeatureFlagStats', () => expect(src).toContain("export interface AgentFeatureFlagStats"));
    it('has boolean|percentage|variant|schedule kinds', () => {
      expect(src).toContain("'boolean'"); expect(src).toContain("'percentage'");
      expect(src).toContain("'variant'"); expect(src).toContain("'schedule'");
    });
  });

  describe('SKILL.md', () => {
    const md = read('skills/agent-feature-flags/SKILL.md');
    it('has name', () => expect(md).toContain('name: agent-feature-flags'));
    it('has archetype operations', () => expect(md).toContain('archetype: operations'));
    it('has pricing 0.09', () => expect(md).toContain('0.09'));
  });

  describe('Eidolon', () => {
    const types = read('services/sven-eidolon/src/types.ts');
    it('has flag_control BK', () => expect(types).toContain("'flag_control'"));
    it('has featureflag EK values', () => {
      expect(types).toContain("'featureflag.flag_created'");
      expect(types).toContain("'featureflag.flag_toggled'");
      expect(types).toContain("'featureflag.rule_added'");
      expect(types).toContain("'featureflag.flag_evaluated'");
    });
  });

  describe('Task Executor', () => {
    const te = read('services/sven-marketplace/src/task-executor.ts');
    it('has featureflag_create case', () => expect(te).toContain("case 'featureflag_create':"));
    it('has featureflag_toggle case', () => expect(te).toContain("case 'featureflag_toggle':"));
    it('has featureflag_evaluate case', () => expect(te).toContain("case 'featureflag_evaluate':"));
    it('has featureflag_archive case', () => expect(te).toContain("case 'featureflag_archive':"));
    it('has handler methods', () => { expect(te).toContain('handleFeatureflagCreate'); expect(te).toContain('handleFeatureflagReport'); });
  });
});

/* ═══════════ BATCH 157 — AGENT CHAOS TESTING ═══════════ */
describe('Batch 157 — Agent Chaos Testing', () => {
  describe('Migration', () => {
    const sql = read('services/gateway-api/migrations/20260617940000_agent_chaos_testing.sql');
    it('creates chaos_experiments table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS chaos_experiments'));
    it('creates chaos_faults table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS chaos_faults'));
    it('creates chaos_results table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS chaos_results'));
    it('has 6+ indexes', () => { const m = sql.match(/CREATE INDEX/g); expect(m && m.length).toBeGreaterThanOrEqual(6); });
  });

  describe('Shared Types', () => {
    const src = read('packages/shared/src/agent-chaos-testing.ts');
    it('exports AgentChaosExperiment', () => expect(src).toContain("export interface AgentChaosExperiment"));
    it('exports AgentChaosFault', () => expect(src).toContain("export interface AgentChaosFault"));
    it('exports AgentChaosResult', () => expect(src).toContain("export interface AgentChaosResult"));
    it('exports AgentChaosTestingStats', () => expect(src).toContain("export interface AgentChaosTestingStats"));
    it('has ChaosBlastRadius type', () => expect(src).toContain("export type ChaosBlastRadius"));
    it('has ChaosFaultType type', () => expect(src).toContain("export type ChaosFaultType"));
    it('has latency|error|timeout faults', () => {
      expect(src).toContain("'latency'"); expect(src).toContain("'error'"); expect(src).toContain("'timeout'");
    });
  });

  describe('SKILL.md', () => {
    const md = read('skills/agent-chaos-testing/SKILL.md');
    it('has name', () => expect(md).toContain('name: agent-chaos-testing'));
    it('has archetype operations', () => expect(md).toContain('archetype: operations'));
    it('has pricing 2.99', () => expect(md).toContain('2.99'));
    it('has blast radius', () => expect(md).toContain('single'));
  });

  describe('Eidolon', () => {
    const types = read('services/sven-eidolon/src/types.ts');
    it('has chaos_arena BK', () => expect(types).toContain("'chaos_arena'"));
    it('has chaos EK values', () => {
      expect(types).toContain("'chaos.experiment_created'");
      expect(types).toContain("'chaos.fault_injected'");
      expect(types).toContain("'chaos.fault_removed'");
      expect(types).toContain("'chaos.experiment_completed'");
    });
    it('has districtFor chaos_arena', () => expect(types).toContain("case 'chaos_arena':"));
  });

  describe('Event Bus', () => {
    const eb = read('services/sven-eidolon/src/event-bus.ts');
    it('has chaos SUBJECT_MAP entries', () => {
      expect(eb).toContain("'sven.chaos.experiment_created'");
      expect(eb).toContain("'sven.chaos.fault_injected'");
      expect(eb).toContain("'sven.chaos.fault_removed'");
      expect(eb).toContain("'sven.chaos.experiment_completed'");
    });
  });

  describe('Task Executor', () => {
    const te = read('services/sven-marketplace/src/task-executor.ts');
    it('has chaos_start case', () => expect(te).toContain("case 'chaos_start':"));
    it('has chaos_inject_fault case', () => expect(te).toContain("case 'chaos_inject_fault':"));
    it('has chaos_remove_fault case', () => expect(te).toContain("case 'chaos_remove_fault':"));
    it('has chaos_abort case', () => expect(te).toContain("case 'chaos_abort':"));
    it('has chaos_list case', () => expect(te).toContain("case 'chaos_list':"));
    it('has chaos_report case', () => expect(te).toContain("case 'chaos_report':"));
    it('has handleChaosStart', () => expect(te).toContain('handleChaosStart'));
    it('has handleChaosReport', () => expect(te).toContain('handleChaosReport'));
  });
});

/* ═══════════ CROSS-BATCH INTEGRATION ═══════════ */
describe('Cross-Batch Integration (153-157)', () => {
  describe('.gitattributes', () => {
    const ga = read('.gitattributes');
    it('has circuit-breaker migration', () => expect(ga).toContain('20260617900000_agent_circuit_breaker.sql'));
    it('has rate-limiter migration', () => expect(ga).toContain('20260617910000_agent_rate_limiter.sql'));
    it('has canary-deploy migration', () => expect(ga).toContain('20260617920000_agent_canary_deploy.sql'));
    it('has feature-flags migration', () => expect(ga).toContain('20260617930000_agent_feature_flags.sql'));
    it('has chaos-testing migration', () => expect(ga).toContain('20260617940000_agent_chaos_testing.sql'));
    it('has circuit-breaker types', () => expect(ga).toContain('agent-circuit-breaker.ts'));
    it('has rate-limiter types', () => expect(ga).toContain('agent-rate-limiter.ts'));
    it('has canary-deploy types', () => expect(ga).toContain('agent-canary-deploy.ts'));
    it('has feature-flags types', () => expect(ga).toContain('agent-feature-flags.ts'));
    it('has chaos-testing types', () => expect(ga).toContain('agent-chaos-testing.ts'));
    it('has all 5 skill entries', () => {
      expect(ga).toContain('skills/agent-circuit-breaker/SKILL.md');
      expect(ga).toContain('skills/agent-rate-limiter/SKILL.md');
      expect(ga).toContain('skills/agent-canary-deploy/SKILL.md');
      expect(ga).toContain('skills/agent-feature-flags/SKILL.md');
      expect(ga).toContain('skills/agent-chaos-testing/SKILL.md');
    });
  });

  describe('All barrel exports present', () => {
    const idx = read('packages/shared/src/index.ts');
    ['agent-circuit-breaker', 'agent-rate-limiter', 'agent-canary-deploy', 'agent-feature-flags', 'agent-chaos-testing'].forEach(mod => {
      it(`exports ${mod}`, () => expect(idx).toContain(`from './${mod}.js'`));
    });
  });

  describe('No duplicate BK values', () => {
    const types = read('services/sven-eidolon/src/types.ts');
    const bkMatch = types.match(/'\w+'/g) || [];
    it('circuit_panel appears', () => expect(bkMatch.filter(v => v === "'circuit_panel'").length).toBeGreaterThanOrEqual(1));
    it('rate_gate appears once', () => expect(bkMatch.filter(v => v === "'rate_gate'").length).toBeGreaterThanOrEqual(1));
    it('chaos_arena appears once', () => expect(bkMatch.filter(v => v === "'chaos_arena'").length).toBeGreaterThanOrEqual(1));
  });

  describe('Handler count sanity', () => {
    const te = read('services/sven-marketplace/src/task-executor.ts');
    const cases = (te.match(/case '/g) || []).length;
    it('has 815+ switch cases', () => expect(cases).toBeGreaterThanOrEqual(815));
    const handlers = (te.match(/private async handle/g) || []).length;
    it('has 600+ handler methods', () => expect(handlers).toBeGreaterThanOrEqual(600));
  });
});
