import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1003-1007: Recommendation', () => {
  const verticals = [
    {
      name: 'recommendation_candidate_generator', migration: '20260626400000_agent_recommendation_candidate_generator.sql',
      typeFile: 'agent-recommendation-candidate-generator.ts', skillDir: 'recommendation-candidate-generator',
      interfaces: ['RecommendationCandidateGeneratorConfig', 'CandidateRequest', 'GeneratorEvent'],
      bk: 'recommendation_candidate_generator', eks: ['rcgn.request_received', 'rcgn.candidates_retrieved', 'rcgn.candidates_filtered', 'rcgn.results_returned'],
      subjects: ['sven.rcgn.request_received', 'sven.rcgn.candidates_retrieved', 'sven.rcgn.candidates_filtered', 'sven.rcgn.results_returned'],
      cases: ['rcgn_receive', 'rcgn_retrieve', 'rcgn_filter', 'rcgn_return', 'rcgn_report', 'rcgn_monitor'],
    },
    {
      name: 'recommendation_relevance_ranker', migration: '20260626410000_agent_recommendation_relevance_ranker.sql',
      typeFile: 'agent-recommendation-relevance-ranker.ts', skillDir: 'recommendation-relevance-ranker',
      interfaces: ['RecommendationRelevanceRankerConfig', 'RankingRequest', 'RankerEvent'],
      bk: 'recommendation_relevance_ranker', eks: ['rrrk.request_received', 'rrrk.scores_computed', 'rrrk.results_ordered', 'rrrk.audit_recorded'],
      subjects: ['sven.rrrk.request_received', 'sven.rrrk.scores_computed', 'sven.rrrk.results_ordered', 'sven.rrrk.audit_recorded'],
      cases: ['rrrk_receive', 'rrrk_compute', 'rrrk_order', 'rrrk_audit', 'rrrk_report', 'rrrk_monitor'],
    },
    {
      name: 'recommendation_diversifier', migration: '20260626420000_agent_recommendation_diversifier.sql',
      typeFile: 'agent-recommendation-diversifier.ts', skillDir: 'recommendation-diversifier',
      interfaces: ['RecommendationDiversifierConfig', 'DiversifyRequest', 'DiversifierEvent'],
      bk: 'recommendation_diversifier', eks: ['rcdv.request_received', 'rcdv.constraints_applied', 'rcdv.results_returned', 'rcdv.audit_recorded'],
      subjects: ['sven.rcdv.request_received', 'sven.rcdv.constraints_applied', 'sven.rcdv.results_returned', 'sven.rcdv.audit_recorded'],
      cases: ['rcdv_receive', 'rcdv_apply', 'rcdv_return', 'rcdv_audit', 'rcdv_report', 'rcdv_monitor'],
    },
    {
      name: 'recommendation_explanation_logger', migration: '20260626430000_agent_recommendation_explanation_logger.sql',
      typeFile: 'agent-recommendation-explanation-logger.ts', skillDir: 'recommendation-explanation-logger',
      interfaces: ['RecommendationExplanationLoggerConfig', 'ExplainRecord', 'LoggerEvent'],
      bk: 'recommendation_explanation_logger', eks: ['rcxl.record_received', 'rcxl.features_attributed', 'rcxl.record_persisted', 'rcxl.audit_recorded'],
      subjects: ['sven.rcxl.record_received', 'sven.rcxl.features_attributed', 'sven.rcxl.record_persisted', 'sven.rcxl.audit_recorded'],
      cases: ['rcxl_receive', 'rcxl_attribute', 'rcxl_persist', 'rcxl_audit', 'rcxl_report', 'rcxl_monitor'],
    },
    {
      name: 'recommendation_feedback_collector', migration: '20260626440000_agent_recommendation_feedback_collector.sql',
      typeFile: 'agent-recommendation-feedback-collector.ts', skillDir: 'recommendation-feedback-collector',
      interfaces: ['RecommendationFeedbackCollectorConfig', 'FeedbackEvent', 'CollectorEvent'],
      bk: 'recommendation_feedback_collector', eks: ['rcfc.event_received', 'rcfc.fields_validated', 'rcfc.feedback_persisted', 'rcfc.audit_recorded'],
      subjects: ['sven.rcfc.event_received', 'sven.rcfc.fields_validated', 'sven.rcfc.feedback_persisted', 'sven.rcfc.audit_recorded'],
      cases: ['rcfc_receive', 'rcfc_validate', 'rcfc_persist', 'rcfc_audit', 'rcfc_report', 'rcfc_monitor'],
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
