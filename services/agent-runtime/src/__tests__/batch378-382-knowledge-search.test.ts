import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 378-382 — Knowledge & Search', () => {
  const verticals = [
    { batch: 378, name: 'knowledge_indexer', kebab: 'knowledge-indexer', prefix: 'knix', ts: 20260620150000, price: '12.99',
      cases: ['knix_index_document','knix_reindex_collection','knix_check_freshness','knix_get_index_stats','knix_delete_document','knix_configure_pipeline'],
      ek: ['knix.document_indexed','knix.index_completed','knix.freshness_checked','knix.document_deleted'],
      subjects: ['sven.knix.document_indexed','sven.knix.index_completed','sven.knix.freshness_checked','sven.knix.document_deleted'],
      types: ['IndexStrategy','DocumentStatus','EmbeddingModel','ChunkingMethod','KnowledgeIndexerConfig','KnowledgeDocument','KnowledgeChunk'] },
    { batch: 379, name: 'semantic_searcher', kebab: 'semantic-searcher', prefix: 'smsr', ts: 20260620160000, price: '0.05',
      cases: ['smsr_search','smsr_hybrid_search','smsr_rerank_results','smsr_find_similar','smsr_search_with_filters','smsr_explain_ranking'],
      ek: ['smsr.search_executed','smsr.results_reranked','smsr.similar_found','smsr.filters_applied'],
      subjects: ['sven.smsr.search_executed','sven.smsr.results_reranked','sven.smsr.similar_found','sven.smsr.filters_applied'],
      types: ['SearchStrategy','SearchType','RerankModel','ResultRelevance','SemanticSearcherConfig','SearchQuery','SearchResult'] },
    { batch: 380, name: 'taxonomy_builder', kebab: 'taxonomy-builder', prefix: 'txbr', ts: 20260620170000, price: '14.99',
      cases: ['txbr_build_taxonomy','txbr_classify_entity','txbr_merge_nodes','txbr_suggest_structure','txbr_export_taxonomy','txbr_validate_coverage'],
      ek: ['txbr.taxonomy_built','txbr.entity_classified','txbr.nodes_merged','txbr.coverage_validated'],
      subjects: ['sven.txbr.taxonomy_built','sven.txbr.entity_classified','sven.txbr.nodes_merged','sven.txbr.coverage_validated'],
      types: ['TaxonomyNodeType','ClassificationMethod','MergeStrategy','AssignmentSource','TaxonomyBuilderConfig','TaxonomyNode','TaxonomyAssignment'] },
    { batch: 381, name: 'content_curator', kebab: 'content-curator', prefix: 'ccur', ts: 20260620180000, price: '9.99',
      cases: ['ccur_create_collection','ccur_discover_content','ccur_curate_items','ccur_rank_collection','ccur_publish_collection','ccur_analyze_gaps'],
      ek: ['ccur.collection_created','ccur.content_discovered','ccur.collection_published','ccur.gaps_analyzed'],
      subjects: ['sven.ccur.collection_created','sven.ccur.content_discovered','sven.ccur.collection_published','sven.ccur.gaps_analyzed'],
      types: ['CurationStrategy','CollectionStatus','ContentQuality','SourceReliability','ContentCuratorConfig','CuratedCollection','CuratedItem'] },
    { batch: 382, name: 'insight_extractor', kebab: 'insight-extractor', prefix: 'inex', ts: 20260620190000, price: '7.99',
      cases: ['inex_extract_insights','inex_connect_insights','inex_prioritize_insights','inex_summarize_findings','inex_track_trends','inex_export_report'],
      ek: ['inex.insights_extracted','inex.insights_connected','inex.trends_tracked','inex.report_exported'],
      subjects: ['sven.inex.insights_extracted','sven.inex.insights_connected','sven.inex.trends_tracked','sven.inex.report_exported'],
      types: ['InsightType','InsightCategory','ConnectionType','ExtractionDepth','InsightExtractorConfig','ExtractedInsight','InsightConnection'] },
  ];

  // ─── Migration SQL ───
  describe('Migration SQL files', () => {
    verticals.forEach(v => {
      const file = path.join(ROOT, 'services/gateway-api/migrations', `${v.ts}_agent_${v.name}.sql`);
      it(`${v.ts}_agent_${v.name}.sql exists`, () => expect(fs.existsSync(file)).toBe(true));
      it(`${v.ts}_agent_${v.name}.sql has CREATE TABLE`, () => {
        const sql = fs.readFileSync(file, 'utf-8');
        expect(sql).toContain('CREATE TABLE');
      });
      it(`${v.ts}_agent_${v.name}.sql has CREATE INDEX`, () => {
        const sql = fs.readFileSync(file, 'utf-8');
        expect(sql).toContain('CREATE INDEX');
      });
    });
  });

  // ─── Shared Types ───
  describe('Shared type files', () => {
    verticals.forEach(v => {
      const file = path.join(ROOT, 'packages/shared/src', `agent-${v.kebab}.ts`);
      it(`agent-${v.kebab}.ts exists`, () => expect(fs.existsSync(file)).toBe(true));
      it(`agent-${v.kebab}.ts exports types`, () => {
        const ts = fs.readFileSync(file, 'utf-8');
        v.types.forEach(t => expect(ts).toContain(t));
      });
    });
  });

  // ─── Barrel exports ───
  describe('Barrel exports in index.ts', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`exports agent-${v.kebab}`, () => expect(idx).toContain(`./agent-${v.kebab}`));
    });
  });

  // ─── SKILL.md ───
  describe('SKILL.md files', () => {
    verticals.forEach(v => {
      const file = path.join(ROOT, 'skills/autonomous-economy', v.kebab, 'SKILL.md');
      it(`${v.kebab}/SKILL.md exists`, () => expect(fs.existsSync(file)).toBe(true));
      it(`${v.kebab}/SKILL.md has pricing ${v.price}`, () => {
        const md = fs.readFileSync(file, 'utf-8');
        expect(md).toContain(v.price);
      });
      it(`${v.kebab}/SKILL.md has actions`, () => {
        const md = fs.readFileSync(file, 'utf-8');
        expect(md).toContain('## Actions');
      });
    });
  });

  // ─── Eidolon BK ───
  describe('Eidolon BuildingKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`has '${v.name}' in BK`, () => expect(types).toContain(`'${v.name}'`));
    });
  });

  // ─── Eidolon EK ───
  describe('Eidolon EventKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => {
      v.ek.forEach(ek => {
        it(`has '${ek}' in EK`, () => expect(types).toContain(`'${ek}'`));
      });
    });
  });

  // ─── districtFor ───
  describe('districtFor cases', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`has case '${v.name}' in districtFor`, () => expect(types).toContain(`case '${v.name}':`));
    });
  });

  // ─── SUBJECT_MAP ───
  describe('SUBJECT_MAP entries', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    verticals.forEach(v => {
      v.subjects.forEach(subj => {
        it(`has '${subj}' in SUBJECT_MAP`, () => expect(bus).toContain(`'${subj}'`));
      });
    });
  });

  // ─── Task executor switch cases ───
  describe('Task executor switch cases', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    verticals.forEach(v => {
      v.cases.forEach(c => {
        it(`has case '${c}'`, () => expect(exec).toContain(`case '${c}'`));
      });
    });
  });

  // ─── Task executor handler methods ───
  describe('Task executor handler methods', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handleKnixIndexDocument','handleKnixReindexCollection','handleKnixCheckFreshness',
      'handleKnixGetIndexStats','handleKnixDeleteDocument','handleKnixConfigurePipeline',
      'handleSmsrSearch','handleSmsrHybridSearch','handleSmsrRerankResults',
      'handleSmsrFindSimilar','handleSmsrSearchWithFilters','handleSmsrExplainRanking',
      'handleTxbrBuildTaxonomy','handleTxbrClassifyEntity','handleTxbrMergeNodes',
      'handleTxbrSuggestStructure','handleTxbrExportTaxonomy','handleTxbrValidateCoverage',
      'handleCcurCreateCollection','handleCcurDiscoverContent','handleCcurCurateItems',
      'handleCcurRankCollection','handleCcurPublishCollection','handleCcurAnalyzeGaps',
      'handleInexExtractInsights','handleInexConnectInsights','handleInexPrioritizeInsights',
      'handleInexSummarizeFindings','handleInexTrackTrends','handleInexExportReport',
    ];
    handlers.forEach(h => {
      it(`has handler ${h}`, () => expect(exec).toContain(h));
    });
  });

  // ─── .gitattributes ───
  describe('.gitattributes privacy entries', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    verticals.forEach(v => {
      it(`has entry for ${v.ts}_agent_${v.name}.sql`, () => expect(ga).toContain(`${v.ts}_agent_${v.name}.sql`));
      it(`has entry for agent-${v.kebab}.ts`, () => expect(ga).toContain(`agent-${v.kebab}.ts`));
      it(`has entry for ${v.kebab}/SKILL.md`, () => expect(ga).toContain(`${v.kebab}/SKILL.md`));
    });
  });
});
