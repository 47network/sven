import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const VERTICALS = [
  {
    name: 'payload_transformer',
    migration: '20260620650000_agent_payload_transformer.sql',
    typeFile: 'agent-payload-transformer.ts',
    skillDir: 'payload-transformer',
    prefix: 'pytr',
    bk: 'payload_transformer',
    eks: ['pytr.transform_completed','pytr.validation_passed','pytr.rule_created','pytr.batch_processed'],
    cases: ['pytr_transform','pytr_validate','pytr_create_rule','pytr_batch_transform','pytr_inspect','pytr_test_rule'],
    handlers: ['handlePytrTransform','handlePytrValidate','handlePytrCreateRule','handlePytrBatchTransform','handlePytrInspect','handlePytrTestRule'],
    interfaces: ['PayloadTransformerConfig','TransformRule','TransformLog'],
    types: ['PayloadFormat','TransformStatus'],
  },
  {
    name: 'queue_orchestrator',
    migration: '20260620660000_agent_queue_orchestrator.sql',
    typeFile: 'agent-queue-orchestrator.ts',
    skillDir: 'queue-orchestrator',
    prefix: 'qorc',
    bk: 'queue_orchestrator',
    eks: ['qorc.queue_created','qorc.queue_drained','qorc.rebalance_completed','qorc.dead_letter_moved'],
    cases: ['qorc_create_queue','qorc_pause_queue','qorc_drain_queue','qorc_delete_queue','qorc_inspect','qorc_rebalance'],
    handlers: ['handleQorcCreateQueue','handleQorcPauseQueue','handleQorcDrainQueue','handleQorcDeleteQueue','handleQorcInspect','handleQorcRebalance'],
    interfaces: ['QueueOrchestratorConfig','ManagedQueue','QueueMetrics'],
    types: ['QueueBackend','QueueStatus'],
  },
  {
    name: 'data_pipeline_runner',
    migration: '20260620670000_agent_data_pipeline_runner.sql',
    typeFile: 'agent-data-pipeline-runner.ts',
    skillDir: 'data-pipeline-runner',
    prefix: 'dpln',
    bk: 'data_pipeline_runner',
    eks: ['dpln.pipeline_created','dpln.run_completed','dpln.step_finished','dpln.schedule_set'],
    cases: ['dpln_create_pipeline','dpln_run_pipeline','dpln_schedule','dpln_pause','dpln_get_status','dpln_cancel_run'],
    handlers: ['handleDplnCreatePipeline','handleDplnRunPipeline','handleDplnSchedule','handleDplnPause','handleDplnGetStatus','handleDplnCancelRun'],
    interfaces: ['DataPipelineRunnerConfig','Pipeline','PipelineRun'],
    types: ['RetryPolicy','PipelineStatus','PipelineRunStatus'],
  },
  {
    name: 'message_broker_admin',
    migration: '20260620680000_agent_message_broker_admin.sql',
    typeFile: 'agent-message-broker-admin.ts',
    skillDir: 'message-broker-admin',
    prefix: 'mbka',
    bk: 'message_broker_admin',
    eks: ['mbka.health_checked','mbka.topic_created','mbka.partition_rebalanced','mbka.alert_triggered'],
    cases: ['mbka_health_check','mbka_create_topic','mbka_delete_topic','mbka_list_topics','mbka_monitor','mbka_rebalance'],
    handlers: ['handleMbkaHealthCheck','handleMbkaCreateTopic','handleMbkaDeleteTopic','handleMbkaListTopics','handleMbkaMonitor','handleMbkaRebalance'],
    interfaces: ['MessageBrokerAdminConfig','BrokerTopic','BrokerHealthCheck'],
    types: ['BrokerType','TopicStatus','BrokerHealthStatus'],
  },
  {
    name: 'retry_scheduler',
    migration: '20260620690000_agent_retry_scheduler.sql',
    typeFile: 'agent-retry-scheduler.ts',
    skillDir: 'retry-scheduler',
    prefix: 'rtsc',
    bk: 'retry_scheduler',
    eks: ['rtsc.policy_created','rtsc.retry_succeeded','rtsc.retry_exhausted','rtsc.failure_analyzed'],
    cases: ['rtsc_create_policy','rtsc_schedule_retry','rtsc_cancel_retry','rtsc_get_status','rtsc_analyze_failures','rtsc_bulk_retry'],
    handlers: ['handleRtscCreatePolicy','handleRtscScheduleRetry','handleRtscCancelRetry','handleRtscGetStatus','handleRtscAnalyzeFailures','handleRtscBulkRetry'],
    interfaces: ['RetrySchedulerConfig','RetryPolicyDef','RetryAttempt'],
    types: ['BackoffStrategy','RetryAttemptStatus'],
  },
];

/* ── helpers ── */
function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}
function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

const typesTs   = readFile('services/sven-eidolon/src/types.ts');
const eventBus  = readFile('services/sven-eidolon/src/event-bus.ts');
const taskExec  = readFile('services/sven-marketplace/src/task-executor.ts');
const barrel    = readFile('packages/shared/src/index.ts');

/* ── tests ── */
describe.each(VERTICALS)('Batch 428-432 · $name', (v) => {

  /* 1 — migration */
  describe('migration', () => {
    const sql = readFile(`services/gateway-api/migrations/${v.migration}`);
    it('file exists', () => expect(sql.length).toBeGreaterThan(0));
    it('creates config table', () => expect(sql).toContain(`agent_${v.name}_configs`));
    it('has agent_id column', () => expect(sql).toContain('agent_id'));
    it('has created_at', () => expect(sql).toContain('created_at'));
    it('has index', () => expect(sql).toContain('CREATE INDEX'));
  });

  /* 2 — shared type file */
  describe('types', () => {
    const src = readFile(`packages/shared/src/${v.typeFile}`);
    it('file exists', () => expect(src.length).toBeGreaterThan(0));
    v.interfaces.forEach((iface) => {
      it(`exports ${iface}`, () => expect(src).toContain(`export interface ${iface}`));
    });
    v.types.forEach((t) => {
      it(`exports ${t}`, () => expect(src).toContain(`export type ${t}`));
    });
  });

  /* 3 — barrel export */
  it('barrel exports type file', () => {
    expect(barrel).toContain(`from './${v.typeFile.replace('.ts', '')}'`);
  });

  /* 4 — SKILL.md */
  describe('SKILL.md', () => {
    const md = readFile(`skills/autonomous-economy/${v.skillDir}/SKILL.md`);
    it('exists', () => expect(md.length).toBeGreaterThan(0));
    it('has name', () => expect(md).toContain(`name: ${v.skillDir}`));
    it('has actions', () => expect(md).toContain('## Actions'));
    it('has pricing', () => expect(md).toContain('pricing:'));
  });

  /* 5 — Eidolon BK */
  it('BK contains value', () => expect(typesTs).toContain(`'${v.bk}'`));

  /* 6 — Eidolon EK */
  describe('EK', () => {
    v.eks.forEach((ek) => {
      it(`has ${ek}`, () => expect(typesTs).toContain(`'${ek}'`));
    });
  });

  /* 7 — districtFor */
  it('districtFor has case', () => expect(typesTs).toContain(`case '${v.bk}':`));

  /* 8 — SUBJECT_MAP */
  describe('SUBJECT_MAP', () => {
    v.eks.forEach((ek) => {
      it(`maps sven.${ek}`, () => expect(eventBus).toContain(`'sven.${ek}': '${ek}'`));
    });
  });

  /* 9 — task-executor cases */
  describe('task-executor cases', () => {
    v.cases.forEach((c) => {
      it(`routes ${c}`, () => expect(taskExec).toContain(`case '${c}'`));
    });
  });

  /* 10 — task-executor handlers */
  describe('task-executor handlers', () => {
    v.handlers.forEach((h) => {
      it(`has ${h}`, () => expect(taskExec).toContain(h));
    });
  });
});
