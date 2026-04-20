import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 568-572: Workflow Orchestration', () => {
  const verticals = [
    {
      name: 'step_sequencer', migration: '20260622050000_agent_step_sequencer.sql',
      typeFile: 'agent-step-sequencer.ts', skillDir: 'step-sequencer',
      interfaces: ['StepSequencerConfig', 'StepDefinition', 'SequenceRun'],
      bk: 'step_sequencer', eks: ['stsq.sequence_started', 'stsq.step_completed', 'stsq.sequence_finished', 'stsq.step_failed'],
      subjects: ['sven.stsq.sequence_started', 'sven.stsq.step_completed', 'sven.stsq.sequence_finished', 'sven.stsq.step_failed'],
      cases: ['stsq_start', 'stsq_step', 'stsq_finish', 'stsq_fail', 'stsq_report', 'stsq_monitor'],
    },
    {
      name: 'gate_keeper', migration: '20260622060000_agent_gate_keeper.sql',
      typeFile: 'agent-gate-keeper.ts', skillDir: 'gate-keeper',
      interfaces: ['GateKeeperConfig', 'GateCondition', 'GateDecision'],
      bk: 'gate_keeper', eks: ['gtkp.gate_evaluated', 'gtkp.gate_passed', 'gtkp.gate_blocked', 'gtkp.override_applied'],
      subjects: ['sven.gtkp.gate_evaluated', 'sven.gtkp.gate_passed', 'sven.gtkp.gate_blocked', 'sven.gtkp.override_applied'],
      cases: ['gtkp_evaluate', 'gtkp_pass', 'gtkp_block', 'gtkp_override', 'gtkp_report', 'gtkp_monitor'],
    },
    {
      name: 'parallel_joiner', migration: '20260622070000_agent_parallel_joiner.sql',
      typeFile: 'agent-parallel-joiner.ts', skillDir: 'parallel-joiner',
      interfaces: ['ParallelJoinerConfig', 'ForkResult', 'JoinResult'],
      bk: 'parallel_joiner', eks: ['prjn.fork_initiated', 'prjn.branch_completed', 'prjn.join_resolved', 'prjn.timeout_triggered'],
      subjects: ['sven.prjn.fork_initiated', 'sven.prjn.branch_completed', 'sven.prjn.join_resolved', 'sven.prjn.timeout_triggered'],
      cases: ['prjn_fork', 'prjn_branch', 'prjn_join', 'prjn_timeout', 'prjn_report', 'prjn_monitor'],
    },
    {
      name: 'timeout_watcher', migration: '20260622080000_agent_timeout_watcher.sql',
      typeFile: 'agent-timeout-watcher.ts', skillDir: 'timeout-watcher',
      interfaces: ['TimeoutWatcherConfig', 'WatchTarget', 'TimeoutEvent'],
      bk: 'timeout_watcher', eks: ['tmwt.watch_started', 'tmwt.deadline_approaching', 'tmwt.timeout_fired', 'tmwt.watch_cancelled'],
      subjects: ['sven.tmwt.watch_started', 'sven.tmwt.deadline_approaching', 'sven.tmwt.timeout_fired', 'sven.tmwt.watch_cancelled'],
      cases: ['tmwt_start', 'tmwt_approaching', 'tmwt_fire', 'tmwt_cancel', 'tmwt_report', 'tmwt_monitor'],
    },
    {
      name: 'retry_orchestrator', migration: '20260622090000_agent_retry_orchestrator.sql',
      typeFile: 'agent-retry-orchestrator.ts', skillDir: 'retry-orchestrator',
      interfaces: ['RetryOrchestratorConfig', 'RetryPolicy', 'RetryAttempt'],
      bk: 'retry_orchestrator', eks: ['rtyo.retry_scheduled', 'rtyo.attempt_made', 'rtyo.success_after_retry', 'rtyo.max_retries_exceeded'],
      subjects: ['sven.rtyo.retry_scheduled', 'sven.rtyo.attempt_made', 'sven.rtyo.success_after_retry', 'sven.rtyo.max_retries_exceeded'],
      cases: ['rtyo_schedule', 'rtyo_attempt', 'rtyo_success', 'rtyo_exceeded', 'rtyo_report', 'rtyo_monitor'],
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
