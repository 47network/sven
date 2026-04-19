import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 758-762: Workflow Orchestration', () => {
  const verticals = [
    {
      name: 'saga_coordinator', migration: '20260623950000_agent_saga_coordinator.sql',
      typeFile: 'agent-saga-coordinator.ts', skillDir: 'saga-coordinator',
      interfaces: ['SagaCoordinatorConfig', 'Saga', 'CoordinatorEvent'],
      bk: 'saga_coordinator', eks: ['sgcd.saga_started', 'sgcd.step_completed', 'sgcd.compensation_triggered', 'sgcd.saga_finalized'],
      subjects: ['sven.sgcd.saga_started', 'sven.sgcd.step_completed', 'sven.sgcd.compensation_triggered', 'sven.sgcd.saga_finalized'],
      cases: ['sgcd_start', 'sgcd_complete', 'sgcd_compensate', 'sgcd_finalize', 'sgcd_report', 'sgcd_monitor'],
    },
    {
      name: 'workflow_state_machine', migration: '20260623960000_agent_workflow_state_machine.sql',
      typeFile: 'agent-workflow-state-machine.ts', skillDir: 'workflow-state-machine',
      interfaces: ['WorkflowStateMachineConfig', 'WorkflowInstance', 'MachineEvent'],
      bk: 'workflow_state_machine', eks: ['wfsm.workflow_initiated', 'wfsm.transition_executed', 'wfsm.guard_evaluated', 'wfsm.workflow_terminated'],
      subjects: ['sven.wfsm.workflow_initiated', 'sven.wfsm.transition_executed', 'sven.wfsm.guard_evaluated', 'sven.wfsm.workflow_terminated'],
      cases: ['wfsm_initiate', 'wfsm_execute', 'wfsm_evaluate', 'wfsm_terminate', 'wfsm_report', 'wfsm_monitor'],
    },
    {
      name: 'compensating_action_runner', migration: '20260623970000_agent_compensating_action_runner.sql',
      typeFile: 'agent-compensating-action-runner.ts', skillDir: 'compensating-action-runner',
      interfaces: ['CompensatingActionRunnerConfig', 'CompensatingAction', 'RunnerEvent'],
      bk: 'compensating_action_runner', eks: ['cpar.action_planned', 'cpar.compensation_executed', 'cpar.idempotency_verified', 'cpar.failure_escalated'],
      subjects: ['sven.cpar.action_planned', 'sven.cpar.compensation_executed', 'sven.cpar.idempotency_verified', 'sven.cpar.failure_escalated'],
      cases: ['cpar_plan', 'cpar_execute', 'cpar_verify', 'cpar_escalate', 'cpar_report', 'cpar_monitor'],
    },
    {
      name: 'long_running_job_supervisor', migration: '20260623980000_agent_long_running_job_supervisor.sql',
      typeFile: 'agent-long-running-job-supervisor.ts', skillDir: 'long-running-job-supervisor',
      interfaces: ['LongRunningJobSupervisorConfig', 'SupervisedJob', 'SupervisorEvent'],
      bk: 'long_running_job_supervisor', eks: ['lrjs.job_supervised', 'lrjs.heartbeat_received', 'lrjs.timeout_detected', 'lrjs.recovery_attempted'],
      subjects: ['sven.lrjs.job_supervised', 'sven.lrjs.heartbeat_received', 'sven.lrjs.timeout_detected', 'sven.lrjs.recovery_attempted'],
      cases: ['lrjs_supervise', 'lrjs_receive', 'lrjs_detect', 'lrjs_recover', 'lrjs_report', 'lrjs_monitor'],
    },
    {
      name: 'cron_dispatcher', migration: '20260623990000_agent_cron_dispatcher.sql',
      typeFile: 'agent-cron-dispatcher.ts', skillDir: 'cron-dispatcher',
      interfaces: ['CronDispatcherConfig', 'CronJob', 'DispatcherEvent'],
      bk: 'cron_dispatcher', eks: ['crdp.job_scheduled', 'crdp.fire_dispatched', 'crdp.misfire_handled', 'crdp.lock_acquired'],
      subjects: ['sven.crdp.job_scheduled', 'sven.crdp.fire_dispatched', 'sven.crdp.misfire_handled', 'sven.crdp.lock_acquired'],
      cases: ['crdp_schedule', 'crdp_dispatch', 'crdp_handle', 'crdp_acquire', 'crdp_report', 'crdp_monitor'],
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
