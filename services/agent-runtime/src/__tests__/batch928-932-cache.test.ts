import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 928-932: Cache Operations', () => {
  const verticals = [
    {
      name: 'cache_namespace_provisioner', migration: '20260625650000_agent_cache_namespace_provisioner.sql',
      typeFile: 'agent-cache-namespace-provisioner.ts', skillDir: 'cache-namespace-provisioner',
      interfaces: ['CacheNamespaceProvisionerConfig', 'NamespaceRequest', 'ProvisionerEvent'],
      bk: 'cache_namespace_provisioner', eks: ['cnpv.request_received', 'cnpv.quota_evaluated', 'cnpv.namespace_created', 'cnpv.audit_recorded'],
      subjects: ['sven.cnpv.request_received', 'sven.cnpv.quota_evaluated', 'sven.cnpv.namespace_created', 'sven.cnpv.audit_recorded'],
      cases: ['cnpv_receive', 'cnpv_evaluate', 'cnpv_create', 'cnpv_audit', 'cnpv_report', 'cnpv_monitor'],
    },
    {
      name: 'cache_warming_orchestrator', migration: '20260625660000_agent_cache_warming_orchestrator.sql',
      typeFile: 'agent-cache-warming-orchestrator.ts', skillDir: 'cache-warming-orchestrator',
      interfaces: ['CacheWarmingOrchestratorConfig', 'WarmingPlan', 'OrchestratorEvent'],
      bk: 'cache_warming_orchestrator', eks: ['cwor.plan_received', 'cwor.keys_resolved', 'cwor.values_loaded', 'cwor.outcome_recorded'],
      subjects: ['sven.cwor.plan_received', 'sven.cwor.keys_resolved', 'sven.cwor.values_loaded', 'sven.cwor.outcome_recorded'],
      cases: ['cwor_receive', 'cwor_resolve', 'cwor_load', 'cwor_record', 'cwor_report', 'cwor_monitor'],
    },
    {
      name: 'cache_eviction_policy_runner', migration: '20260625670000_agent_cache_eviction_policy_runner.sql',
      typeFile: 'agent-cache-eviction-policy-runner.ts', skillDir: 'cache-eviction-policy-runner',
      interfaces: ['CacheEvictionPolicyRunnerConfig', 'EvictionRound', 'RunnerEvent'],
      bk: 'cache_eviction_policy_runner', eks: ['cepr.round_started', 'cepr.policy_evaluated', 'cepr.entries_evicted', 'cepr.metrics_recorded'],
      subjects: ['sven.cepr.round_started', 'sven.cepr.policy_evaluated', 'sven.cepr.entries_evicted', 'sven.cepr.metrics_recorded'],
      cases: ['cepr_start', 'cepr_evaluate', 'cepr_evict', 'cepr_record', 'cepr_report', 'cepr_monitor'],
    },
    {
      name: 'cache_consistency_validator', migration: '20260625680000_agent_cache_consistency_validator.sql',
      typeFile: 'agent-cache-consistency-validator.ts', skillDir: 'cache-consistency-validator',
      interfaces: ['CacheConsistencyValidatorConfig', 'ConsistencyCheck', 'ValidatorEvent'],
      bk: 'cache_consistency_validator', eks: ['ccsv.check_scheduled', 'ccsv.samples_compared', 'ccsv.divergence_flagged', 'ccsv.report_emitted'],
      subjects: ['sven.ccsv.check_scheduled', 'sven.ccsv.samples_compared', 'sven.ccsv.divergence_flagged', 'sven.ccsv.report_emitted'],
      cases: ['ccsv_schedule', 'ccsv_compare', 'ccsv_flag', 'ccsv_emit', 'ccsv_report', 'ccsv_monitor'],
    },
    {
      name: 'cache_hit_ratio_reporter', migration: '20260625690000_agent_cache_hit_ratio_reporter.sql',
      typeFile: 'agent-cache-hit-ratio-reporter.ts', skillDir: 'cache-hit-ratio-reporter',
      interfaces: ['CacheHitRatioReporterConfig', 'RatioWindow', 'ReporterEvent'],
      bk: 'cache_hit_ratio_reporter', eks: ['chrr.window_received', 'chrr.counters_aggregated', 'chrr.ratio_computed', 'chrr.report_emitted'],
      subjects: ['sven.chrr.window_received', 'sven.chrr.counters_aggregated', 'sven.chrr.ratio_computed', 'sven.chrr.report_emitted'],
      cases: ['chrr_receive', 'chrr_aggregate', 'chrr_compute', 'chrr_emit', 'chrr_report', 'chrr_monitor'],
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
