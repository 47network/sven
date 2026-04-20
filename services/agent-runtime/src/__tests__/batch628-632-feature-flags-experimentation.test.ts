import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 628-632: Feature Flags & Experimentation', () => {
  const verticals = [
    {
      name: 'feature_toggler', migration: '20260622650000_agent_feature_toggler.sql',
      typeFile: 'agent-feature-toggler.ts', skillDir: 'feature-toggler',
      interfaces: ['FeatureTogglerConfig', 'FeatureFlag', 'ToggleEvent'],
      bk: 'feature_toggler', eks: ['fttg.flag_enabled', 'fttg.flag_disabled', 'fttg.override_set', 'fttg.evaluation_logged'],
      subjects: ['sven.fttg.flag_enabled', 'sven.fttg.flag_disabled', 'sven.fttg.override_set', 'sven.fttg.evaluation_logged'],
      cases: ['fttg_enable', 'fttg_disable', 'fttg_override', 'fttg_evaluate', 'fttg_report', 'fttg_monitor'],
    },
    {
      name: 'experiment_runner', migration: '20260622660000_agent_experiment_runner.sql',
      typeFile: 'agent-experiment-runner.ts', skillDir: 'experiment-runner',
      interfaces: ['ExperimentRunnerConfig', 'Experiment', 'RunnerEvent'],
      bk: 'experiment_runner', eks: ['expr.experiment_started', 'expr.variant_assigned', 'expr.result_recorded', 'expr.experiment_concluded'],
      subjects: ['sven.expr.experiment_started', 'sven.expr.variant_assigned', 'sven.expr.result_recorded', 'sven.expr.experiment_concluded'],
      cases: ['expr_start', 'expr_assign', 'expr_record', 'expr_conclude', 'expr_report', 'expr_monitor'],
    },
    {
      name: 'ab_splitter', migration: '20260622670000_agent_ab_splitter.sql',
      typeFile: 'agent-ab-splitter.ts', skillDir: 'ab-splitter',
      interfaces: ['AbSplitterConfig', 'SplitResult', 'SplitterEvent'],
      bk: 'ab_splitter', eks: ['absp.traffic_split', 'absp.ratio_adjusted', 'absp.cohort_created', 'absp.bias_detected'],
      subjects: ['sven.absp.traffic_split', 'sven.absp.ratio_adjusted', 'sven.absp.cohort_created', 'sven.absp.bias_detected'],
      cases: ['absp_split', 'absp_adjust', 'absp_cohort', 'absp_bias', 'absp_report', 'absp_monitor'],
    },
    {
      name: 'rollout_planner', migration: '20260622680000_agent_rollout_planner.sql',
      typeFile: 'agent-rollout-planner.ts', skillDir: 'rollout-planner',
      interfaces: ['RolloutPlannerConfig', 'RolloutPlan', 'PlannerEvent'],
      bk: 'rollout_planner', eks: ['rlpl.plan_created', 'rlpl.phase_advanced', 'rlpl.rollback_triggered', 'rlpl.completion_reached'],
      subjects: ['sven.rlpl.plan_created', 'sven.rlpl.phase_advanced', 'sven.rlpl.rollback_triggered', 'sven.rlpl.completion_reached'],
      cases: ['rlpl_create', 'rlpl_advance', 'rlpl_rollback', 'rlpl_complete', 'rlpl_report', 'rlpl_monitor'],
    },
    {
      name: 'flag_archiver', migration: '20260622690000_agent_flag_archiver.sql',
      typeFile: 'agent-flag-archiver.ts', skillDir: 'flag-archiver',
      interfaces: ['FlagArchiverConfig', 'ArchiveRecord', 'ArchiverEvent'],
      bk: 'flag_archiver', eks: ['flar.flag_archived', 'flar.stale_detected', 'flar.cleanup_completed', 'flar.history_exported'],
      subjects: ['sven.flar.flag_archived', 'sven.flar.stale_detected', 'sven.flar.cleanup_completed', 'sven.flar.history_exported'],
      cases: ['flar_archive', 'flar_detect', 'flar_cleanup', 'flar_export', 'flar_report', 'flar_monitor'],
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
