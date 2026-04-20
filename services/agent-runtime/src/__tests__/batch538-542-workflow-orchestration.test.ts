import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 538-542: Workflow & Orchestration', () => {
  const verticals = [
    {
      name: 'pipeline_executor', migration: '20260621750000_agent_pipeline_executor.sql',
      typeFile: 'agent-pipeline-executor.ts', skillDir: 'pipeline-executor',
      interfaces: ['PipelineExecutorConfig', 'PipelineRun', 'StepResult'],
      bk: 'pipeline_executor', eks: ['plex.run_started', 'plex.step_completed', 'plex.run_finished', 'plex.run_failed'],
      subjects: ['sven.plex.run_started', 'sven.plex.step_completed', 'sven.plex.run_finished', 'sven.plex.run_failed'],
      cases: ['plex_run', 'plex_step', 'plex_finish', 'plex_fail', 'plex_report', 'plex_monitor'],
    },
    {
      name: 'task_dispatcher', migration: '20260621760000_agent_task_dispatcher.sql',
      typeFile: 'agent-task-dispatcher.ts', skillDir: 'task-dispatcher',
      interfaces: ['TaskDispatcherConfig', 'DispatchRecord', 'WorkerAssignment'],
      bk: 'task_dispatcher', eks: ['tkdp.task_dispatched', 'tkdp.worker_assigned', 'tkdp.task_acknowledged', 'tkdp.dispatch_failed'],
      subjects: ['sven.tkdp.task_dispatched', 'sven.tkdp.worker_assigned', 'sven.tkdp.task_acknowledged', 'sven.tkdp.dispatch_failed'],
      cases: ['tkdp_dispatch', 'tkdp_assign', 'tkdp_ack', 'tkdp_fail', 'tkdp_report', 'tkdp_monitor'],
    },
    {
      name: 'step_coordinator', migration: '20260621770000_agent_step_coordinator.sql',
      typeFile: 'agent-step-coordinator.ts', skillDir: 'step-coordinator',
      interfaces: ['StepCoordinatorConfig', 'StepExecution', 'CoordinationResult'],
      bk: 'step_coordinator', eks: ['stcd.step_queued', 'stcd.step_started', 'stcd.step_synced', 'stcd.step_blocked'],
      subjects: ['sven.stcd.step_queued', 'sven.stcd.step_started', 'sven.stcd.step_synced', 'sven.stcd.step_blocked'],
      cases: ['stcd_queue', 'stcd_start', 'stcd_sync', 'stcd_block', 'stcd_report', 'stcd_monitor'],
    },
    {
      name: 'saga_runner', migration: '20260621780000_agent_saga_runner.sql',
      typeFile: 'agent-saga-runner.ts', skillDir: 'saga-runner',
      interfaces: ['SagaRunnerConfig', 'SagaExecution', 'SagaStep'],
      bk: 'saga_runner', eks: ['sgrn.saga_started', 'sgrn.step_executed', 'sgrn.saga_completed', 'sgrn.compensation_required'],
      subjects: ['sven.sgrn.saga_started', 'sven.sgrn.step_executed', 'sven.sgrn.saga_completed', 'sven.sgrn.compensation_required'],
      cases: ['sgrn_start', 'sgrn_execute', 'sgrn_complete', 'sgrn_compensate', 'sgrn_report', 'sgrn_monitor'],
    },
    {
      name: 'compensation_handler', migration: '20260621790000_agent_compensation_handler.sql',
      typeFile: 'agent-compensation-handler.ts', skillDir: 'compensation-handler',
      interfaces: ['CompensationHandlerConfig', 'CompensationRecord', 'RollbackPlan'],
      bk: 'compensation_handler', eks: ['cmph.compensation_triggered', 'cmph.rollback_executed', 'cmph.recovery_completed', 'cmph.escalation_required'],
      subjects: ['sven.cmph.compensation_triggered', 'sven.cmph.rollback_executed', 'sven.cmph.recovery_completed', 'sven.cmph.escalation_required'],
      cases: ['cmph_trigger', 'cmph_rollback', 'cmph_recover', 'cmph_escalate', 'cmph_report', 'cmph_monitor'],
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
