import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 673-677: ML Pipeline', () => {
  const verticals = [
    {
      name: 'feature_store', migration: '20260623100000_agent_feature_store.sql',
      typeFile: 'agent-feature-store.ts', skillDir: 'feature-store',
      interfaces: ['FeatureStoreConfig', 'FeatureSet', 'StoreEvent'],
      bk: 'feature_store', eks: ['ftst.feature_ingested', 'ftst.set_materialized', 'ftst.drift_detected', 'ftst.serving_updated'],
      subjects: ['sven.ftst.feature_ingested', 'sven.ftst.set_materialized', 'sven.ftst.drift_detected', 'sven.ftst.serving_updated'],
      cases: ['ftst_ingest', 'ftst_materialize', 'ftst_drift', 'ftst_serve', 'ftst_report', 'ftst_monitor'],
    },
    {
      name: 'model_registry', migration: '20260623110000_agent_model_registry.sql',
      typeFile: 'agent-model-registry.ts', skillDir: 'model-registry',
      interfaces: ['ModelRegistryConfig', 'RegisteredModel', 'RegistryEvent'],
      bk: 'model_registry', eks: ['mreg.model_registered', 'mreg.version_promoted', 'mreg.stage_transitioned', 'mreg.artifact_stored'],
      subjects: ['sven.mreg.model_registered', 'sven.mreg.version_promoted', 'sven.mreg.stage_transitioned', 'sven.mreg.artifact_stored'],
      cases: ['mreg_register', 'mreg_promote', 'mreg_transition', 'mreg_artifact', 'mreg_report', 'mreg_monitor'],
    },
    {
      name: 'experiment_tracker', migration: '20260623120000_agent_experiment_tracker.sql',
      typeFile: 'agent-experiment-tracker.ts', skillDir: 'experiment-tracker',
      interfaces: ['ExperimentTrackerConfig', 'ExperimentRun', 'TrackerEvent'],
      bk: 'experiment_tracker', eks: ['extr.run_started', 'extr.metric_logged', 'extr.comparison_generated', 'extr.best_run_selected'],
      subjects: ['sven.extr.run_started', 'sven.extr.metric_logged', 'sven.extr.comparison_generated', 'sven.extr.best_run_selected'],
      cases: ['extr_start', 'extr_metric', 'extr_compare', 'extr_select', 'extr_report', 'extr_monitor'],
    },
    {
      name: 'data_labeler', migration: '20260623130000_agent_data_labeler.sql',
      typeFile: 'agent-data-labeler.ts', skillDir: 'data-labeler',
      interfaces: ['DataLabelerConfig', 'LabelingTask', 'LabelerEvent'],
      bk: 'data_labeler', eks: ['dlab.task_created', 'dlab.label_applied', 'dlab.consensus_reached', 'dlab.quality_checked'],
      subjects: ['sven.dlab.task_created', 'sven.dlab.label_applied', 'sven.dlab.consensus_reached', 'sven.dlab.quality_checked'],
      cases: ['dlab_create', 'dlab_label', 'dlab_consensus', 'dlab_quality', 'dlab_report', 'dlab_monitor'],
    },
    {
      name: 'training_scheduler', migration: '20260623140000_agent_training_scheduler.sql',
      typeFile: 'agent-training-scheduler.ts', skillDir: 'training-scheduler',
      interfaces: ['TrainingSchedulerConfig', 'TrainingJob', 'SchedulerEvent'],
      bk: 'training_scheduler', eks: ['trsc.job_queued', 'trsc.gpu_allocated', 'trsc.training_completed', 'trsc.checkpoint_saved'],
      subjects: ['sven.trsc.job_queued', 'sven.trsc.gpu_allocated', 'sven.trsc.training_completed', 'sven.trsc.checkpoint_saved'],
      cases: ['trsc_queue', 'trsc_allocate', 'trsc_complete', 'trsc_checkpoint', 'trsc_report', 'trsc_monitor'],
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
