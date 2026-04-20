import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 773-777: Recommendation & Personalization', () => {
  const verticals = [
    {
      name: 'recommendation_ranker', migration: '20260624100000_agent_recommendation_ranker.sql',
      typeFile: 'agent-recommendation-ranker.ts', skillDir: 'recommendation-ranker',
      interfaces: ['RecommendationRankerConfig', 'Recommendation', 'RankerEvent'],
      bk: 'recommendation_ranker', eks: ['rcrk.candidates_fetched', 'rcrk.features_assembled', 'rcrk.scores_ranked', 'rcrk.diversification_applied'],
      subjects: ['sven.rcrk.candidates_fetched', 'sven.rcrk.features_assembled', 'sven.rcrk.scores_ranked', 'sven.rcrk.diversification_applied'],
      cases: ['rcrk_fetch', 'rcrk_assemble', 'rcrk_rank', 'rcrk_apply', 'rcrk_report', 'rcrk_monitor'],
    },
    {
      name: 'collaborative_filter', migration: '20260624110000_agent_collaborative_filter.sql',
      typeFile: 'agent-collaborative-filter.ts', skillDir: 'collaborative-filter',
      interfaces: ['CollaborativeFilterConfig', 'UserItemInteraction', 'FilterEvent'],
      bk: 'collaborative_filter', eks: ['clfl.matrix_factorized', 'clfl.neighbors_computed', 'clfl.predictions_generated', 'clfl.coldstart_handled'],
      subjects: ['sven.clfl.matrix_factorized', 'sven.clfl.neighbors_computed', 'sven.clfl.predictions_generated', 'sven.clfl.coldstart_handled'],
      cases: ['clfl_factorize', 'clfl_compute', 'clfl_generate', 'clfl_handle', 'clfl_report', 'clfl_monitor'],
    },
    {
      name: 'content_personalizer', migration: '20260624120000_agent_content_personalizer.sql',
      typeFile: 'agent-content-personalizer.ts', skillDir: 'content-personalizer',
      interfaces: ['ContentPersonalizerConfig', 'PersonalizedFeed', 'PersonalizerEvent'],
      bk: 'content_personalizer', eks: ['ctpe.profile_loaded', 'ctpe.content_filtered', 'ctpe.feed_assembled', 'ctpe.engagement_tracked'],
      subjects: ['sven.ctpe.profile_loaded', 'sven.ctpe.content_filtered', 'sven.ctpe.feed_assembled', 'sven.ctpe.engagement_tracked'],
      cases: ['ctpe_load', 'ctpe_filter', 'ctpe_assemble', 'ctpe_track', 'ctpe_report', 'ctpe_monitor'],
    },
    {
      name: 'trending_engine', migration: '20260624130000_agent_trending_engine.sql',
      typeFile: 'agent-trending-engine.ts', skillDir: 'trending-engine',
      interfaces: ['TrendingEngineConfig', 'TrendingTopic', 'EngineEvent'],
      bk: 'trending_engine', eks: ['trne.events_aggregated', 'trne.velocity_computed', 'trne.trend_emerged', 'trne.window_rolled'],
      subjects: ['sven.trne.events_aggregated', 'sven.trne.velocity_computed', 'sven.trne.trend_emerged', 'sven.trne.window_rolled'],
      cases: ['trne_aggregate', 'trne_compute', 'trne_emerge', 'trne_roll', 'trne_report', 'trne_monitor'],
    },
    {
      name: 'similar_item_finder', migration: '20260624140000_agent_similar_item_finder.sql',
      typeFile: 'agent-similar-item-finder.ts', skillDir: 'similar-item-finder',
      interfaces: ['SimilarItemFinderConfig', 'SimilarityResult', 'FinderEvent'],
      bk: 'similar_item_finder', eks: ['simf.candidate_set_built', 'simf.similarity_scored', 'simf.results_filtered', 'simf.cache_warmed'],
      subjects: ['sven.simf.candidate_set_built', 'sven.simf.similarity_scored', 'sven.simf.results_filtered', 'sven.simf.cache_warmed'],
      cases: ['simf_build', 'simf_score', 'simf_filter', 'simf_warm', 'simf_report', 'simf_monitor'],
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
