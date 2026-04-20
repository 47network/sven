import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 61 — Agent Feedback & Surveys', () => {

  /* ───── 1. Migration SQL ───── */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260603120000_agent_feedback_surveys.sql'),
      'utf-8',
    );

    it('creates agent_feedback table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_feedback');
    });
    it('creates agent_surveys table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_surveys');
    });
    it('creates agent_survey_responses table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_survey_responses');
    });
    it('creates agent_feedback_analytics table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_feedback_analytics');
    });
    it('creates agent_improvement_actions table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_improvement_actions');
    });
    it('has at least 17 indexes', () => {
      const idxCount = (sql.match(/CREATE INDEX/gi) || []).length;
      expect(idxCount).toBeGreaterThanOrEqual(17);
    });
  });

  /* ───── 2. Shared Types ───── */
  describe('Shared Types', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-feedback-surveys.ts'),
      'utf-8',
    );

    it('exports FeedbackType with 5 values', () => {
      const m = src.match(/export type FeedbackType\s*=[^;]+;/);
      expect(m).toBeTruthy();
      const count = (m![0].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
    it('exports FeedbackCategory with 5 values', () => {
      const m = src.match(/export type FeedbackCategory\s*=[^;]+;/);
      expect(m).toBeTruthy();
      const count = (m![0].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
    it('exports FeedbackSentiment with 5 values', () => {
      const m = src.match(/export type FeedbackSentiment\s*=[^;]+;/);
      expect(m).toBeTruthy();
      const count = (m![0].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
    it('exports SurveyType with 5 values', () => {
      const m = src.match(/export type SurveyType\s*=[^;]+;/);
      expect(m).toBeTruthy();
      const count = (m![0].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
    it('exports SurveyStatus with 5 values', () => {
      const m = src.match(/export type SurveyStatus\s*=[^;]+;/);
      expect(m).toBeTruthy();
      const count = (m![0].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
    it('exports ImprovementActionType with 5 values', () => {
      const m = src.match(/export type ImprovementActionType\s*=[^;]+;/);
      expect(m).toBeTruthy();
      const count = (m![0].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
    it('exports FeedbackSurveyAction with 7 values', () => {
      const m = src.match(/export type FeedbackSurveyAction\s*=[^;]+;/);
      expect(m).toBeTruthy();
      const count = (m![0].match(/'/g) || []).length / 2;
      expect(count).toBe(7);
    });
    it('exports FeedbackEntry interface', () => {
      expect(src).toContain('export interface FeedbackEntry');
    });
    it('exports SurveyDefinition interface', () => {
      expect(src).toContain('export interface SurveyDefinition');
    });
    it('exports SurveyResponse interface', () => {
      expect(src).toContain('export interface SurveyResponse');
    });
    it('exports FeedbackAnalytics interface', () => {
      expect(src).toContain('export interface FeedbackAnalytics');
    });
    it('exports ImprovementAction interface', () => {
      expect(src).toContain('export interface ImprovementAction');
    });
    it('exports isFeedbackPositive helper', () => {
      expect(src).toContain('export function isFeedbackPositive');
    });
    it('exports isSurveyActive helper', () => {
      expect(src).toContain('export function isSurveyActive');
    });
    it('exports isImprovementCompleted helper', () => {
      expect(src).toContain('export function isImprovementCompleted');
    });
    it('exports calculateNps helper', () => {
      expect(src).toContain('export function calculateNps');
    });
  });

  /* ───── 3. Barrel Export ───── */
  describe('Barrel Export', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('re-exports agent-feedback-surveys', () => {
      expect(idx).toContain("export * from './agent-feedback-surveys.js'");
    });
    it('has at least 86 lines', () => {
      expect(idx.split('\n').length).toBeGreaterThanOrEqual(86);
    });
  });

  /* ───── 4. SKILL.md ───── */
  describe('SKILL.md', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/agent-feedback-surveys/SKILL.md'),
      'utf-8',
    );

    it('has correct skill identifier', () => {
      expect(skill).toMatch(/skill:\s*agent-feedback-surveys/);
    });
    it('defines feedback_submit action', () => {
      expect(skill).toContain('feedback_submit');
    });
    it('defines survey_create action', () => {
      expect(skill).toContain('survey_create');
    });
    it('defines survey_respond action', () => {
      expect(skill).toContain('survey_respond');
    });
    it('defines analytics_generate action', () => {
      expect(skill).toContain('analytics_generate');
    });
    it('defines improvement_propose action', () => {
      expect(skill).toContain('improvement_propose');
    });
    it('defines feedback_acknowledge action', () => {
      expect(skill).toContain('feedback_acknowledge');
    });
    it('defines survey_close action', () => {
      expect(skill).toContain('survey_close');
    });
  });

  /* ───── 5. Eidolon Building Kind ───── */
  describe('Eidolon Building Kind', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes feedback_plaza building kind', () => {
      expect(types).toContain("'feedback_plaza'");
    });
    it('has 44 building kind values', () => {
      const block = types.match(/EidolonBuildingKind\s*=\s*([\s\S]*?);/);
      expect(block).toBeTruthy();
      const pipeCount = (block![1].match(/\|/g) || []).length;
      expect(pipeCount).toBe(44);
    });
  });

  /* ───── 6. Eidolon Event Kinds ───── */
  describe('Eidolon Event Kinds', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes feedback.submitted', () => {
      expect(types).toContain("'feedback.submitted'");
    });
    it('includes feedback.survey_created', () => {
      expect(types).toContain("'feedback.survey_created'");
    });
    it('includes feedback.response_received', () => {
      expect(types).toContain("'feedback.response_received'");
    });
    it('includes feedback.improvement_proposed', () => {
      expect(types).toContain("'feedback.improvement_proposed'");
    });
    it('has 192 event kind pipe values', () => {
      const block = types.match(/EidolonEventKind\s*=\s*([\s\S]*?);/);
      expect(block).toBeTruthy();
      const pipeCount = (block![1].match(/\|/g) || []).length;
      expect(pipeCount).toBe(192);
    });
  });

  /* ───── 7. districtFor ───── */
  describe('districtFor', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('maps feedback_plaza to civic', () => {
      expect(types).toContain("case 'feedback_plaza':");
      const districtSection = types.slice(types.indexOf('districtFor'));
      const fbIdx = districtSection.indexOf("case 'feedback_plaza':");
      const returnAfter = districtSection.indexOf("return 'civic'", fbIdx);
      expect(returnAfter).toBeGreaterThan(fbIdx);
    });
    it('has 44 districtFor cases', () => {
      const districtSection = types.slice(types.indexOf('districtFor'));
      const caseCount = (districtSection.match(/case '/g) || []).length;
      expect(caseCount).toBe(44);
    });
  });

  /* ───── 8. SUBJECT_MAP ───── */
  describe('SUBJECT_MAP (event-bus)', () => {
    const eb = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('maps sven.feedback.submitted', () => {
      expect(eb).toContain("'sven.feedback.submitted': 'feedback.submitted'");
    });
    it('maps sven.feedback.survey_created', () => {
      expect(eb).toContain("'sven.feedback.survey_created': 'feedback.survey_created'");
    });
    it('maps sven.feedback.response_received', () => {
      expect(eb).toContain("'sven.feedback.response_received': 'feedback.response_received'");
    });
    it('maps sven.feedback.improvement_proposed', () => {
      expect(eb).toContain("'sven.feedback.improvement_proposed': 'feedback.improvement_proposed'");
    });
    it('has 191 SUBJECT_MAP entries', () => {
      const m = eb.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      const entryCount = (m![1].match(/^\s+'/gm) || []).length;
      expect(entryCount).toBe(191);
    });
  });

  /* ───── 9. Task Executor — Switch Cases ───── */
  describe('Task Executor — Switch Cases', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has case for feedback_submit', () => {
      expect(te).toContain("case 'feedback_submit':");
    });
    it('has case for survey_create', () => {
      expect(te).toContain("case 'survey_create':");
    });
    it('has case for survey_respond', () => {
      expect(te).toContain("case 'survey_respond':");
    });
    it('has case for analytics_generate', () => {
      expect(te).toContain("case 'analytics_generate':");
    });
    it('has case for improvement_propose', () => {
      expect(te).toContain("case 'improvement_propose':");
    });
    it('has case for feedback_acknowledge', () => {
      expect(te).toContain("case 'feedback_acknowledge':");
    });
    it('has case for survey_close', () => {
      expect(te).toContain("case 'survey_close':");
    });
    it('has 208 total switch cases', () => {
      const caseCount = (te.match(/case '/g) || []).length;
      expect(caseCount).toBe(208);
    });
  });

  /* ───── 10. Task Executor — Handler Methods ───── */
  describe('Task Executor — Handler Methods', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has handleFeedbackSubmit', () => {
      expect(te).toMatch(/private (?:async )?handleFeedbackSubmit/);
    });
    it('has handleSurveyCreate', () => {
      expect(te).toMatch(/private (?:async )?handleSurveyCreate/);
    });
    it('has handleSurveyRespond', () => {
      expect(te).toMatch(/private (?:async )?handleSurveyRespond/);
    });
    it('has handleFeedbackAnalyticsGenerate', () => {
      expect(te).toMatch(/private (?:async )?handleFeedbackAnalyticsGenerate/);
    });
    it('has handleImprovementPropose', () => {
      expect(te).toMatch(/private (?:async )?handleImprovementPropose/);
    });
    it('has handleFeedbackAcknowledge', () => {
      expect(te).toMatch(/private (?:async )?handleFeedbackAcknowledge/);
    });
    it('has handleSurveyClose', () => {
      expect(te).toMatch(/private (?:async )?handleSurveyClose/);
    });
    it('has 204 total handler methods', () => {
      const handlerCount = (te.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(handlerCount).toBe(204);
    });
  });

  /* ───── 11. .gitattributes ───── */
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

    it('marks migration export-ignore', () => {
      expect(ga).toContain('20260603120000_agent_feedback_surveys.sql export-ignore');
    });
    it('marks shared types export-ignore', () => {
      expect(ga).toContain('agent-feedback-surveys.ts export-ignore');
    });
    it('marks skill export-ignore', () => {
      expect(ga).toContain('agent-feedback-surveys/** export-ignore');
    });
  });

  /* ───── 12. CHANGELOG ───── */
  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');

    it('mentions Batch 61', () => {
      expect(cl).toContain('Batch 61');
    });
    it('mentions Agent Feedback & Surveys', () => {
      expect(cl).toContain('Agent Feedback');
    });
  });

  /* ───── 13. Migration count ───── */
  describe('Migration count', () => {
    it('has 47 migration files', () => {
      const migrationsDir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
      expect(files.length).toBe(47);
    });
  });
});
