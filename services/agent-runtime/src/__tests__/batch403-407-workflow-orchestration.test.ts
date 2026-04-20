import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 403-407: Workflow & Orchestration', () => {

  describe('Batch 403 — Workflow Orchestrator', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620400000_agent_workflow_orchestrator.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-workflow-orchestrator.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/workflow-orchestrator/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_workflow_orchestrator_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_workflow_orchestrator_configs'); });
    test('migration creates agent_workflows', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_workflows'); });
    test('migration creates agent_workflow_steps', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_workflow_steps'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports WorkflowOrchestratorConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('WorkflowOrchestratorConfig'); });
    test('types exports WorkflowStatus', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('WorkflowStatus'); });
    test('types exports StepType', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('StepType'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has create-workflow', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('create-workflow'); });
  });

  describe('Batch 404 — Pipeline Scheduler', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620410000_agent_pipeline_scheduler.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-pipeline-scheduler.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/pipeline-scheduler/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_pipeline_scheduler_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_pipeline_scheduler_configs'); });
    test('migration creates agent_pipelines', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_pipelines'); });
    test('migration creates agent_pipeline_runs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_pipeline_runs'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports PipelineSchedulerConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('PipelineSchedulerConfig'); });
    test('types exports TriggerType', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('TriggerType'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has create-pipeline', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('create-pipeline'); });
  });

  describe('Batch 405 — Job Dispatcher', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620420000_agent_job_dispatcher.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-job-dispatcher.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/job-dispatcher/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_job_dispatcher_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_job_dispatcher_configs'); });
    test('migration creates agent_jobs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_jobs'); });
    test('migration creates agent_job_workers', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_job_workers'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports JobDispatcherConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('JobDispatcherConfig'); });
    test('types exports DispatchStrategy', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('DispatchStrategy'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has submit-job', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('submit-job'); });
  });

  describe('Batch 406 — Queue Manager', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620430000_agent_queue_manager.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-queue-manager.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/queue-manager/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_queue_manager_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_queue_manager_configs'); });
    test('migration creates agent_queues', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_queues'); });
    test('migration creates agent_queue_messages', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_queue_messages'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports QueueManagerConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('QueueManagerConfig'); });
    test('types exports QueueType', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('QueueType'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has create-queue', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('create-queue'); });
  });

  describe('Batch 407 — State Machine Engine', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620440000_agent_state_machine_engine.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-state-machine-engine.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/state-machine-engine/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_state_machine_engine_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_state_machine_engine_configs'); });
    test('migration creates agent_state_machines', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_state_machines'); });
    test('migration creates agent_state_transitions', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_state_transitions'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports StateMachineEngineConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('StateMachineEngineConfig'); });
    test('types exports MachineStatus', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('MachineStatus'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has create-machine', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('create-machine'); });
  });

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    const names = ['workflow-orchestrator','pipeline-scheduler','job-dispatcher','queue-manager','state-machine-engine'];
    names.forEach(n => {
      test('exports agent-' + n, () => { expect(idx).toContain("from './agent-" + n + "'"); });
    });
  });

  describe('Eidolon types.ts', () => {
    const c = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const bks = ['workflow_orchestrator','pipeline_scheduler','job_dispatcher','queue_manager','state_machine_engine'];
    bks.forEach(bk => {
      test('BK ' + bk, () => { expect(c).toContain("'" + bk + "'"); });
      test('districtFor case ' + bk, () => { expect(c).toContain("case '" + bk + "':"); });
    });
    const eks = ['wfor.workflow_started','ppsc.pipeline_scheduled','jbds.job_submitted','qumg.message_sent','smen.event_sent'];
    eks.forEach(ek => {
      test('EK ' + ek, () => { expect(c).toContain("'" + ek + "'"); });
    });
  });

  describe('SUBJECT_MAP', () => {
    const c = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.wfor.workflow_started','sven.wfor.step_completed','sven.wfor.workflow_completed','sven.wfor.workflow_failed',
      'sven.ppsc.pipeline_scheduled','sven.ppsc.run_started','sven.ppsc.run_completed','sven.ppsc.run_failed',
      'sven.jbds.job_submitted','sven.jbds.job_dispatched','sven.jbds.job_completed','sven.jbds.job_failed',
      'sven.qumg.message_sent','sven.qumg.message_received','sven.qumg.message_dead_lettered','sven.qumg.queue_purged',
      'sven.smen.event_sent','sven.smen.state_changed','sven.smen.machine_completed','sven.smen.guard_failed'
    ];
    subjects.forEach(s => {
      test('subject ' + s, () => { expect(c).toContain("'" + s + "'"); });
    });
  });

  describe('Task executor cases', () => {
    const c = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'wfor_create_workflow','wfor_start_workflow','wfor_pause_workflow','wfor_resume_workflow','wfor_get_status','wfor_cancel_workflow',
      'ppsc_create_pipeline','ppsc_trigger_pipeline','ppsc_update_schedule','ppsc_list_runs','ppsc_cancel_run','ppsc_enable_disable',
      'jbds_submit_job','jbds_dispatch_jobs','jbds_register_worker','jbds_worker_heartbeat','jbds_get_job_status','jbds_retry_failed',
      'qumg_create_queue','qumg_send_message','qumg_receive_messages','qumg_acknowledge_message','qumg_dead_letter','qumg_purge_queue',
      'smen_create_machine','smen_send_event','smen_get_state','smen_get_history','smen_pause_machine','smen_reset_machine'
    ];
    cases.forEach(cs => {
      test('case ' + cs, () => { expect(c).toContain("case '" + cs + "'"); });
    });
  });

  describe('.gitattributes', () => {
    const c = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    const files = [
      'agent_workflow_orchestrator.sql','agent_pipeline_scheduler.sql','agent_job_dispatcher.sql',
      'agent_queue_manager.sql','agent_state_machine_engine.sql',
      'agent-workflow-orchestrator.ts','agent-pipeline-scheduler.ts','agent-job-dispatcher.ts',
      'agent-queue-manager.ts','agent-state-machine-engine.ts',
      'workflow-orchestrator/SKILL.md','pipeline-scheduler/SKILL.md','job-dispatcher/SKILL.md',
      'queue-manager/SKILL.md','state-machine-engine/SKILL.md'
    ];
    files.forEach(f => {
      test('guards ' + f, () => { expect(c).toContain(f); });
    });
  });
});
