import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 333-337: Automation & Orchestration', () => {

  const migrations = [
    { file: '20260619700000_agent_workflow_engine.sql', tables: ['agent_workflow_engine_configs', 'agent_workflow_definitions', 'agent_workflow_executions'] },
    { file: '20260619710000_agent_task_scheduler.sql', tables: ['agent_task_scheduler_configs', 'agent_scheduled_jobs', 'agent_job_runs'] },
    { file: '20260619720000_agent_cron_manager.sql', tables: ['agent_cron_manager_configs', 'agent_cron_entries', 'agent_cron_logs'] },
    { file: '20260619730000_agent_job_orchestrator.sql', tables: ['agent_job_orchestrator_configs', 'agent_orchestrated_jobs', 'agent_job_dependencies'] },
    { file: '20260619740000_agent_batch_processor.sql', tables: ['agent_batch_processor_configs', 'agent_batch_jobs', 'agent_batch_items'] },
  ];

  describe('Migration SQL files', () => {
    for (const m of migrations) {
      it(`${m.file} exists`, () => { expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', m.file))).toBe(true); });
      for (const t of m.tables) {
        it(`${m.file} creates table ${t}`, () => {
          const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', m.file), 'utf-8');
          expect(sql).toContain(t);
        });
      }
    }
  });

  const typeFiles = [
    { file: 'agent-workflow-engine.ts', exports: ['ExecutionMode', 'WorkflowStatus', 'ExecutionStatus'] },
    { file: 'agent-task-scheduler.ts', exports: ['ScheduleStatus', 'JobRunStatus', 'ScheduleFrequency'] },
    { file: 'agent-cron-manager.ts', exports: ['CronStatus', 'CronLogStatus', 'CronInterval'] },
    { file: 'agent-job-orchestrator.ts', exports: ['RetryStrategy', 'OrchJobStatus', 'DependencyType'] },
    { file: 'agent-batch-processor.ts', exports: ['ProcessingMode', 'ErrorHandling', 'BatchJobStatus'] },
  ];

  describe('Shared type files', () => {
    for (const tf of typeFiles) {
      it(`${tf.file} exists`, () => { expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', tf.file))).toBe(true); });
      for (const exp of tf.exports) {
        it(`${tf.file} exports ${exp}`, () => { expect(fs.readFileSync(path.join(ROOT, 'packages/shared/src', tf.file), 'utf-8')).toContain(exp); });
      }
    }
  });

  describe('Barrel exports in index.ts', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    for (const b of ['agent-workflow-engine', 'agent-task-scheduler', 'agent-cron-manager', 'agent-job-orchestrator', 'agent-batch-processor']) {
      it(`exports ${b}`, () => { expect(idx).toContain(b); });
    }
  });

  const skills = [
    { dir: 'workflow-engine', price: '18.99', archetype: 'engineer' },
    { dir: 'task-scheduler', price: '12.99', archetype: 'engineer' },
    { dir: 'cron-manager', price: '9.99', archetype: 'engineer' },
    { dir: 'job-orchestrator', price: '22.99', archetype: 'engineer' },
    { dir: 'batch-processor', price: '16.99', archetype: 'engineer' },
  ];

  describe('SKILL.md files', () => {
    for (const s of skills) {
      const p = path.join(ROOT, 'skills/autonomous-economy', s.dir, 'SKILL.md');
      it(`${s.dir}/SKILL.md exists`, () => { expect(fs.existsSync(p)).toBe(true); });
      it(`${s.dir}/SKILL.md has correct price`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.price); });
      it(`${s.dir}/SKILL.md has correct archetype`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.archetype); });
      it(`${s.dir}/SKILL.md has Actions section`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain('## Actions'); });
    }
  });

  describe('Eidolon types.ts', () => {
    const tc = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    for (const bk of ['workflow_engine', 'task_scheduler', 'cron_manager', 'job_orchestrator', 'batch_processor']) {
      it(`has BK '${bk}'`, () => { expect(tc).toContain(`'${bk}'`); });
    }
    for (const ek of ['wfen.workflow_created', 'tskd.job_scheduled', 'crmg.cron_triggered', 'jorc.job_submitted', 'btpr.batch_started']) {
      it(`has EK '${ek}'`, () => { expect(tc).toContain(`'${ek}'`); });
    }
    for (const bk of ['workflow_engine', 'task_scheduler', 'cron_manager', 'job_orchestrator', 'batch_processor']) {
      it(`has districtFor case '${bk}'`, () => { expect(tc).toContain(`case '${bk}':`); });
    }
  });

  describe('Event bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.wfen.workflow_created', 'sven.wfen.workflow_executed', 'sven.wfen.step_completed', 'sven.wfen.execution_failed',
      'sven.tskd.job_scheduled', 'sven.tskd.job_executed', 'sven.tskd.job_failed', 'sven.tskd.schedule_paused',
      'sven.crmg.cron_triggered', 'sven.crmg.cron_failed', 'sven.crmg.entry_created', 'sven.crmg.entry_disabled',
      'sven.jorc.job_submitted', 'sven.jorc.job_completed', 'sven.jorc.job_dead_letter', 'sven.jorc.deps_resolved',
      'sven.btpr.batch_started', 'sven.btpr.batch_completed', 'sven.btpr.item_failed', 'sven.btpr.progress_updated',
    ];
    for (const s of subjects) {
      it(`has subject '${s}'`, () => { expect(bus).toContain(`'${s}'`); });
    }
  });

  describe('Task executor', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'wfen_create_workflow', 'wfen_execute_workflow', 'wfen_monitor_execution', 'wfen_pause_workflow', 'wfen_clone_workflow', 'wfen_analyze_performance',
      'tskd_create_schedule', 'tskd_list_schedules', 'tskd_update_schedule', 'tskd_pause_schedule', 'tskd_view_history', 'tskd_predict_runs',
      'crmg_add_cron', 'crmg_validate_expression', 'crmg_list_crons', 'crmg_view_logs', 'crmg_toggle_status', 'crmg_bulk_manage',
      'jorc_submit_job', 'jorc_build_dag', 'jorc_monitor_jobs', 'jorc_retry_failed', 'jorc_inspect_dead_letter', 'jorc_rebalance_workers',
      'btpr_create_batch', 'btpr_process_batch', 'btpr_monitor_progress', 'btpr_pause_batch', 'btpr_retry_failed', 'btpr_export_results',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => { expect(exec).toContain(`case '${c}'`); });
    }
    for (const h of ['handleWfenCreateWorkflow', 'handleTskdCreateSchedule', 'handleCrmgAddCron', 'handleJorcSubmitJob', 'handleBtprCreateBatch']) {
      it(`has handler ${h}`, () => { expect(exec).toContain(h); });
    }
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    for (const e of [
      'agent_workflow_engine.sql', 'agent_task_scheduler.sql', 'agent_cron_manager.sql', 'agent_job_orchestrator.sql', 'agent_batch_processor.sql',
      'agent-workflow-engine.ts', 'agent-task-scheduler.ts', 'agent-cron-manager.ts', 'agent-job-orchestrator.ts', 'agent-batch-processor.ts',
      'workflow-engine/SKILL.md', 'task-scheduler/SKILL.md', 'cron-manager/SKILL.md', 'job-orchestrator/SKILL.md', 'batch-processor/SKILL.md',
    ]) {
      it(`has entry for ${e}`, () => { expect(ga).toContain(e); });
    }
  });
});
