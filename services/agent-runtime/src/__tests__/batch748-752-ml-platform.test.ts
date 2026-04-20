import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 748-752: ML Platform', () => {
  const verticals = [
    {
      name: 'ml_training_orchestrator', migration: '20260623850000_agent_ml_training_orchestrator.sql',
      typeFile: 'agent-ml-training-orchestrator.ts', skillDir: 'ml-training-orchestrator',
      interfaces: ['MlTrainingOrchestratorConfig', 'TrainingJob', 'OrchestratorEvent'],
      bk: 'ml_training_orchestrator', eks: ['mltr.job_submitted', 'mltr.epoch_completed', 'mltr.checkpoint_saved', 'mltr.training_finished'],
      subjects: ['sven.mltr.job_submitted', 'sven.mltr.epoch_completed', 'sven.mltr.checkpoint_saved', 'sven.mltr.training_finished'],
      cases: ['mltr_submit', 'mltr_complete', 'mltr_save', 'mltr_finish', 'mltr_report', 'mltr_monitor'],
    },
    {
      name: 'model_registry_curator', migration: '20260623860000_agent_model_registry_curator.sql',
      typeFile: 'agent-model-registry-curator.ts', skillDir: 'model-registry-curator',
      interfaces: ['ModelRegistryCuratorConfig', 'ModelArtifact', 'CuratorEvent'],
      bk: 'model_registry_curator', eks: ['mrcr.model_registered', 'mrcr.version_promoted', 'mrcr.lineage_recorded', 'mrcr.deprecation_marked'],
      subjects: ['sven.mrcr.model_registered', 'sven.mrcr.version_promoted', 'sven.mrcr.lineage_recorded', 'sven.mrcr.deprecation_marked'],
      cases: ['mrcr_register', 'mrcr_promote', 'mrcr_record', 'mrcr_deprecate', 'mrcr_report', 'mrcr_monitor'],
    },
    {
      name: 'inference_endpoint_router', migration: '20260623870000_agent_inference_endpoint_router.sql',
      typeFile: 'agent-inference-endpoint-router.ts', skillDir: 'inference-endpoint-router',
      interfaces: ['InferenceEndpointRouterConfig', 'InferenceRoute', 'RouterEvent'],
      bk: 'inference_endpoint_router', eks: ['ifrt.endpoint_published', 'ifrt.request_routed', 'ifrt.canary_split', 'ifrt.fallback_engaged'],
      subjects: ['sven.ifrt.endpoint_published', 'sven.ifrt.request_routed', 'sven.ifrt.canary_split', 'sven.ifrt.fallback_engaged'],
      cases: ['ifrt_publish', 'ifrt_route', 'ifrt_split', 'ifrt_engage', 'ifrt_report', 'ifrt_monitor'],
    },
    {
      name: 'feature_store_writer', migration: '20260623880000_agent_feature_store_writer.sql',
      typeFile: 'agent-feature-store-writer.ts', skillDir: 'feature-store-writer',
      interfaces: ['FeatureStoreWriterConfig', 'FeatureGroup', 'WriterEvent'],
      bk: 'feature_store_writer', eks: ['fsws.feature_written', 'fsws.online_synced', 'fsws.offline_materialized', 'fsws.serving_validated'],
      subjects: ['sven.fsws.feature_written', 'sven.fsws.online_synced', 'sven.fsws.offline_materialized', 'sven.fsws.serving_validated'],
      cases: ['fsws_write', 'fsws_sync', 'fsws_materialize', 'fsws_validate', 'fsws_report', 'fsws_monitor'],
    },
    {
      name: 'ml_experiment_tracker', migration: '20260623890000_agent_ml_experiment_tracker.sql',
      typeFile: 'agent-ml-experiment-tracker.ts', skillDir: 'ml-experiment-tracker',
      interfaces: ['MlExperimentTrackerConfig', 'MlExperiment', 'TrackerEvent'],
      bk: 'ml_experiment_tracker', eks: ['mlex.experiment_started', 'mlex.metric_logged', 'mlex.artifact_attached', 'mlex.run_finalized'],
      subjects: ['sven.mlex.experiment_started', 'sven.mlex.metric_logged', 'sven.mlex.artifact_attached', 'sven.mlex.run_finalized'],
      cases: ['mlex_start', 'mlex_log', 'mlex_attach', 'mlex_finalize', 'mlex_report', 'mlex_monitor'],
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
