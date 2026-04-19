import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 763-767: Search & Discovery', () => {
  const verticals = [
    {
      name: 'search_index_builder', migration: '20260624000000_agent_search_index_builder.sql',
      typeFile: 'agent-search-index-builder.ts', skillDir: 'search-index-builder',
      interfaces: ['SearchIndexBuilderConfig', 'SearchIndex', 'BuilderEvent'],
      bk: 'search_index_builder', eks: ['sixb.index_created', 'sixb.documents_indexed', 'sixb.shard_balanced', 'sixb.alias_swapped'],
      subjects: ['sven.sixb.index_created', 'sven.sixb.documents_indexed', 'sven.sixb.shard_balanced', 'sven.sixb.alias_swapped'],
      cases: ['sixb_create', 'sixb_index', 'sixb_balance', 'sixb_swap', 'sixb_report', 'sixb_monitor'],
    },
    {
      name: 'fulltext_query_planner', migration: '20260624010000_agent_fulltext_query_planner.sql',
      typeFile: 'agent-fulltext-query-planner.ts', skillDir: 'fulltext-query-planner',
      interfaces: ['FulltextQueryPlannerConfig', 'QueryPlan', 'PlannerEvent'],
      bk: 'fulltext_query_planner', eks: ['ftqp.query_parsed', 'ftqp.plan_generated', 'ftqp.cache_hit', 'ftqp.results_returned'],
      subjects: ['sven.ftqp.query_parsed', 'sven.ftqp.plan_generated', 'sven.ftqp.cache_hit', 'sven.ftqp.results_returned'],
      cases: ['ftqp_parse', 'ftqp_generate', 'ftqp_hit', 'ftqp_return', 'ftqp_report', 'ftqp_monitor'],
    },
    {
      name: 'vector_embedding_indexer', migration: '20260624020000_agent_vector_embedding_indexer.sql',
      typeFile: 'agent-vector-embedding-indexer.ts', skillDir: 'vector-embedding-indexer',
      interfaces: ['VectorEmbeddingIndexerConfig', 'VectorIndex', 'IndexerEvent'],
      bk: 'vector_embedding_indexer', eks: ['vein.embedding_computed', 'vein.vector_indexed', 'vein.ann_built', 'vein.recall_measured'],
      subjects: ['sven.vein.embedding_computed', 'sven.vein.vector_indexed', 'sven.vein.ann_built', 'sven.vein.recall_measured'],
      cases: ['vein_compute', 'vein_index', 'vein_build', 'vein_measure', 'vein_report', 'vein_monitor'],
    },
    {
      name: 'faceted_search_engine', migration: '20260624030000_agent_faceted_search_engine.sql',
      typeFile: 'agent-faceted-search-engine.ts', skillDir: 'faceted-search-engine',
      interfaces: ['FacetedSearchEngineConfig', 'FacetedQuery', 'EngineEvent'],
      bk: 'faceted_search_engine', eks: ['fcse.facet_computed', 'fcse.filter_applied', 'fcse.bucket_aggregated', 'fcse.results_paginated'],
      subjects: ['sven.fcse.facet_computed', 'sven.fcse.filter_applied', 'sven.fcse.bucket_aggregated', 'sven.fcse.results_paginated'],
      cases: ['fcse_compute', 'fcse_apply', 'fcse_aggregate', 'fcse_paginate', 'fcse_report', 'fcse_monitor'],
    },
    {
      name: 'search_relevance_tuner', migration: '20260624040000_agent_search_relevance_tuner.sql',
      typeFile: 'agent-search-relevance-tuner.ts', skillDir: 'search-relevance-tuner',
      interfaces: ['SearchRelevanceTunerConfig', 'RelevanceModel', 'TunerEvent'],
      bk: 'search_relevance_tuner', eks: ['srtn.signal_collected', 'srtn.weights_optimized', 'srtn.ab_test_evaluated', 'srtn.model_promoted'],
      subjects: ['sven.srtn.signal_collected', 'sven.srtn.weights_optimized', 'sven.srtn.ab_test_evaluated', 'sven.srtn.model_promoted'],
      cases: ['srtn_collect', 'srtn_optimize', 'srtn_evaluate', 'srtn_promote', 'srtn_report', 'srtn_monitor'],
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
