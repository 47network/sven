import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 973-977: ML Training', () => {
  const verticals = [
    {
      name: 'ml_training_dataset_curator', migration: '20260626100000_agent_ml_training_dataset_curator.sql',
      typeFile: 'agent-ml-training-dataset-curator.ts', skillDir: 'ml-training-dataset-curator',
      interfaces: ['MlTrainingDatasetCuratorConfig', 'DatasetSpec', 'CuratorEvent'],
      bk: 'ml_training_dataset_curator', eks: ['mtdc.spec_received', 'mtdc.records_collected', 'mtdc.dataset_published', 'mtdc.audit_recorded'],
      subjects: ['sven.mtdc.spec_received', 'sven.mtdc.records_collected', 'sven.mtdc.dataset_published', 'sven.mtdc.audit_recorded'],
      cases: ['mtdc_receive', 'mtdc_collect', 'mtdc_publish', 'mtdc_audit', 'mtdc_report', 'mtdc_monitor'],
    },
    {
      name: 'ml_training_job_scheduler', migration: '20260626110000_agent_ml_training_job_scheduler.sql',
      typeFile: 'agent-ml-training-job-scheduler.ts', skillDir: 'ml-training-job-scheduler',
      interfaces: ['MlTrainingJobSchedulerConfig', 'TrainingJob', 'SchedulerEvent'],
      bk: 'ml_training_job_scheduler', eks: ['mtjs.job_received', 'mtjs.resources_reserved', 'mtjs.job_dispatched', 'mtjs.audit_recorded'],
      subjects: ['sven.mtjs.job_received', 'sven.mtjs.resources_reserved', 'sven.mtjs.job_dispatched', 'sven.mtjs.audit_recorded'],
      cases: ['mtjs_receive', 'mtjs_reserve', 'mtjs_dispatch', 'mtjs_audit', 'mtjs_report', 'mtjs_monitor'],
    },
    {
      name: 'ml_training_checkpoint_writer', migration: '20260626120000_agent_ml_training_checkpoint_writer.sql',
      typeFile: 'agent-ml-training-checkpoint-writer.ts', skillDir: 'ml-training-checkpoint-writer',
      interfaces: ['MlTrainingCheckpointWriterConfig', 'Checkpoint', 'WriterEvent'],
      bk: 'ml_training_checkpoint_writer', eks: ['mtcw.checkpoint_received', 'mtcw.checkpoint_persisted', 'mtcw.checksum_recorded', 'mtcw.audit_recorded'],
      subjects: ['sven.mtcw.checkpoint_received', 'sven.mtcw.checkpoint_persisted', 'sven.mtcw.checksum_recorded', 'sven.mtcw.audit_recorded'],
      cases: ['mtcw_receive', 'mtcw_persist', 'mtcw_checksum', 'mtcw_audit', 'mtcw_report', 'mtcw_monitor'],
    },
    {
      name: 'ml_training_metrics_aggregator', migration: '20260626130000_agent_ml_training_metrics_aggregator.sql',
      typeFile: 'agent-ml-training-metrics-aggregator.ts', skillDir: 'ml-training-metrics-aggregator',
      interfaces: ['MlTrainingMetricsAggregatorConfig', 'MetricsBatch', 'AggregatorEvent'],
      bk: 'ml_training_metrics_aggregator', eks: ['mtma.batch_received', 'mtma.metrics_aggregated', 'mtma.report_emitted', 'mtma.audit_recorded'],
      subjects: ['sven.mtma.batch_received', 'sven.mtma.metrics_aggregated', 'sven.mtma.report_emitted', 'sven.mtma.audit_recorded'],
      cases: ['mtma_receive', 'mtma_aggregate', 'mtma_emit', 'mtma_audit', 'mtma_report', 'mtma_monitor'],
    },
    {
      name: 'ml_training_artifact_publisher', migration: '20260626140000_agent_ml_training_artifact_publisher.sql',
      typeFile: 'agent-ml-training-artifact-publisher.ts', skillDir: 'ml-training-artifact-publisher',
      interfaces: ['MlTrainingArtifactPublisherConfig', 'ArtifactRequest', 'PublisherEvent'],
      bk: 'ml_training_artifact_publisher', eks: ['mtap.request_received', 'mtap.artifact_signed', 'mtap.artifact_published', 'mtap.audit_recorded'],
      subjects: ['sven.mtap.request_received', 'sven.mtap.artifact_signed', 'sven.mtap.artifact_published', 'sven.mtap.audit_recorded'],
      cases: ['mtap_receive', 'mtap_sign', 'mtap_publish', 'mtap_audit', 'mtap_report', 'mtap_monitor'],
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
