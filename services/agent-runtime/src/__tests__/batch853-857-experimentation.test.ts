import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 853-857: Experimentation & Rollout', () => {
  const verticals = [
    {
      name: 'ab_variant_assigner', migration: '20260624900000_agent_ab_variant_assigner.sql',
      typeFile: 'agent-ab-variant-assigner.ts', skillDir: 'ab-variant-assigner',
      interfaces: ['AbVariantAssignerConfig', 'AssignmentRequest', 'AssignerEvent'],
      bk: 'ab_variant_assigner', eks: ['abva.request_received', 'abva.bucket_computed', 'abva.variant_selected', 'abva.assignment_logged'],
      subjects: ['sven.abva.request_received', 'sven.abva.bucket_computed', 'sven.abva.variant_selected', 'sven.abva.assignment_logged'],
      cases: ['abva_receive', 'abva_compute', 'abva_select', 'abva_log', 'abva_report', 'abva_monitor'],
    },
    {
      name: 'experiment_metric_collector', migration: '20260624910000_agent_experiment_metric_collector.sql',
      typeFile: 'agent-experiment-metric-collector.ts', skillDir: 'experiment-metric-collector',
      interfaces: ['ExperimentMetricCollectorConfig', 'MetricEvent', 'CollectorEvent'],
      bk: 'experiment_metric_collector', eks: ['exmc.event_received', 'exmc.experiment_resolved', 'exmc.metric_aggregated', 'exmc.snapshot_persisted'],
      subjects: ['sven.exmc.event_received', 'sven.exmc.experiment_resolved', 'sven.exmc.metric_aggregated', 'sven.exmc.snapshot_persisted'],
      cases: ['exmc_receive', 'exmc_resolve', 'exmc_aggregate', 'exmc_persist', 'exmc_report', 'exmc_monitor'],
    },
    {
      name: 'feature_rollout_controller', migration: '20260624920000_agent_feature_rollout_controller.sql',
      typeFile: 'agent-feature-rollout-controller.ts', skillDir: 'feature-rollout-controller',
      interfaces: ['FeatureRolloutControllerConfig', 'RolloutDirective', 'ControllerEvent'],
      bk: 'feature_rollout_controller', eks: ['frlc.directive_received', 'frlc.policy_evaluated', 'frlc.rollout_advanced', 'frlc.state_persisted'],
      subjects: ['sven.frlc.directive_received', 'sven.frlc.policy_evaluated', 'sven.frlc.rollout_advanced', 'sven.frlc.state_persisted'],
      cases: ['frlc_receive', 'frlc_evaluate', 'frlc_advance', 'frlc_persist', 'frlc_report', 'frlc_monitor'],
    },
    {
      name: 'cohort_membership_assigner', migration: '20260624930000_agent_cohort_membership_assigner.sql',
      typeFile: 'agent-cohort-membership-assigner.ts', skillDir: 'cohort-membership-assigner',
      interfaces: ['CohortMembershipAssignerConfig', 'CohortAssignment', 'AssignerEvent'],
      bk: 'cohort_membership_assigner', eks: ['cmas.subject_received', 'cmas.rules_evaluated', 'cmas.cohort_assigned', 'cmas.entry_persisted'],
      subjects: ['sven.cmas.subject_received', 'sven.cmas.rules_evaluated', 'sven.cmas.cohort_assigned', 'sven.cmas.entry_persisted'],
      cases: ['cmas_receive', 'cmas_evaluate', 'cmas_assign', 'cmas_persist', 'cmas_report', 'cmas_monitor'],
    },
    {
      name: 'experiment_significance_evaluator', migration: '20260624940000_agent_experiment_significance_evaluator.sql',
      typeFile: 'agent-experiment-significance-evaluator.ts', skillDir: 'experiment-significance-evaluator',
      interfaces: ['ExperimentSignificanceEvaluatorConfig', 'SignificanceCheck', 'EvaluatorEvent'],
      bk: 'experiment_significance_evaluator', eks: ['exse.snapshot_loaded', 'exse.statistics_computed', 'exse.threshold_evaluated', 'exse.verdict_recorded'],
      subjects: ['sven.exse.snapshot_loaded', 'sven.exse.statistics_computed', 'sven.exse.threshold_evaluated', 'sven.exse.verdict_recorded'],
      cases: ['exse_load', 'exse_compute', 'exse_evaluate', 'exse_record', 'exse_report', 'exse_monitor'],
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
