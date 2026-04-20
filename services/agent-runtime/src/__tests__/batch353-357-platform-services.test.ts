import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ─── helpers ───
function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}
function migrationPath(ts: string, name: string): string {
  return `services/gateway-api/migrations/${ts}_agent_${name}.sql`;
}

// ════════════════════════════════════════════════════════════
// Batch 353 — Event Replayer
// ════════════════════════════════════════════════════════════
describe('Batch 353 — Event Replayer', () => {
  const sql = readFile(migrationPath('20260619900000', 'event_replayer'));
  const types = readFile('packages/shared/src/agent-event-replayer.ts');
  const skill = readFile('skills/autonomous-economy/event-replayer/SKILL.md');

  describe('Migration', () => {
    it('creates agent_event_replayer_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_event_replayer_configs'));
    it('creates agent_replay_sessions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_replay_sessions'));
    it('creates agent_replay_checkpoints table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_replay_checkpoints'));
    it('has agent_id column', () => expect(sql).toContain('agent_id'));
    it('has created_at column', () => expect(sql).toContain('created_at'));
    it('has updated_at column', () => expect(sql).toContain('updated_at'));
  });

  describe('Shared types', () => {
    it('exports ReplayMode', () => expect(types).toContain('ReplayMode'));
    it('exports ReplayStatus', () => expect(types).toContain('ReplayStatus'));
    it('exports SessionStatus', () => expect(types).toContain('SessionStatus'));
    it('exports EventFilterType', () => expect(types).toContain('EventFilterType'));
    it('exports EventReplayerConfig', () => expect(types).toContain('EventReplayerConfig'));
    it('exports ReplaySession', () => expect(types).toContain('ReplaySession'));
    it('exports ReplayCheckpoint', () => expect(types).toContain('ReplayCheckpoint'));
  });

  describe('SKILL.md', () => {
    it('has title', () => expect(skill).toContain('Event Replayer'));
    it('has pricing', () => expect(skill).toContain('12.99'));
    it('has archetype', () => expect(skill).toContain('engineer'));
    it('has actions section', () => expect(skill).toContain('## Actions'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-event-replayer', () => expect(idx).toContain('agent-event-replayer'));
  });
});

// ════════════════════════════════════════════════════════════
// Batch 354 — Cache Warmer
// ════════════════════════════════════════════════════════════
describe('Batch 354 — Cache Warmer', () => {
  const sql = readFile(migrationPath('20260619910000', 'cache_warmer'));
  const types = readFile('packages/shared/src/agent-cache-warmer.ts');
  const skill = readFile('skills/autonomous-economy/cache-warmer/SKILL.md');

  describe('Migration', () => {
    it('creates agent_cache_warmer_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_cache_warmer_configs'));
    it('creates agent_cache_entries table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_cache_entries'));
    it('creates agent_cache_stats table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_cache_stats'));
    it('has agent_id column', () => expect(sql).toContain('agent_id'));
    it('has created_at column', () => expect(sql).toContain('created_at'));
    it('has updated_at column', () => expect(sql).toContain('updated_at'));
  });

  describe('Shared types', () => {
    it('exports CacheBackend', () => expect(types).toContain('CacheBackend'));
    it('exports WarmupStrategy', () => expect(types).toContain('WarmupStrategy'));
    it('exports CacheEntryStatus', () => expect(types).toContain('CacheEntryStatus'));
    it('exports EvictionPolicy', () => expect(types).toContain('EvictionPolicy'));
    it('exports CacheWarmerConfig', () => expect(types).toContain('CacheWarmerConfig'));
    it('exports CacheEntry', () => expect(types).toContain('CacheEntry'));
    it('exports CacheStats', () => expect(types).toContain('CacheStats'));
  });

  describe('SKILL.md', () => {
    it('has title', () => expect(skill).toContain('Cache Warmer'));
    it('has pricing', () => expect(skill).toContain('10.99'));
    it('has archetype', () => expect(skill).toContain('engineer'));
    it('has actions section', () => expect(skill).toContain('## Actions'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-cache-warmer', () => expect(idx).toContain('agent-cache-warmer'));
  });
});

// ════════════════════════════════════════════════════════════
// Batch 355 — Job Scheduler
// ════════════════════════════════════════════════════════════
describe('Batch 355 — Job Scheduler', () => {
  const sql = readFile(migrationPath('20260619920000', 'job_scheduler'));
  const types = readFile('packages/shared/src/agent-job-scheduler.ts');
  const skill = readFile('skills/autonomous-economy/job-scheduler/SKILL.md');

  describe('Migration', () => {
    it('creates agent_job_scheduler_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_job_scheduler_configs'));
    it('creates agent_scheduled_jobs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_scheduled_jobs'));
    it('creates agent_job_executions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_job_executions'));
    it('has agent_id column', () => expect(sql).toContain('agent_id'));
    it('has created_at column', () => expect(sql).toContain('created_at'));
    it('has updated_at column', () => expect(sql).toContain('updated_at'));
  });

  describe('Shared types', () => {
    it('exports SchedulerType', () => expect(types).toContain('SchedulerType'));
    it('exports RetryPolicy', () => expect(types).toContain('RetryPolicy'));
    it('exports JobStatus', () => expect(types).toContain('JobStatus'));
    it('exports ExecutionStatus', () => expect(types).toContain('ExecutionStatus'));
    it('exports JobSchedulerConfig', () => expect(types).toContain('JobSchedulerConfig'));
    it('exports ScheduledJob', () => expect(types).toContain('ScheduledJob'));
    it('exports JobExecution', () => expect(types).toContain('JobExecution'));
  });

  describe('SKILL.md', () => {
    it('has title', () => expect(skill).toContain('Job Scheduler'));
    it('has pricing', () => expect(skill).toContain('15.99'));
    it('has archetype', () => expect(skill).toContain('engineer'));
    it('has actions section', () => expect(skill).toContain('## Actions'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-job-scheduler', () => expect(idx).toContain('agent-job-scheduler'));
  });
});

// ════════════════════════════════════════════════════════════
// Batch 356 — Feature Toggle
// ════════════════════════════════════════════════════════════
describe('Batch 356 — Feature Toggle', () => {
  const sql = readFile(migrationPath('20260619930000', 'feature_toggle'));
  const types = readFile('packages/shared/src/agent-feature-toggle.ts');
  const skill = readFile('skills/autonomous-economy/feature-toggle/SKILL.md');

  describe('Migration', () => {
    it('creates agent_feature_toggle_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_feature_toggle_configs'));
    it('creates agent_feature_flags table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_feature_flags'));
    it('creates agent_flag_evaluations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_flag_evaluations'));
    it('has agent_id column', () => expect(sql).toContain('agent_id'));
    it('has created_at column', () => expect(sql).toContain('created_at'));
    it('has updated_at column', () => expect(sql).toContain('updated_at'));
  });

  describe('Shared types', () => {
    it('exports RolloutStrategy', () => expect(types).toContain('RolloutStrategy'));
    it('exports FlagType', () => expect(types).toContain('FlagType'));
    it('exports FlagStatus', () => expect(types).toContain('FlagStatus'));
    it('exports ToggleAction', () => expect(types).toContain('ToggleAction'));
    it('exports FeatureToggleConfig', () => expect(types).toContain('FeatureToggleConfig'));
    it('exports FeatureFlag', () => expect(types).toContain('FeatureFlag'));
    it('exports FlagEvaluation', () => expect(types).toContain('FlagEvaluation'));
  });

  describe('SKILL.md', () => {
    it('has title', () => expect(skill).toContain('Feature Toggle'));
    it('has pricing', () => expect(skill).toContain('11.99'));
    it('has archetype', () => expect(skill).toContain('engineer'));
    it('has actions section', () => expect(skill).toContain('## Actions'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-feature-toggle', () => expect(idx).toContain('agent-feature-toggle'));
  });
});

// ════════════════════════════════════════════════════════════
// Batch 357 — Data Migrator
// ════════════════════════════════════════════════════════════
describe('Batch 357 — Data Migrator', () => {
  const sql = readFile(migrationPath('20260619940000', 'data_migrator'));
  const types = readFile('packages/shared/src/agent-data-migrator.ts');
  const skill = readFile('skills/autonomous-economy/data-migrator/SKILL.md');

  describe('Migration', () => {
    it('creates agent_data_migrator_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_data_migrator_configs'));
    it('creates agent_migration_plans table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_migration_plans'));
    it('creates agent_migration_runs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_migration_runs'));
    it('has agent_id column', () => expect(sql).toContain('agent_id'));
    it('has created_at column', () => expect(sql).toContain('created_at'));
    it('has updated_at column', () => expect(sql).toContain('updated_at'));
  });

  describe('Shared types', () => {
    it('exports SourceType', () => expect(types).toContain('SourceType'));
    it('exports MigrationMode', () => expect(types).toContain('MigrationMode'));
    it('exports MigrationPlanStatus', () => expect(types).toContain('MigrationPlanStatus'));
    it('exports RunStatus', () => expect(types).toContain('RunStatus'));
    it('exports DataMigratorConfig', () => expect(types).toContain('DataMigratorConfig'));
    it('exports MigrationPlan', () => expect(types).toContain('MigrationPlan'));
    it('exports MigrationRun', () => expect(types).toContain('MigrationRun'));
  });

  describe('SKILL.md', () => {
    it('has title', () => expect(skill).toContain('Data Migrator'));
    it('has pricing', () => expect(skill).toContain('18.99'));
    it('has archetype', () => expect(skill).toContain('engineer'));
    it('has actions section', () => expect(skill).toContain('## Actions'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-data-migrator', () => expect(idx).toContain('agent-data-migrator'));
  });
});

// ════════════════════════════════════════════════════════════
// Cross-cutting: Eidolon wiring
// ════════════════════════════════════════════════════════════
describe('Eidolon wiring — Batches 353-357', () => {
  const eidolonTypes = readFile('services/sven-eidolon/src/types.ts');
  const eventBus = readFile('services/sven-eidolon/src/event-bus.ts');

  describe('BuildingKind (BK)', () => {
    it('includes event_replayer', () => expect(eidolonTypes).toContain("'event_replayer'"));
    it('includes cache_warmer', () => expect(eidolonTypes).toContain("'cache_warmer'"));
    it('includes job_scheduler', () => expect(eidolonTypes).toContain("'job_scheduler'"));
    it('includes feature_toggle', () => expect(eidolonTypes).toContain("'feature_toggle'"));
    it('includes data_migrator', () => expect(eidolonTypes).toContain("'data_migrator'"));
  });

  describe('EventKind (EK)', () => {
    it('has evrp.stream_replayed', () => expect(eidolonTypes).toContain("'evrp.stream_replayed'"));
    it('has evrp.checkpoint_saved', () => expect(eidolonTypes).toContain("'evrp.checkpoint_saved'"));
    it('has evrp.session_completed', () => expect(eidolonTypes).toContain("'evrp.session_completed'"));
    it('has evrp.filter_applied', () => expect(eidolonTypes).toContain("'evrp.filter_applied'"));
    it('has cwrm.cache_warmed', () => expect(eidolonTypes).toContain("'cwrm.cache_warmed'"));
    it('has cwrm.entries_evicted', () => expect(eidolonTypes).toContain("'cwrm.entries_evicted'"));
    it('has cwrm.hit_rate_analyzed', () => expect(eidolonTypes).toContain("'cwrm.hit_rate_analyzed'"));
    it('has cwrm.strategy_updated', () => expect(eidolonTypes).toContain("'cwrm.strategy_updated'"));
    it('has jbsc.job_scheduled', () => expect(eidolonTypes).toContain("'jbsc.job_scheduled'"));
    it('has jbsc.job_completed', () => expect(eidolonTypes).toContain("'jbsc.job_completed'"));
    it('has jbsc.job_failed', () => expect(eidolonTypes).toContain("'jbsc.job_failed'"));
    it('has jbsc.retry_triggered', () => expect(eidolonTypes).toContain("'jbsc.retry_triggered'"));
    it('has fttg.flag_created', () => expect(eidolonTypes).toContain("'fttg.flag_created'"));
    it('has fttg.flag_evaluated', () => expect(eidolonTypes).toContain("'fttg.flag_evaluated'"));
    it('has fttg.rollout_updated', () => expect(eidolonTypes).toContain("'fttg.rollout_updated'"));
    it('has fttg.flag_archived', () => expect(eidolonTypes).toContain("'fttg.flag_archived'"));
    it('has dtmg.plan_created', () => expect(eidolonTypes).toContain("'dtmg.plan_created'"));
    it('has dtmg.migration_started', () => expect(eidolonTypes).toContain("'dtmg.migration_started'"));
    it('has dtmg.migration_completed', () => expect(eidolonTypes).toContain("'dtmg.migration_completed'"));
    it('has dtmg.rollback_executed', () => expect(eidolonTypes).toContain("'dtmg.rollback_executed'"));
  });

  describe('districtFor cases', () => {
    it('has event_replayer case', () => expect(eidolonTypes).toContain("case 'event_replayer':"));
    it('has cache_warmer case', () => expect(eidolonTypes).toContain("case 'cache_warmer':"));
    it('has job_scheduler case', () => expect(eidolonTypes).toContain("case 'job_scheduler':"));
    it('has feature_toggle case', () => expect(eidolonTypes).toContain("case 'feature_toggle':"));
    it('has data_migrator case', () => expect(eidolonTypes).toContain("case 'data_migrator':"));
  });

  describe('SUBJECT_MAP entries', () => {
    it('maps sven.evrp.stream_replayed', () => expect(eventBus).toContain("'sven.evrp.stream_replayed'"));
    it('maps sven.evrp.checkpoint_saved', () => expect(eventBus).toContain("'sven.evrp.checkpoint_saved'"));
    it('maps sven.evrp.session_completed', () => expect(eventBus).toContain("'sven.evrp.session_completed'"));
    it('maps sven.evrp.filter_applied', () => expect(eventBus).toContain("'sven.evrp.filter_applied'"));
    it('maps sven.cwrm.cache_warmed', () => expect(eventBus).toContain("'sven.cwrm.cache_warmed'"));
    it('maps sven.cwrm.entries_evicted', () => expect(eventBus).toContain("'sven.cwrm.entries_evicted'"));
    it('maps sven.cwrm.hit_rate_analyzed', () => expect(eventBus).toContain("'sven.cwrm.hit_rate_analyzed'"));
    it('maps sven.cwrm.strategy_updated', () => expect(eventBus).toContain("'sven.cwrm.strategy_updated'"));
    it('maps sven.jbsc.job_scheduled', () => expect(eventBus).toContain("'sven.jbsc.job_scheduled'"));
    it('maps sven.jbsc.job_completed', () => expect(eventBus).toContain("'sven.jbsc.job_completed'"));
    it('maps sven.jbsc.job_failed', () => expect(eventBus).toContain("'sven.jbsc.job_failed'"));
    it('maps sven.jbsc.retry_triggered', () => expect(eventBus).toContain("'sven.jbsc.retry_triggered'"));
    it('maps sven.fttg.flag_created', () => expect(eventBus).toContain("'sven.fttg.flag_created'"));
    it('maps sven.fttg.flag_evaluated', () => expect(eventBus).toContain("'sven.fttg.flag_evaluated'"));
    it('maps sven.fttg.rollout_updated', () => expect(eventBus).toContain("'sven.fttg.rollout_updated'"));
    it('maps sven.fttg.flag_archived', () => expect(eventBus).toContain("'sven.fttg.flag_archived'"));
    it('maps sven.dtmg.plan_created', () => expect(eventBus).toContain("'sven.dtmg.plan_created'"));
    it('maps sven.dtmg.migration_started', () => expect(eventBus).toContain("'sven.dtmg.migration_started'"));
    it('maps sven.dtmg.migration_completed', () => expect(eventBus).toContain("'sven.dtmg.migration_completed'"));
    it('maps sven.dtmg.rollback_executed', () => expect(eventBus).toContain("'sven.dtmg.rollback_executed'"));
  });
});

// ════════════════════════════════════════════════════════════
// Cross-cutting: Task Executor
// ════════════════════════════════════════════════════════════
describe('Task Executor — Batches 353-357', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');

  describe('Switch cases', () => {
    const cases = [
      'evrp_replay_stream', 'evrp_create_checkpoint', 'evrp_filter_events',
      'evrp_analyze_replay', 'evrp_compare_runs', 'evrp_export_events',
      'cwrm_warm_cache', 'cwrm_analyze_hit_rate', 'cwrm_configure_ttl',
      'cwrm_evict_stale', 'cwrm_predict_access', 'cwrm_export_stats',
      'jbsc_schedule_job', 'jbsc_run_job', 'jbsc_pause_job',
      'jbsc_retry_failed', 'jbsc_list_executions', 'jbsc_analyze_performance',
      'fttg_create_flag', 'fttg_evaluate_flag', 'fttg_update_rollout',
      'fttg_archive_flag', 'fttg_list_evaluations', 'fttg_analyze_impact',
      'dtmg_create_plan', 'dtmg_validate_plan', 'dtmg_execute_migration',
      'dtmg_rollback_migration', 'dtmg_compare_schemas', 'dtmg_export_report',
    ];
    cases.forEach(c => {
      it(`routes ${c}`, () => expect(te).toContain(`case '${c}'`));
    });
  });

  describe('Handler methods', () => {
    const handlers = [
      'handleEvrpReplayStream', 'handleEvrpCreateCheckpoint', 'handleEvrpFilterEvents',
      'handleEvrpAnalyzeReplay', 'handleEvrpCompareRuns', 'handleEvrpExportEvents',
      'handleCwrmWarmCache', 'handleCwrmAnalyzeHitRate', 'handleCwrmConfigureTtl',
      'handleCwrmEvictStale', 'handleCwrmPredictAccess', 'handleCwrmExportStats',
      'handleJbscScheduleJob', 'handleJbscRunJob', 'handleJbscPauseJob',
      'handleJbscRetryFailed', 'handleJbscListExecutions', 'handleJbscAnalyzePerformance',
      'handleFttgCreateFlag', 'handleFttgEvaluateFlag', 'handleFttgUpdateRollout',
      'handleFttgArchiveFlag', 'handleFttgListEvaluations', 'handleFttgAnalyzeImpact',
      'handleDtmgCreatePlan', 'handleDtmgValidatePlan', 'handleDtmgExecuteMigration',
      'handleDtmgRollbackMigration', 'handleDtmgCompareSchemas', 'handleDtmgExportReport',
    ];
    handlers.forEach(h => {
      it(`has ${h}`, () => expect(te).toContain(h));
    });
  });
});

// ════════════════════════════════════════════════════════════
// Cross-cutting: .gitattributes
// ════════════════════════════════════════════════════════════
describe('.gitattributes — Batches 353-357', () => {
  const ga = readFile('.gitattributes');
  const entries = [
    '20260619900000_agent_event_replayer.sql',
    '20260619910000_agent_cache_warmer.sql',
    '20260619920000_agent_job_scheduler.sql',
    '20260619930000_agent_feature_toggle.sql',
    '20260619940000_agent_data_migrator.sql',
    'agent-event-replayer.ts',
    'agent-cache-warmer.ts',
    'agent-job-scheduler.ts',
    'agent-feature-toggle.ts',
    'agent-data-migrator.ts',
    'event-replayer/SKILL.md',
    'cache-warmer/SKILL.md',
    'job-scheduler/SKILL.md',
    'feature-toggle/SKILL.md',
    'data-migrator/SKILL.md',
  ];
  entries.forEach(e => {
    it(`guards ${e}`, () => expect(ga).toContain(e));
  });
});
