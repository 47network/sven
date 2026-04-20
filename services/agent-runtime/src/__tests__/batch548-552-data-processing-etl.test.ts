import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 548-552: Data Processing & ETL', () => {
  const verticals = [
    {
      name: 'batch_transformer', migration: '20260621850000_agent_batch_transformer.sql',
      typeFile: 'agent-batch-transformer.ts', skillDir: 'batch-transformer',
      interfaces: ['BatchTransformerConfig', 'TransformJob', 'TransformResult'],
      bk: 'batch_transformer', eks: ['btfm.job_queued', 'btfm.transform_started', 'btfm.transform_completed', 'btfm.error_occurred'],
      subjects: ['sven.btfm.job_queued', 'sven.btfm.transform_started', 'sven.btfm.transform_completed', 'sven.btfm.error_occurred'],
      cases: ['btfm_queue', 'btfm_start', 'btfm_complete', 'btfm_error', 'btfm_report', 'btfm_monitor'],
    },
    {
      name: 'data_validator', migration: '20260621860000_agent_data_validator.sql',
      typeFile: 'agent-data-validator.ts', skillDir: 'data-validator',
      interfaces: ['DataValidatorConfig', 'ValidationResult', 'ValidationRule'],
      bk: 'data_validator', eks: ['dvld.validation_started', 'dvld.validation_passed', 'dvld.validation_failed', 'dvld.rule_updated'],
      subjects: ['sven.dvld.validation_started', 'sven.dvld.validation_passed', 'sven.dvld.validation_failed', 'sven.dvld.rule_updated'],
      cases: ['dvld_start', 'dvld_pass', 'dvld_fail', 'dvld_update', 'dvld_report', 'dvld_monitor'],
    },
    {
      name: 'pipeline_aggregator', migration: '20260621870000_agent_pipeline_aggregator.sql',
      typeFile: 'agent-pipeline-aggregator.ts', skillDir: 'pipeline-aggregator',
      interfaces: ['PipelineAggregatorConfig', 'AggregationResult', 'AggregationSource'],
      bk: 'pipeline_aggregator', eks: ['pagr.aggregation_started', 'pagr.source_ingested', 'pagr.aggregation_completed', 'pagr.conflict_detected'],
      subjects: ['sven.pagr.aggregation_started', 'sven.pagr.source_ingested', 'sven.pagr.aggregation_completed', 'sven.pagr.conflict_detected'],
      cases: ['pagr_start', 'pagr_ingest', 'pagr_complete', 'pagr_conflict', 'pagr_report', 'pagr_monitor'],
    },
    {
      name: 'record_enricher', migration: '20260621880000_agent_record_enricher.sql',
      typeFile: 'agent-record-enricher.ts', skillDir: 'record-enricher',
      interfaces: ['RecordEnricherConfig', 'EnrichmentResult', 'EnrichmentSource'],
      bk: 'record_enricher', eks: ['rcen.enrichment_started', 'rcen.record_enriched', 'rcen.source_unavailable', 'rcen.batch_completed'],
      subjects: ['sven.rcen.enrichment_started', 'sven.rcen.record_enriched', 'sven.rcen.source_unavailable', 'sven.rcen.batch_completed'],
      cases: ['rcen_start', 'rcen_enrich', 'rcen_unavail', 'rcen_complete', 'rcen_report', 'rcen_monitor'],
    },
    {
      name: 'etl_orchestrator', migration: '20260621890000_agent_etl_orchestrator.sql',
      typeFile: 'agent-etl-orchestrator.ts', skillDir: 'etl-orchestrator',
      interfaces: ['EtlOrchestratorConfig', 'EtlPipeline', 'EtlStageResult'],
      bk: 'etl_orchestrator', eks: ['etlo.pipeline_started', 'etlo.stage_completed', 'etlo.pipeline_finished', 'etlo.pipeline_failed'],
      subjects: ['sven.etlo.pipeline_started', 'sven.etlo.stage_completed', 'sven.etlo.pipeline_finished', 'sven.etlo.pipeline_failed'],
      cases: ['etlo_start', 'etlo_stage', 'etlo_finish', 'etlo_fail', 'etlo_report', 'etlo_monitor'],
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
