import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 558-562: Search & Discovery', () => {
  const verticals = [
    {
      name: 'semantic_indexer', migration: '20260621950000_agent_semantic_indexer.sql',
      typeFile: 'agent-semantic-indexer.ts', skillDir: 'semantic-indexer',
      interfaces: ['SemanticIndexerConfig', 'IndexEntry', 'IndexStats'],
      bk: 'semantic_indexer', eks: ['sidx.document_indexed', 'sidx.index_rebuilt', 'sidx.embedding_generated', 'sidx.index_optimized'],
      subjects: ['sven.sidx.document_indexed', 'sven.sidx.index_rebuilt', 'sven.sidx.embedding_generated', 'sven.sidx.index_optimized'],
      cases: ['sidx_index', 'sidx_rebuild', 'sidx_embed', 'sidx_optimize', 'sidx_report', 'sidx_monitor'],
    },
    {
      name: 'faceted_search', migration: '20260621960000_agent_faceted_search.sql',
      typeFile: 'agent-faceted-search.ts', skillDir: 'faceted-search',
      interfaces: ['FacetedSearchConfig', 'SearchResult', 'FacetDefinition'],
      bk: 'faceted_search', eks: ['fcsr.query_executed', 'fcsr.facet_computed', 'fcsr.result_ranked', 'fcsr.cache_refreshed'],
      subjects: ['sven.fcsr.query_executed', 'sven.fcsr.facet_computed', 'sven.fcsr.result_ranked', 'sven.fcsr.cache_refreshed'],
      cases: ['fcsr_query', 'fcsr_facet', 'fcsr_rank', 'fcsr_cache', 'fcsr_report', 'fcsr_monitor'],
    },
    {
      name: 'suggestion_engine', migration: '20260621970000_agent_suggestion_engine.sql',
      typeFile: 'agent-suggestion-engine.ts', skillDir: 'suggestion-engine',
      interfaces: ['SuggestionEngineConfig', 'Suggestion', 'SuggestionModel'],
      bk: 'suggestion_engine', eks: ['sgen.suggestion_generated', 'sgen.model_trained', 'sgen.feedback_received', 'sgen.config_updated'],
      subjects: ['sven.sgen.suggestion_generated', 'sven.sgen.model_trained', 'sven.sgen.feedback_received', 'sven.sgen.config_updated'],
      cases: ['sgen_generate', 'sgen_train', 'sgen_feedback', 'sgen_config', 'sgen_report', 'sgen_monitor'],
    },
    {
      name: 'autocomplete_builder', migration: '20260621980000_agent_autocomplete_builder.sql',
      typeFile: 'agent-autocomplete-builder.ts', skillDir: 'autocomplete-builder',
      interfaces: ['AutocompleteBuilderConfig', 'CompletionEntry', 'PrefixTree'],
      bk: 'autocomplete_builder', eks: ['acbl.tree_built', 'acbl.completion_served', 'acbl.dictionary_updated', 'acbl.stats_computed'],
      subjects: ['sven.acbl.tree_built', 'sven.acbl.completion_served', 'sven.acbl.dictionary_updated', 'sven.acbl.stats_computed'],
      cases: ['acbl_build', 'acbl_serve', 'acbl_update', 'acbl_stats', 'acbl_report', 'acbl_monitor'],
    },
    {
      name: 'catalog_crawler', migration: '20260621990000_agent_catalog_crawler.sql',
      typeFile: 'agent-catalog-crawler.ts', skillDir: 'catalog-crawler',
      interfaces: ['CatalogCrawlerConfig', 'CrawlResult', 'CrawlSchedule'],
      bk: 'catalog_crawler', eks: ['ctcr.crawl_started', 'ctcr.page_indexed', 'ctcr.crawl_completed', 'ctcr.error_encountered'],
      subjects: ['sven.ctcr.crawl_started', 'sven.ctcr.page_indexed', 'sven.ctcr.crawl_completed', 'sven.ctcr.error_encountered'],
      cases: ['ctcr_crawl', 'ctcr_page', 'ctcr_complete', 'ctcr_error', 'ctcr_report', 'ctcr_monitor'],
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
