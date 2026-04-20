import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 638-642: Search & Indexing', () => {
  const verticals = [
    {
      name: 'shard_balancer', migration: '20260622750000_agent_shard_balancer.sql',
      typeFile: 'agent-shard-balancer.ts', skillDir: 'shard-balancer',
      interfaces: ['ShardBalancerConfig', 'ShardAssignment', 'BalancerEvent'],
      bk: 'shard_balancer', eks: ['shbl.shard_moved', 'shbl.balance_achieved', 'shbl.hotspot_detected', 'shbl.rebalance_started'],
      subjects: ['sven.shbl.shard_moved', 'sven.shbl.balance_achieved', 'sven.shbl.hotspot_detected', 'sven.shbl.rebalance_started'],
      cases: ['shbl_move', 'shbl_balance', 'shbl_hotspot', 'shbl_rebalance', 'shbl_report', 'shbl_monitor'],
    },
    {
      name: 'search_ranker', migration: '20260622760000_agent_search_ranker.sql',
      typeFile: 'agent-search-ranker.ts', skillDir: 'search-ranker',
      interfaces: ['SearchRankerConfig', 'RankingResult', 'RankerEvent'],
      bk: 'search_ranker', eks: ['srra.ranking_computed', 'srra.model_updated', 'srra.feedback_processed', 'srra.ab_test_started'],
      subjects: ['sven.srra.ranking_computed', 'sven.srra.model_updated', 'sven.srra.feedback_processed', 'sven.srra.ab_test_started'],
      cases: ['srra_rank', 'srra_model', 'srra_feedback', 'srra_abtest', 'srra_report', 'srra_monitor'],
    },
    {
      name: 'facet_extractor', migration: '20260622770000_agent_facet_extractor.sql',
      typeFile: 'agent-facet-extractor.ts', skillDir: 'facet-extractor',
      interfaces: ['FacetExtractorConfig', 'FacetResult', 'ExtractorEvent'],
      bk: 'facet_extractor', eks: ['faex.facets_extracted', 'faex.taxonomy_updated', 'faex.cardinality_high', 'faex.cache_refreshed'],
      subjects: ['sven.faex.facets_extracted', 'sven.faex.taxonomy_updated', 'sven.faex.cardinality_high', 'sven.faex.cache_refreshed'],
      cases: ['faex_extract', 'faex_taxonomy', 'faex_cardinality', 'faex_cache', 'faex_report', 'faex_monitor'],
    },
    {
      name: 'synonym_mapper', migration: '20260622780000_agent_synonym_mapper.sql',
      typeFile: 'agent-synonym-mapper.ts', skillDir: 'synonym-mapper',
      interfaces: ['SynonymMapperConfig', 'SynonymGroup', 'MapperEvent'],
      bk: 'synonym_mapper', eks: ['synm.synonym_added', 'synm.group_merged', 'synm.dictionary_imported', 'synm.conflict_resolved'],
      subjects: ['sven.synm.synonym_added', 'sven.synm.group_merged', 'sven.synm.dictionary_imported', 'sven.synm.conflict_resolved'],
      cases: ['synm_add', 'synm_merge', 'synm_import', 'synm_resolve', 'synm_report', 'synm_monitor'],
    },
    {
      name: 'index_compactor', migration: '20260622790000_agent_index_compactor.sql',
      typeFile: 'agent-index-compactor.ts', skillDir: 'index-compactor',
      interfaces: ['IndexCompactorConfig', 'CompactionResult', 'CompactorEvent'],
      bk: 'index_compactor', eks: ['ixco.segment_merged', 'ixco.compaction_completed', 'ixco.space_reclaimed', 'ixco.force_merge_started'],
      subjects: ['sven.ixco.segment_merged', 'sven.ixco.compaction_completed', 'sven.ixco.space_reclaimed', 'sven.ixco.force_merge_started'],
      cases: ['ixco_merge', 'ixco_compact', 'ixco_reclaim', 'ixco_force', 'ixco_report', 'ixco_monitor'],
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
