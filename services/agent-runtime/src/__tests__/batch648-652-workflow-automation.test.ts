import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 648-652: Workflow & Automation', () => {
  const verticals = [
    {
      name: 'dag_scheduler', migration: '20260622850000_agent_dag_scheduler.sql',
      typeFile: 'agent-dag-scheduler.ts', skillDir: 'dag-scheduler',
      interfaces: ['DagSchedulerConfig', 'DagExecution', 'SchedulerEvent'],
      bk: 'dag_scheduler', eks: ['dags.dag_triggered', 'dags.node_completed', 'dags.execution_failed', 'dags.schedule_updated'],
      subjects: ['sven.dags.dag_triggered', 'sven.dags.node_completed', 'sven.dags.execution_failed', 'sven.dags.schedule_updated'],
      cases: ['dags_trigger', 'dags_complete', 'dags_fail', 'dags_update', 'dags_report', 'dags_monitor'],
    },
    {
      name: 'step_retrier', migration: '20260622860000_agent_step_retrier.sql',
      typeFile: 'agent-step-retrier.ts', skillDir: 'step-retrier',
      interfaces: ['StepRetrierConfig', 'RetryAttempt', 'RetrierEvent'],
      bk: 'step_retrier', eks: ['strt.retry_initiated', 'strt.backoff_applied', 'strt.max_attempts_reached', 'strt.step_recovered'],
      subjects: ['sven.strt.retry_initiated', 'sven.strt.backoff_applied', 'sven.strt.max_attempts_reached', 'sven.strt.step_recovered'],
      cases: ['strt_retry', 'strt_backoff', 'strt_maxout', 'strt_recover', 'strt_report', 'strt_monitor'],
    },
    {
      name: 'approval_gater', migration: '20260622870000_agent_approval_gater.sql',
      typeFile: 'agent-approval-gater.ts', skillDir: 'approval-gater',
      interfaces: ['ApprovalGaterConfig', 'ApprovalRequest', 'GaterEvent'],
      bk: 'approval_gater', eks: ['apgt.approval_requested', 'apgt.approval_granted', 'apgt.approval_denied', 'apgt.timeout_escalated'],
      subjects: ['sven.apgt.approval_requested', 'sven.apgt.approval_granted', 'sven.apgt.approval_denied', 'sven.apgt.timeout_escalated'],
      cases: ['apgt_request', 'apgt_grant', 'apgt_deny', 'apgt_escalate', 'apgt_report', 'apgt_monitor'],
    },
    {
      name: 'hook_dispatcher', migration: '20260622880000_agent_hook_dispatcher.sql',
      typeFile: 'agent-hook-dispatcher.ts', skillDir: 'hook-dispatcher',
      interfaces: ['HookDispatcherConfig', 'HookDelivery', 'DispatcherEvent'],
      bk: 'hook_dispatcher', eks: ['hkdp.hook_dispatched', 'hkdp.delivery_confirmed', 'hkdp.delivery_failed', 'hkdp.retry_queued'],
      subjects: ['sven.hkdp.hook_dispatched', 'sven.hkdp.delivery_confirmed', 'sven.hkdp.delivery_failed', 'sven.hkdp.retry_queued'],
      cases: ['hkdp_dispatch', 'hkdp_confirm', 'hkdp_fail', 'hkdp_retry', 'hkdp_report', 'hkdp_monitor'],
    },
    {
      name: 'cron_orchestrator', migration: '20260622890000_agent_cron_orchestrator.sql',
      typeFile: 'agent-cron-orchestrator.ts', skillDir: 'cron-orchestrator',
      interfaces: ['CronOrchestratorConfig', 'CronExecution', 'OrchestratorEvent'],
      bk: 'cron_orchestrator', eks: ['cror.job_executed', 'cror.schedule_registered', 'cror.execution_skipped', 'cror.overlap_detected'],
      subjects: ['sven.cror.job_executed', 'sven.cror.schedule_registered', 'sven.cror.execution_skipped', 'sven.cror.overlap_detected'],
      cases: ['cror_execute', 'cror_register', 'cror_skip', 'cror_overlap', 'cror_report', 'cror_monitor'],
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
