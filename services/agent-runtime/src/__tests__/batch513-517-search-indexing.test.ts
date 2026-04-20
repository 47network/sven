import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 513-517: Search & Indexing', () => {
  const verticals = [
    {
      name: 'index_builder', migration: '20260621500000_agent_index_builder.sql',
      typeFile: 'agent-index-builder.ts', skillDir: 'index-builder',
      interfaces: ['IndexBuilderConfig', 'IndexSchema', 'BuildProgress'],
      bk: 'index_builder', eks: ['ixbl.index_created', 'ixbl.index_rebuilt', 'ixbl.mapping_updated', 'ixbl.build_completed'],
      subjects: ['sven.ixbl.index_created', 'sven.ixbl.index_rebuilt', 'sven.ixbl.mapping_updated', 'sven.ixbl.build_completed'],
      cases: ['ixbl_create', 'ixbl_rebuild', 'ixbl_map', 'ixbl_monitor', 'ixbl_report', 'ixbl_configure'],
    },
    {
      name: 'facet_aggregator', migration: '20260621510000_agent_facet_aggregator.sql',
      typeFile: 'agent-facet-aggregator.ts', skillDir: 'facet-aggregator',
      interfaces: ['FacetAggregatorConfig', 'FacetBucket', 'AggregationResult'],
      bk: 'facet_aggregator', eks: ['fcag.facet_computed', 'fcag.aggregation_cached', 'fcag.bucket_updated', 'fcag.stats_refreshed'],
      subjects: ['sven.fcag.facet_computed', 'sven.fcag.aggregation_cached', 'sven.fcag.bucket_updated', 'sven.fcag.stats_refreshed'],
      cases: ['fcag_compute', 'fcag_cache', 'fcag_update', 'fcag_monitor', 'fcag_report', 'fcag_configure'],
    },
    {
      name: 'autocomplete_engine', migration: '20260621520000_agent_autocomplete_engine.sql',
      typeFile: 'agent-autocomplete-engine.ts', skillDir: 'autocomplete-engine',
      interfaces: ['AutocompleteEngineConfig', 'SuggestionEntry', 'CompletionResult'],
      bk: 'autocomplete_engine', eks: ['acen.suggestion_served', 'acen.corpus_updated', 'acen.model_retrained', 'acen.cache_warmed'],
      subjects: ['sven.acen.suggestion_served', 'sven.acen.corpus_updated', 'sven.acen.model_retrained', 'sven.acen.cache_warmed'],
      cases: ['acen_serve', 'acen_update', 'acen_retrain', 'acen_warm', 'acen_report', 'acen_monitor'],
    },
    {
      name: 'relevance_tuner', migration: '20260621530000_agent_relevance_tuner.sql',
      typeFile: 'agent-relevance-tuner.ts', skillDir: 'relevance-tuner',
      interfaces: ['RelevanceTunerConfig', 'TuningProfile', 'ScoreAdjustment'],
      bk: 'relevance_tuner', eks: ['rltn.profile_applied', 'rltn.boost_adjusted', 'rltn.decay_updated', 'rltn.experiment_started'],
      subjects: ['sven.rltn.profile_applied', 'sven.rltn.boost_adjusted', 'sven.rltn.decay_updated', 'sven.rltn.experiment_started'],
      cases: ['rltn_apply', 'rltn_boost', 'rltn_decay', 'rltn_experiment', 'rltn_report', 'rltn_monitor'],
    },
    {
      name: 'synonym_manager', migration: '20260621540000_agent_synonym_manager.sql',
      typeFile: 'agent-synonym-manager.ts', skillDir: 'synonym-manager',
      interfaces: ['SynonymManagerConfig', 'SynonymSet', 'ExpansionRule'],
      bk: 'synonym_manager', eks: ['symg.synonym_added', 'symg.set_merged', 'symg.expansion_applied', 'symg.dictionary_synced'],
      subjects: ['sven.symg.synonym_added', 'sven.symg.set_merged', 'sven.symg.expansion_applied', 'sven.symg.dictionary_synced'],
      cases: ['symg_add', 'symg_merge', 'symg_expand', 'symg_sync', 'symg_report', 'symg_monitor'],
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
      test('type file exports interfaces', () => {
        const content = fs.readFileSync(path.join(ROOT, 'packages/shared/src', v.typeFile), 'utf-8');
        v.interfaces.forEach((iface) => { expect(content).toContain(`export interface ${iface}`); });
      });
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`from './${v.typeFile.replace('.ts', '')}'`);
      });
      test('SKILL.md exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'))).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const content = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(content).toContain('## Actions');
      });
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => { expect(types).toContain(`'${ek}'`); });
      });
      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((subj) => { expect(eb).toContain(`'${subj}'`); });
      });
      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((cs) => { expect(te).toContain(`case '${cs}'`); });
      });
    });
  });
});
