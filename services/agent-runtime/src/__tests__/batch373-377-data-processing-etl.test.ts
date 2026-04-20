import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 373-377 — Data Processing & ETL', () => {

  // ─── Batch 373: Data Transformer ────────────────────────────────
  describe('Batch 373 — Data Transformer', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260620100000_agent_data_transformer.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-data-transformer.ts');
    const skillPath = path.join(ROOT, 'skills/autonomous-economy/data-transformer/SKILL.md');

    describe('Migration', () => {
      let sql: string;
      beforeAll(() => { sql = fs.readFileSync(migrationPath, 'utf-8'); });

      it('creates agent_data_transformer_configs table', () => { expect(sql).toContain('agent_data_transformer_configs'); });
      it('creates agent_transformations table', () => { expect(sql).toContain('agent_transformations'); });
      it('creates agent_transformation_rules table', () => { expect(sql).toContain('agent_transformation_rules'); });
      it('has agent_id column', () => { expect(sql).toContain('agent_id'); });
      it('has default_format column', () => { expect(sql).toContain('default_format'); });
      it('has parallel_workers column', () => { expect(sql).toContain('parallel_workers'); });
      it('creates indexes', () => { expect(sql).toContain('idx_transformations_agent'); });
    });

    describe('Types', () => {
      let types: string;
      beforeAll(() => { types = fs.readFileSync(typesPath, 'utf-8'); });

      const typeExports = ['TransformFormat', 'TransformStatus', 'RuleType', 'ValidationMode'];
      typeExports.forEach(t => {
        it(`exports ${t}`, () => { expect(types).toContain(t); });
      });

      const interfaces = ['DataTransformerConfig', 'AgentTransformation', 'TransformationRule'];
      interfaces.forEach(i => {
        it(`exports ${i} interface`, () => { expect(types).toContain(`export interface ${i}`); });
      });
    });

    describe('SKILL.md', () => {
      let skill: string;
      beforeAll(() => { skill = fs.readFileSync(skillPath, 'utf-8'); });

      it('has correct name', () => { expect(skill).toContain('name: data-transformer'); });
      it('has price', () => { expect(skill).toContain('price: 13.99'); });
      it('has archetype', () => { expect(skill).toContain('archetype: engineer'); });
      it('has Actions section', () => { expect(skill).toContain('## Actions'); });
      it('has transform_data action', () => { expect(skill).toContain('### transform_data'); });
      it('has batch_transform action', () => { expect(skill).toContain('### batch_transform'); });
    });
  });

  // ─── Batch 374: Pipeline Orchestrator ───────────────────────────
  describe('Batch 374 — Pipeline Orchestrator', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260620110000_agent_pipeline_orchestrator.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-pipeline-orchestrator.ts');
    const skillPath = path.join(ROOT, 'skills/autonomous-economy/pipeline-orchestrator/SKILL.md');

    describe('Migration', () => {
      let sql: string;
      beforeAll(() => { sql = fs.readFileSync(migrationPath, 'utf-8'); });

      it('creates agent_pipeline_orchestrator_configs table', () => { expect(sql).toContain('agent_pipeline_orchestrator_configs'); });
      it('creates agent_pipelines table', () => { expect(sql).toContain('agent_pipelines'); });
      it('creates agent_pipeline_stages table', () => { expect(sql).toContain('agent_pipeline_stages'); });
      it('has retry_policy column', () => { expect(sql).toContain('retry_policy'); });
      it('has stage_order column', () => { expect(sql).toContain('stage_order'); });
      it('creates indexes', () => { expect(sql).toContain('idx_pipelines_agent'); });
    });

    describe('Types', () => {
      let types: string;
      beforeAll(() => { types = fs.readFileSync(typesPath, 'utf-8'); });

      const typeExports = ['PipelineStatus', 'StageType', 'RetryPolicy', 'StageStatus'];
      typeExports.forEach(t => {
        it(`exports ${t}`, () => { expect(types).toContain(t); });
      });

      const interfaces = ['PipelineOrchestratorConfig', 'AgentPipeline', 'PipelineStage'];
      interfaces.forEach(i => {
        it(`exports ${i} interface`, () => { expect(types).toContain(`export interface ${i}`); });
      });
    });

    describe('SKILL.md', () => {
      let skill: string;
      beforeAll(() => { skill = fs.readFileSync(skillPath, 'utf-8'); });

      it('has correct name', () => { expect(skill).toContain('name: pipeline-orchestrator'); });
      it('has price', () => { expect(skill).toContain('price: 18.99'); });
      it('has archetype', () => { expect(skill).toContain('archetype: engineer'); });
      it('has Actions section', () => { expect(skill).toContain('## Actions'); });
      it('has create_pipeline action', () => { expect(skill).toContain('### create_pipeline'); });
      it('has run_pipeline action', () => { expect(skill).toContain('### run_pipeline'); });
    });
  });

  // ─── Batch 375: Data Enricher ───────────────────────────────────
  describe('Batch 375 — Data Enricher', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260620120000_agent_data_enricher.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-data-enricher.ts');
    const skillPath = path.join(ROOT, 'skills/autonomous-economy/data-enricher/SKILL.md');

    describe('Migration', () => {
      let sql: string;
      beforeAll(() => { sql = fs.readFileSync(migrationPath, 'utf-8'); });

      it('creates agent_data_enricher_configs table', () => { expect(sql).toContain('agent_data_enricher_configs'); });
      it('creates agent_enrichment_jobs table', () => { expect(sql).toContain('agent_enrichment_jobs'); });
      it('creates agent_enrichment_sources table', () => { expect(sql).toContain('agent_enrichment_sources'); });
      it('has cache_ttl_seconds column', () => { expect(sql).toContain('cache_ttl_seconds'); });
      it('has rate_limit_per_min column', () => { expect(sql).toContain('rate_limit_per_min'); });
      it('creates indexes', () => { expect(sql).toContain('idx_enrichment_jobs_agent'); });
    });

    describe('Types', () => {
      let types: string;
      beforeAll(() => { types = fs.readFileSync(typesPath, 'utf-8'); });

      const typeExports = ['EnrichmentSourceType', 'EnrichmentStatus', 'CacheStrategy', 'MatchStrategy'];
      typeExports.forEach(t => {
        it(`exports ${t}`, () => { expect(types).toContain(t); });
      });

      const interfaces = ['DataEnricherConfig', 'EnrichmentJob', 'EnrichmentSource'];
      interfaces.forEach(i => {
        it(`exports ${i} interface`, () => { expect(types).toContain(`export interface ${i}`); });
      });
    });

    describe('SKILL.md', () => {
      let skill: string;
      beforeAll(() => { skill = fs.readFileSync(skillPath, 'utf-8'); });

      it('has correct name', () => { expect(skill).toContain('name: data-enricher'); });
      it('has price', () => { expect(skill).toContain('price: 15.99'); });
      it('has archetype', () => { expect(skill).toContain('archetype: analyst'); });
      it('has Actions section', () => { expect(skill).toContain('## Actions'); });
      it('has enrich_records action', () => { expect(skill).toContain('### enrich_records'); });
      it('has configure_source action', () => { expect(skill).toContain('### configure_source'); });
    });
  });

  // ─── Batch 376: ETL Scheduler ───────────────────────────────────
  describe('Batch 376 — ETL Scheduler', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260620130000_agent_etl_scheduler.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-etl-scheduler.ts');
    const skillPath = path.join(ROOT, 'skills/autonomous-economy/etl-scheduler/SKILL.md');

    describe('Migration', () => {
      let sql: string;
      beforeAll(() => { sql = fs.readFileSync(migrationPath, 'utf-8'); });

      it('creates agent_etl_scheduler_configs table', () => { expect(sql).toContain('agent_etl_scheduler_configs'); });
      it('creates agent_etl_schedules table', () => { expect(sql).toContain('agent_etl_schedules'); });
      it('creates agent_etl_run_history table', () => { expect(sql).toContain('agent_etl_run_history'); });
      it('has cron_expression column', () => { expect(sql).toContain('cron_expression'); });
      it('has missed_run_policy column', () => { expect(sql).toContain('missed_run_policy'); });
      it('creates indexes', () => { expect(sql).toContain('idx_etl_schedules_agent'); });
    });

    describe('Types', () => {
      let types: string;
      beforeAll(() => { types = fs.readFileSync(typesPath, 'utf-8'); });

      const typeExports = ['ScheduleStatus', 'TriggerType', 'MissedRunPolicy', 'RunStatus'];
      typeExports.forEach(t => {
        it(`exports ${t}`, () => { expect(types).toContain(t); });
      });

      const interfaces = ['EtlSchedulerConfig', 'EtlSchedule', 'EtlRunHistory'];
      interfaces.forEach(i => {
        it(`exports ${i} interface`, () => { expect(types).toContain(`export interface ${i}`); });
      });
    });

    describe('SKILL.md', () => {
      let skill: string;
      beforeAll(() => { skill = fs.readFileSync(skillPath, 'utf-8'); });

      it('has correct name', () => { expect(skill).toContain('name: etl-scheduler'); });
      it('has price', () => { expect(skill).toContain('price: 16.99'); });
      it('has archetype', () => { expect(skill).toContain('archetype: engineer'); });
      it('has Actions section', () => { expect(skill).toContain('## Actions'); });
      it('has create_schedule action', () => { expect(skill).toContain('### create_schedule'); });
      it('has trigger_run action', () => { expect(skill).toContain('### trigger_run'); });
    });
  });

  // ─── Batch 377: Format Converter ────────────────────────────────
  describe('Batch 377 — Format Converter', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260620140000_agent_format_converter.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-format-converter.ts');
    const skillPath = path.join(ROOT, 'skills/autonomous-economy/format-converter/SKILL.md');

    describe('Migration', () => {
      let sql: string;
      beforeAll(() => { sql = fs.readFileSync(migrationPath, 'utf-8'); });

      it('creates agent_format_converter_configs table', () => { expect(sql).toContain('agent_format_converter_configs'); });
      it('creates agent_conversion_jobs table', () => { expect(sql).toContain('agent_conversion_jobs'); });
      it('creates agent_format_mappings table', () => { expect(sql).toContain('agent_format_mappings'); });
      it('has supported_formats column', () => { expect(sql).toContain('supported_formats'); });
      it('has encoding column', () => { expect(sql).toContain('encoding'); });
      it('creates indexes', () => { expect(sql).toContain('idx_conversion_jobs_agent'); });
    });

    describe('Types', () => {
      let types: string;
      beforeAll(() => { types = fs.readFileSync(typesPath, 'utf-8'); });

      const typeExports = ['ConvertibleFormat', 'ConversionStatus', 'EncodingType', 'DelimiterType'];
      typeExports.forEach(t => {
        it(`exports ${t}`, () => { expect(types).toContain(t); });
      });

      const interfaces = ['FormatConverterConfig', 'ConversionJob', 'FormatMapping'];
      interfaces.forEach(i => {
        it(`exports ${i} interface`, () => { expect(types).toContain(`export interface ${i}`); });
      });
    });

    describe('SKILL.md', () => {
      let skill: string;
      beforeAll(() => { skill = fs.readFileSync(skillPath, 'utf-8'); });

      it('has correct name', () => { expect(skill).toContain('name: format-converter'); });
      it('has price', () => { expect(skill).toContain('price: 11.99'); });
      it('has archetype', () => { expect(skill).toContain('archetype: engineer'); });
      it('has Actions section', () => { expect(skill).toContain('## Actions'); });
      it('has convert_file action', () => { expect(skill).toContain('### convert_file'); });
      it('has batch_convert action', () => { expect(skill).toContain('### batch_convert'); });
    });
  });

  // ─── Cross-cutting: Barrel exports ──────────────────────────────
  describe('Barrel exports', () => {
    let indexContent: string;
    beforeAll(() => { indexContent = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8'); });

    const modules = ['agent-data-transformer', 'agent-pipeline-orchestrator', 'agent-data-enricher', 'agent-etl-scheduler', 'agent-format-converter'];
    modules.forEach(m => {
      it(`exports ${m}`, () => { expect(indexContent).toContain(`from './${m}'`); });
    });
  });

  // ─── Cross-cutting: Eidolon BK ──────────────────────────────────
  describe('Eidolon BuildingKind', () => {
    let types: string;
    beforeAll(() => { types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8'); });

    const bkValues = ['data_transformer', 'pipeline_orchestrator', 'data_enricher', 'etl_scheduler', 'format_converter'];
    bkValues.forEach(bk => {
      it(`has '${bk}' BK value`, () => { expect(types).toContain(`'${bk}'`); });
    });
  });

  // ─── Cross-cutting: Eidolon EK ──────────────────────────────────
  describe('Eidolon EventKind', () => {
    let types: string;
    beforeAll(() => { types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8'); });

    const ekValues = [
      'dtfm.transform_started', 'dtfm.transform_completed', 'dtfm.rule_created', 'dtfm.validation_failed',
      'ppor.pipeline_created', 'ppor.pipeline_started', 'ppor.pipeline_completed', 'ppor.stage_advanced',
      'denr.enrichment_started', 'denr.enrichment_completed', 'denr.source_configured', 'denr.source_failed',
      'etls.schedule_created', 'etls.run_started', 'etls.run_completed', 'etls.run_failed',
      'fmcv.conversion_started', 'fmcv.conversion_completed', 'fmcv.mapping_created', 'fmcv.format_detected'
    ];
    ekValues.forEach(ek => {
      it(`has '${ek}' EK value`, () => { expect(types).toContain(`'${ek}'`); });
    });
  });

  // ─── Cross-cutting: districtFor ─────────────────────────────────
  describe('districtFor', () => {
    let types: string;
    beforeAll(() => { types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8'); });

    const districts = ['data_transformer', 'pipeline_orchestrator', 'data_enricher', 'etl_scheduler', 'format_converter'];
    districts.forEach(d => {
      it(`has districtFor case '${d}'`, () => { expect(types).toContain(`case '${d}':`); });
    });
  });

  // ─── Cross-cutting: SUBJECT_MAP ─────────────────────────────────
  describe('SUBJECT_MAP', () => {
    let eventBus: string;
    beforeAll(() => { eventBus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8'); });

    const subjects = [
      'sven.dtfm.transform_started', 'sven.dtfm.transform_completed', 'sven.dtfm.rule_created', 'sven.dtfm.validation_failed',
      'sven.ppor.pipeline_created', 'sven.ppor.pipeline_started', 'sven.ppor.pipeline_completed', 'sven.ppor.stage_advanced',
      'sven.denr.enrichment_started', 'sven.denr.enrichment_completed', 'sven.denr.source_configured', 'sven.denr.source_failed',
      'sven.etls.schedule_created', 'sven.etls.run_started', 'sven.etls.run_completed', 'sven.etls.run_failed',
      'sven.fmcv.conversion_started', 'sven.fmcv.conversion_completed', 'sven.fmcv.mapping_created', 'sven.fmcv.format_detected'
    ];
    subjects.forEach(s => {
      it(`has '${s}' subject`, () => { expect(eventBus).toContain(`'${s}'`); });
    });
  });

  // ─── Cross-cutting: Task executor switch cases ──────────────────
  describe('Task executor switch cases', () => {
    let executor: string;
    beforeAll(() => { executor = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8'); });

    const cases = [
      'dtfm_transform_data', 'dtfm_batch_transform', 'dtfm_validate_schema', 'dtfm_create_rule', 'dtfm_preview_transform', 'dtfm_list_rules',
      'ppor_create_pipeline', 'ppor_run_pipeline', 'ppor_pause_pipeline', 'ppor_resume_pipeline', 'ppor_get_pipeline_status', 'ppor_list_pipelines',
      'denr_enrich_records', 'denr_configure_source', 'denr_preview_enrichment', 'denr_run_enrichment_job', 'denr_check_source_health', 'denr_list_sources',
      'etls_create_schedule', 'etls_update_schedule', 'etls_trigger_run', 'etls_get_run_history', 'etls_pause_schedule', 'etls_list_schedules',
      'fmcv_convert_file', 'fmcv_batch_convert', 'fmcv_detect_format', 'fmcv_create_mapping', 'fmcv_validate_output', 'fmcv_list_mappings'
    ];
    cases.forEach(c => {
      it(`has case '${c}'`, () => { expect(executor).toContain(`case '${c}'`); });
    });
  });

  // ─── Cross-cutting: Handler methods ─────────────────────────────
  describe('Task executor handler methods', () => {
    let executor: string;
    beforeAll(() => { executor = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8'); });

    const handlers = [
      'handleDtfmTransformData', 'handleDtfmBatchTransform', 'handleDtfmValidateSchema', 'handleDtfmCreateRule', 'handleDtfmPreviewTransform', 'handleDtfmListRules',
      'handlePporCreatePipeline', 'handlePporRunPipeline', 'handlePporPausePipeline', 'handlePporResumePipeline', 'handlePporGetPipelineStatus', 'handlePporListPipelines',
      'handleDenrEnrichRecords', 'handleDenrConfigureSource', 'handleDenrPreviewEnrichment', 'handleDenrRunEnrichmentJob', 'handleDenrCheckSourceHealth', 'handleDenrListSources',
      'handleEtlsCreateSchedule', 'handleEtlsUpdateSchedule', 'handleEtlsTriggerRun', 'handleEtlsGetRunHistory', 'handleEtlsPauseSchedule', 'handleEtlsListSchedules',
      'handleFmcvConvertFile', 'handleFmcvBatchConvert', 'handleFmcvDetectFormat', 'handleFmcvCreateMapping', 'handleFmcvValidateOutput', 'handleFmcvListMappings'
    ];
    handlers.forEach(h => {
      it(`has ${h} method`, () => { expect(executor).toContain(h); });
    });
  });

  // ─── Cross-cutting: .gitattributes ──────────────────────────────
  describe('.gitattributes', () => {
    let ga: string;
    beforeAll(() => { ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8'); });

    const entries = [
      '20260620100000_agent_data_transformer.sql',
      '20260620110000_agent_pipeline_orchestrator.sql',
      '20260620120000_agent_data_enricher.sql',
      '20260620130000_agent_etl_scheduler.sql',
      '20260620140000_agent_format_converter.sql',
      'agent-data-transformer.ts',
      'agent-pipeline-orchestrator.ts',
      'agent-data-enricher.ts',
      'agent-etl-scheduler.ts',
      'agent-format-converter.ts',
      'data-transformer/SKILL.md',
      'pipeline-orchestrator/SKILL.md',
      'data-enricher/SKILL.md',
      'etl-scheduler/SKILL.md',
      'format-converter/SKILL.md'
    ];
    entries.forEach(e => {
      it(`has entry for ${e}`, () => { expect(ga).toContain(e); });
    });
  });
});
