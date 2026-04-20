import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ── helpers ──
function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}
function migrationPath(name: string): string {
  const dir = path.join(ROOT, 'services/gateway-api/migrations');
  const f = fs.readdirSync(dir).find((fn) => fn.includes(name));
  return f ? path.join(dir, f) : '';
}

// ════════════════════════════════════════════════════════════
// Batch 203 — stream_processor
// ════════════════════════════════════════════════════════════
describe('Batch 203 — stream_processor', () => {
  describe('Migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618400000_agent_stream_processor.sql');
    it('creates agent_stream_sources table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_stream_sources'));
    it('creates agent_stream_transforms table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_stream_transforms'));
    it('creates agent_stream_sinks table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_stream_sinks'));
    it('has source_type column', () => expect(sql).toContain('source_type'));
    it('has format column', () => expect(sql).toContain('format'));
  });

  describe('Shared types', () => {
    const ts = readFile('packages/shared/src/agent-stream-processor.ts');
    it('exports StreamSource', () => expect(ts).toContain('StreamSource'));
    it('exports StreamTransform', () => expect(ts).toContain('StreamTransform'));
    it('exports StreamSink', () => expect(ts).toContain('StreamSink'));
    it('has source type union', () => expect(ts).toMatch(/kafka|kinesis|rabbitmq/));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-stream-processor', () => expect(idx).toContain("from './agent-stream-processor"));
  });

  describe('SKILL.md', () => {
    const sk = readFile('skills/agent-stream-processor/SKILL.md');
    it('exists with Actions section', () => expect(sk).toContain('## Actions'));
    it('has stream-related content', () => expect(sk.toLowerCase()).toContain('stream'));
  });

  describe('Eidolon types.ts', () => {
    const t = readFile('services/sven-eidolon/src/types.ts');
    it('has stream_processor BK', () => expect(t).toContain("'stream_processor'"));
    it('has stream.source_created EK', () => expect(t).toContain("'stream.source_created'"));
    it('has stream.source_active EK', () => expect(t).toContain("'stream.source_active'"));
    it('has stream.source_error EK', () => expect(t).toContain("'stream.source_error'"));
    it('has stream.sink_delivered EK', () => expect(t).toContain("'stream.sink_delivered'"));
    it('has districtFor stream_processor', () => expect(t).toContain("case 'stream_processor'"));
  });

  describe('Event-bus', () => {
    const eb = readFile('services/sven-eidolon/src/event-bus.ts');
    it('maps sven.stream.source_created', () => expect(eb).toContain("'sven.stream.source_created'"));
    it('maps sven.stream.source_active', () => expect(eb).toContain("'sven.stream.source_active'"));
    it('maps sven.stream.source_error', () => expect(eb).toContain("'sven.stream.source_error'"));
    it('maps sven.stream.sink_delivered', () => expect(eb).toContain("'sven.stream.sink_delivered'"));
  });

  describe('Task executor', () => {
    const te = readFile('services/sven-marketplace/src/task-executor.ts');
    it('has stream_create_source case', () => expect(te).toContain("case 'stream_create_source'"));
    it('has stream_add_transform case', () => expect(te).toContain("case 'stream_add_transform'"));
    it('has stream_create_sink case', () => expect(te).toContain("case 'stream_create_sink'"));
    it('has stream_start case', () => expect(te).toContain("case 'stream_start'"));
    it('has stream_view_metrics case', () => expect(te).toContain("case 'stream_view_metrics'"));
    it('has stream_pause case', () => expect(te).toContain("case 'stream_pause'"));
    it('has handleStreamCreateSource method', () => expect(te).toContain('handleStreamCreateSource'));
    it('has handleStreamPause method', () => expect(te).toContain('handleStreamPause'));
  });

  describe('.gitattributes', () => {
    const ga = readFile('.gitattributes');
    it('has stream_processor migration filter', () => expect(ga).toContain('agent_stream_processor.sql filter=sven-private'));
    it('has stream_processor types filter', () => expect(ga).toContain('agent-stream-processor.ts filter=sven-private'));
    it('has stream_processor skill filter', () => expect(ga).toContain('agent-stream-processor/SKILL.md filter=sven-private'));
  });
});

// ════════════════════════════════════════════════════════════
// Batch 204 — schema_validator
// ════════════════════════════════════════════════════════════
describe('Batch 204 — schema_validator', () => {
  describe('Migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618410000_agent_schema_validator.sql');
    it('creates agent_schema_definitions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_schema_definitions'));
    it('creates agent_schema_validations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_schema_validations'));
    it('creates agent_schema_evolution_checks table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_schema_evolution_checks'));
    it('has schema_format column', () => expect(sql).toContain('schema_format'));
  });

  describe('Shared types', () => {
    const ts = readFile('packages/shared/src/agent-schema-validator.ts');
    it('exports SchemaDefinition', () => expect(ts).toContain('SchemaDefinition'));
    it('exports SchemaValidation', () => expect(ts).toContain('SchemaValidation'));
    it('exports SchemaEvolutionCheck', () => expect(ts).toContain('SchemaEvolutionCheck'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-schema-validator', () => expect(idx).toContain("from './agent-schema-validator"));
  });

  describe('SKILL.md', () => {
    const sk = readFile('skills/agent-schema-validator/SKILL.md');
    it('exists with Actions section', () => expect(sk).toContain('## Actions'));
    it('has schema-related content', () => expect(sk.toLowerCase()).toContain('schema'));
  });

  describe('Eidolon types.ts', () => {
    const t = readFile('services/sven-eidolon/src/types.ts');
    it('has schema_validator BK', () => expect(t).toContain("'schema_validator'"));
    it('has schema.definition_created EK', () => expect(t).toContain("'schema.definition_created'"));
    it('has schema.validation_failed EK', () => expect(t).toContain("'schema.validation_failed'"));
    it('has schema.evolution_checked EK', () => expect(t).toContain("'schema.evolution_checked'"));
    it('has schema.compatibility_broken EK', () => expect(t).toContain("'schema.compatibility_broken'"));
    it('has districtFor schema_validator', () => expect(t).toContain("case 'schema_validator'"));
  });

  describe('Event-bus', () => {
    const eb = readFile('services/sven-eidolon/src/event-bus.ts');
    it('maps sven.schema.definition_created', () => expect(eb).toContain("'sven.schema.definition_created'"));
    it('maps sven.schema.validation_failed', () => expect(eb).toContain("'sven.schema.validation_failed'"));
    it('maps sven.schema.evolution_checked', () => expect(eb).toContain("'sven.schema.evolution_checked'"));
    it('maps sven.schema.compatibility_broken', () => expect(eb).toContain("'sven.schema.compatibility_broken'"));
  });

  describe('Task executor', () => {
    const te = readFile('services/sven-marketplace/src/task-executor.ts');
    it('has schema_create case', () => expect(te).toContain("case 'schema_create'"));
    it('has schema_validate case', () => expect(te).toContain("case 'schema_validate'"));
    it('has schema_check_evolution case', () => expect(te).toContain("case 'schema_check_evolution'"));
    it('has schema_deprecate case', () => expect(te).toContain("case 'schema_deprecate'"));
    it('has schema_list case', () => expect(te).toContain("case 'schema_list'"));
    it('has schema_compare case', () => expect(te).toContain("case 'schema_compare'"));
    it('has handleSchemaCreate method', () => expect(te).toContain('handleSchemaCreate'));
    it('has handleSchemaCompare method', () => expect(te).toContain('handleSchemaCompare'));
  });

  describe('.gitattributes', () => {
    const ga = readFile('.gitattributes');
    it('has schema_validator migration filter', () => expect(ga).toContain('agent_schema_validator.sql filter=sven-private'));
    it('has schema_validator types filter', () => expect(ga).toContain('agent-schema-validator.ts filter=sven-private'));
    it('has schema_validator skill filter', () => expect(ga).toContain('agent-schema-validator/SKILL.md filter=sven-private'));
  });
});

// ════════════════════════════════════════════════════════════
// Batch 205 — etl_processor
// ════════════════════════════════════════════════════════════
describe('Batch 205 — etl_processor', () => {
  describe('Migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618420000_agent_etl_processor.sql');
    it('creates agent_etl_pipelines table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_etl_pipelines'));
    it('creates agent_etl_runs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_etl_runs'));
    it('creates agent_etl_schedules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_etl_schedules'));
    it('has source_config column', () => expect(sql).toContain('source_config'));
  });

  describe('Shared types', () => {
    const ts = readFile('packages/shared/src/agent-etl-processor.ts');
    it('exports EtlPipeline', () => expect(ts).toContain('EtlPipeline'));
    it('exports EtlRun', () => expect(ts).toContain('EtlRun'));
    it('exports EtlSchedule', () => expect(ts).toContain('EtlSchedule'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-etl-processor', () => expect(idx).toContain("from './agent-etl-processor"));
  });

  describe('SKILL.md', () => {
    const sk = readFile('skills/agent-etl-processor/SKILL.md');
    it('exists with Actions section', () => expect(sk).toContain('## Actions'));
    it('has etl-related content', () => expect(sk.toLowerCase()).toContain('etl'));
  });

  describe('Eidolon types.ts', () => {
    const t = readFile('services/sven-eidolon/src/types.ts');
    it('has etl_processor BK', () => expect(t).toContain("'etl_processor'"));
    it('has etl.pipeline_created EK', () => expect(t).toContain("'etl.pipeline_created'"));
    it('has etl.run_started EK', () => expect(t).toContain("'etl.run_started'"));
    it('has etl.run_completed EK', () => expect(t).toContain("'etl.run_completed'"));
    it('has etl.run_failed EK', () => expect(t).toContain("'etl.run_failed'"));
    it('has districtFor etl_processor', () => expect(t).toContain("case 'etl_processor'"));
  });

  describe('Event-bus', () => {
    const eb = readFile('services/sven-eidolon/src/event-bus.ts');
    it('maps sven.etl.pipeline_created', () => expect(eb).toContain("'sven.etl.pipeline_created'"));
    it('maps sven.etl.run_started', () => expect(eb).toContain("'sven.etl.run_started'"));
    it('maps sven.etl.run_completed', () => expect(eb).toContain("'sven.etl.run_completed'"));
    it('maps sven.etl.run_failed', () => expect(eb).toContain("'sven.etl.run_failed'"));
  });

  describe('Task executor', () => {
    const te = readFile('services/sven-marketplace/src/task-executor.ts');
    it('has etl_create_pipeline case', () => expect(te).toContain("case 'etl_create_pipeline'"));
    it('has etl_run_pipeline case', () => expect(te).toContain("case 'etl_run_pipeline'"));
    it('has etl_schedule case', () => expect(te).toContain("case 'etl_schedule'"));
    it('has etl_view_history case', () => expect(te).toContain("case 'etl_view_history'"));
    it('has etl_pause case', () => expect(te).toContain("case 'etl_pause'"));
    it('has etl_retry_failed case', () => expect(te).toContain("case 'etl_retry_failed'"));
    it('has handleEtlCreatePipeline method', () => expect(te).toContain('handleEtlCreatePipeline'));
    it('has handleEtlRetryFailed method', () => expect(te).toContain('handleEtlRetryFailed'));
  });

  describe('.gitattributes', () => {
    const ga = readFile('.gitattributes');
    it('has etl_processor migration filter', () => expect(ga).toContain('agent_etl_processor.sql filter=sven-private'));
    it('has etl_processor types filter', () => expect(ga).toContain('agent-etl-processor.ts filter=sven-private'));
    it('has etl_processor skill filter', () => expect(ga).toContain('agent-etl-processor/SKILL.md filter=sven-private'));
  });
});

// ════════════════════════════════════════════════════════════
// Batch 206 — data_catalog
// ════════════════════════════════════════════════════════════
describe('Batch 206 — data_catalog', () => {
  describe('Migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618430000_agent_data_catalog.sql');
    it('creates agent_data_assets table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_data_assets'));
    it('creates agent_data_lineage table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_data_lineage'));
    it('creates agent_data_profiles table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_data_profiles'));
    it('has asset_type column', () => expect(sql).toContain('asset_type'));
  });

  describe('Shared types', () => {
    const ts = readFile('packages/shared/src/agent-data-catalog.ts');
    it('exports DataAsset', () => expect(ts).toContain('DataAsset'));
    it('exports DataLineage', () => expect(ts).toContain('DataLineage'));
    it('exports DataProfile', () => expect(ts).toContain('DataProfile'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-data-catalog', () => expect(idx).toContain("from './agent-data-catalog"));
  });

  describe('SKILL.md', () => {
    const sk = readFile('skills/agent-data-catalog/SKILL.md');
    it('exists with Actions section', () => expect(sk).toContain('## Actions'));
    it('has catalog-related content', () => expect(sk.toLowerCase()).toContain('catalog'));
  });

  describe('Eidolon types.ts', () => {
    const t = readFile('services/sven-eidolon/src/types.ts');
    it('has data_catalog BK', () => expect(t).toContain("'data_catalog'"));
    it('has catalog.asset_registered EK', () => expect(t).toContain("'catalog.asset_registered'"));
    it('has catalog.lineage_traced EK', () => expect(t).toContain("'catalog.lineage_traced'"));
    it('has catalog.profile_completed EK', () => expect(t).toContain("'catalog.profile_completed'"));
    it('has catalog.quality_scored EK', () => expect(t).toContain("'catalog.quality_scored'"));
    it('has districtFor data_catalog', () => expect(t).toContain("case 'data_catalog'"));
  });

  describe('Event-bus', () => {
    const eb = readFile('services/sven-eidolon/src/event-bus.ts');
    it('maps sven.catalog.asset_registered', () => expect(eb).toContain("'sven.catalog.asset_registered'"));
    it('maps sven.catalog.lineage_traced', () => expect(eb).toContain("'sven.catalog.lineage_traced'"));
    it('maps sven.catalog.profile_completed', () => expect(eb).toContain("'sven.catalog.profile_completed'"));
    it('maps sven.catalog.quality_scored', () => expect(eb).toContain("'sven.catalog.quality_scored'"));
  });

  describe('Task executor', () => {
    const te = readFile('services/sven-marketplace/src/task-executor.ts');
    it('has catalog_register_asset case', () => expect(te).toContain("case 'catalog_register_asset'"));
    it('has catalog_trace_lineage case', () => expect(te).toContain("case 'catalog_trace_lineage'"));
    it('has catalog_profile_asset case', () => expect(te).toContain("case 'catalog_profile_asset'"));
    it('has catalog_search case', () => expect(te).toContain("case 'catalog_search'"));
    it('has catalog_score_quality case', () => expect(te).toContain("case 'catalog_score_quality'"));
    it('has catalog_list_assets case', () => expect(te).toContain("case 'catalog_list_assets'"));
    it('has handleCatalogRegisterAsset method', () => expect(te).toContain('handleCatalogRegisterAsset'));
    it('has handleCatalogListAssets method', () => expect(te).toContain('handleCatalogListAssets'));
  });

  describe('.gitattributes', () => {
    const ga = readFile('.gitattributes');
    it('has data_catalog migration filter', () => expect(ga).toContain('agent_data_catalog.sql filter=sven-private'));
    it('has data_catalog types filter', () => expect(ga).toContain('agent-data-catalog.ts filter=sven-private'));
    it('has data_catalog skill filter', () => expect(ga).toContain('agent-data-catalog/SKILL.md filter=sven-private'));
  });
});

// ════════════════════════════════════════════════════════════
// Batch 207 — query_optimizer
// ════════════════════════════════════════════════════════════
describe('Batch 207 — query_optimizer', () => {
  describe('Migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618440000_agent_query_optimizer.sql');
    it('creates agent_query_analyses table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_query_analyses'));
    it('creates agent_query_suggestions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_query_suggestions'));
    it('creates agent_query_plan_cache table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_query_plan_cache'));
    it('has query_hash column', () => expect(sql).toContain('query_hash'));
  });

  describe('Shared types', () => {
    const ts = readFile('packages/shared/src/agent-query-optimizer.ts');
    it('exports QueryAnalysis', () => expect(ts).toContain('QueryAnalysis'));
    it('exports QuerySuggestion', () => expect(ts).toContain('QuerySuggestion'));
    it('exports QueryPlanCache', () => expect(ts).toContain('QueryPlanCache'));
  });

  describe('Barrel export', () => {
    const idx = readFile('packages/shared/src/index.ts');
    it('exports agent-query-optimizer', () => expect(idx).toContain("from './agent-query-optimizer"));
  });

  describe('SKILL.md', () => {
    const sk = readFile('skills/agent-query-optimizer/SKILL.md');
    it('exists with Actions section', () => expect(sk).toContain('## Actions'));
    it('has query-related content', () => expect(sk.toLowerCase()).toContain('query'));
  });

  describe('Eidolon types.ts', () => {
    const t = readFile('services/sven-eidolon/src/types.ts');
    it('has query_optimizer BK', () => expect(t).toContain("'query_optimizer'"));
    it('has query.analyzed EK', () => expect(t).toContain("'query.analyzed'"));
    it('has query.suggestion_generated EK', () => expect(t).toContain("'query.suggestion_generated'"));
    it('has query.plan_cached EK', () => expect(t).toContain("'query.plan_cached'"));
    it('has query.optimization_applied EK', () => expect(t).toContain("'query.optimization_applied'"));
    it('has districtFor query_optimizer', () => expect(t).toContain("case 'query_optimizer'"));
  });

  describe('Event-bus', () => {
    const eb = readFile('services/sven-eidolon/src/event-bus.ts');
    it('maps sven.query.analyzed', () => expect(eb).toContain("'sven.query.analyzed'"));
    it('maps sven.query.suggestion_generated', () => expect(eb).toContain("'sven.query.suggestion_generated'"));
    it('maps sven.query.plan_cached', () => expect(eb).toContain("'sven.query.plan_cached'"));
    it('maps sven.query.optimization_applied', () => expect(eb).toContain("'sven.query.optimization_applied'"));
  });

  describe('Task executor', () => {
    const te = readFile('services/sven-marketplace/src/task-executor.ts');
    it('has query_analyze case', () => expect(te).toContain("case 'query_analyze'"));
    it('has query_suggest case', () => expect(te).toContain("case 'query_suggest'"));
    it('has query_cache_plan case', () => expect(te).toContain("case 'query_cache_plan'"));
    it('has query_apply_suggestion case', () => expect(te).toContain("case 'query_apply_suggestion'"));
    it('has query_view_slow case', () => expect(te).toContain("case 'query_view_slow'"));
    it('has query_explain case', () => expect(te).toContain("case 'query_explain'"));
    it('has handleQueryAnalyze method', () => expect(te).toContain('handleQueryAnalyze'));
    it('has handleQueryExplain method', () => expect(te).toContain('handleQueryExplain'));
  });

  describe('.gitattributes', () => {
    const ga = readFile('.gitattributes');
    it('has query_optimizer migration filter', () => expect(ga).toContain('agent_query_optimizer.sql filter=sven-private'));
    it('has query_optimizer types filter', () => expect(ga).toContain('agent-query-optimizer.ts filter=sven-private'));
    it('has query_optimizer skill filter', () => expect(ga).toContain('agent-query-optimizer/SKILL.md filter=sven-private'));
  });
});
