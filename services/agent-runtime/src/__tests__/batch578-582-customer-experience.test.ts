import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 578-582: Customer Experience & Feedback', () => {
  const verticals = [
    {
      name: 'satisfaction_surveyor', migration: '20260622150000_agent_satisfaction_surveyor.sql',
      typeFile: 'agent-satisfaction-surveyor.ts', skillDir: 'satisfaction-surveyor',
      interfaces: ['SatisfactionSurveyorConfig', 'SurveyResult', 'SatisfactionScore'],
      bk: 'satisfaction_surveyor', eks: ['stsv.survey_sent', 'stsv.response_received', 'stsv.score_computed', 'stsv.trend_detected'],
      subjects: ['sven.stsv.survey_sent', 'sven.stsv.response_received', 'sven.stsv.score_computed', 'sven.stsv.trend_detected'],
      cases: ['stsv_send', 'stsv_response', 'stsv_score', 'stsv_trend', 'stsv_report', 'stsv_monitor'],
    },
    {
      name: 'nps_calculator', migration: '20260622160000_agent_nps_calculator.sql',
      typeFile: 'agent-nps-calculator.ts', skillDir: 'nps-calculator',
      interfaces: ['NpsCalculatorConfig', 'NpsResult', 'PromoterSegment'],
      bk: 'nps_calculator', eks: ['npsc.score_calculated', 'npsc.benchmark_compared', 'npsc.segment_identified', 'npsc.alert_triggered'],
      subjects: ['sven.npsc.score_calculated', 'sven.npsc.benchmark_compared', 'sven.npsc.segment_identified', 'sven.npsc.alert_triggered'],
      cases: ['npsc_calculate', 'npsc_benchmark', 'npsc_segment', 'npsc_alert', 'npsc_report', 'npsc_monitor'],
    },
    {
      name: 'churn_predictor', migration: '20260622170000_agent_churn_predictor.sql',
      typeFile: 'agent-churn-predictor.ts', skillDir: 'churn-predictor',
      interfaces: ['ChurnPredictorConfig', 'ChurnPrediction', 'RiskFactor'],
      bk: 'churn_predictor', eks: ['chrp.prediction_made', 'chrp.high_risk_detected', 'chrp.intervention_suggested', 'chrp.model_retrained'],
      subjects: ['sven.chrp.prediction_made', 'sven.chrp.high_risk_detected', 'sven.chrp.intervention_suggested', 'sven.chrp.model_retrained'],
      cases: ['chrp_predict', 'chrp_highrisk', 'chrp_intervene', 'chrp_retrain', 'chrp_report', 'chrp_monitor'],
    },
    {
      name: 'feedback_aggregator', migration: '20260622180000_agent_feedback_aggregator.sql',
      typeFile: 'agent-feedback-aggregator.ts', skillDir: 'feedback-aggregator',
      interfaces: ['FeedbackAggregatorConfig', 'AggregatedFeedback', 'FeedbackTheme'],
      bk: 'feedback_aggregator', eks: ['fbag.feedback_collected', 'fbag.theme_extracted', 'fbag.summary_generated', 'fbag.action_item_created'],
      subjects: ['sven.fbag.feedback_collected', 'sven.fbag.theme_extracted', 'sven.fbag.summary_generated', 'sven.fbag.action_item_created'],
      cases: ['fbag_collect', 'fbag_theme', 'fbag_summary', 'fbag_action', 'fbag_report', 'fbag_monitor'],
    },
    {
      name: 'sentiment_tracker', migration: '20260622190000_agent_sentiment_tracker.sql',
      typeFile: 'agent-sentiment-tracker.ts', skillDir: 'sentiment-tracker',
      interfaces: ['SentimentTrackerConfig', 'SentimentReading', 'SentimentShift'],
      bk: 'sentiment_tracker', eks: ['sntr.reading_recorded', 'sntr.shift_detected', 'sntr.trend_analyzed', 'sntr.alert_raised'],
      subjects: ['sven.sntr.reading_recorded', 'sven.sntr.shift_detected', 'sven.sntr.trend_analyzed', 'sven.sntr.alert_raised'],
      cases: ['sntr_record', 'sntr_shift', 'sntr_analyze', 'sntr_raise', 'sntr_report', 'sntr_monitor'],
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
