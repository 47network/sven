import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 62 — Agent Marketplace Recommendations', () => {

  /* ------------------------------------------------------------------ */
  /*  1. Migration SQL                                                  */
  /* ------------------------------------------------------------------ */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260604120000_agent_marketplace_recommendations.sql'),
      'utf-8',
    );

    it('creates agent_recommendations table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_recommendations');
    });

    it('creates recommendation_models table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS recommendation_models');
    });

    it('creates recommendation_interactions table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS recommendation_interactions');
    });

    it('creates recommendation_campaigns table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS recommendation_campaigns');
    });

    it('creates recommendation_feedback table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS recommendation_feedback');
    });

    it('has at least 19 indexes', () => {
      const indexes = (sql.match(/CREATE INDEX/gi) || []).length;
      expect(indexes).toBeGreaterThanOrEqual(19);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  2. Shared Types                                                   */
  /* ------------------------------------------------------------------ */
  describe('Shared types', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-marketplace-recommendations.ts'),
      'utf-8',
    );

    it('exports RecommendationSourceType with 5 values', () => {
      const m = src.match(/export type RecommendationSourceType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports RecommendationItemType with 5 values', () => {
      const m = src.match(/export type RecommendationItemType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports RecommendationModelType with 5 values', () => {
      const m = src.match(/export type RecommendationModelType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports RecommendationModelStatus with 4 values', () => {
      const m = src.match(/export type RecommendationModelStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(4);
    });

    it('exports AgentmInteractionType with 6 values', () => {
      const m = src.match(/export type AgentmInteractionType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(6);
    });

    it('exports CampaignType with 5 values', () => {
      const m = src.match(/export type CampaignType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports RecommendationAction with 7 values', () => {
      const m = src.match(/export type RecommendationAction\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(7);
    });

    it('exports Recommendation interface', () => {
      expect(src).toContain('export interface Recommendation');
    });

    it('exports RecommendationModel interface', () => {
      expect(src).toContain('export interface RecommendationModel');
    });

    it('exports RecommendationInteraction interface', () => {
      expect(src).toContain('export interface RecommendationInteraction');
    });

    it('exports RecommendationCampaign interface', () => {
      expect(src).toContain('export interface RecommendationCampaign');
    });

    it('exports RecommendationFeedback interface', () => {
      expect(src).toContain('export interface RecommendationFeedback');
    });

    it('exports helper functions', () => {
      expect(src).toContain('export function isRecommendationExpired');
      expect(src).toContain('export function isModelActive');
      expect(src).toContain('export function isHighScoreRecommendation');
      expect(src).toContain('export function calculateConversionRate');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  3. Barrel export                                                  */
  /* ------------------------------------------------------------------ */
  describe('Barrel export (shared/index.ts)', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('re-exports agent-marketplace-recommendations', () => {
      expect(idx).toContain("export * from './agent-marketplace-recommendations.js'");
    });

    it('has at least 87 lines', () => {
      expect(idx.split('\n').length).toBeGreaterThanOrEqual(87);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  4. SKILL.md                                                       */
  /* ------------------------------------------------------------------ */
  describe('SKILL.md', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/agent-marketplace-recommendations/SKILL.md'),
      'utf-8',
    );

    it('has correct skill identifier', () => {
      expect(skill).toMatch(/skill:\s*agent-marketplace-recommendations/);
    });

    it('defines 7 actions', () => {
      const actions = ['recommend_generate', 'model_train', 'interaction_record', 'campaign_create', 'feedback_submit', 'recommend_refresh', 'campaign_manage'];
      for (const a of actions) {
        expect(skill).toContain(a);
      }
    });

    it('is in autonomous economy category', () => {
      expect(skill).toMatch(/category:\s*marketplace/);
    });

    it('is marked autonomous', () => {
      expect(skill).toMatch(/autonomous:\s*true/);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  5. Eidolon Building Kind                                          */
  /* ------------------------------------------------------------------ */
  describe('Eidolon EidolonBuildingKind', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes recommendation_engine building', () => {
      expect(types).toContain("'recommendation_engine'");
    });

    it('has 45 building kinds', () => {
      const m = types.match(/export type EidolonBuildingKind\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const pipes = (m![0].match(/\|/g) || []).length;
      expect(pipes).toBe(45);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  6. Eidolon Event Kinds                                            */
  /* ------------------------------------------------------------------ */
  describe('Eidolon EidolonEventKind', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    const events = [
      'recommend.generated',
      'recommend.model_trained',
      'recommend.interaction_recorded',
      'recommend.campaign_launched',
    ];

    for (const ev of events) {
      it(`includes ${ev}`, () => {
        expect(types).toContain(`'${ev}'`);
      });
    }

    it('has 196 event kind pipe values', () => {
      const m = types.match(/export type EidolonEventKind\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const pipes = (m![0].match(/\|/g) || []).length;
      expect(pipes).toBe(196);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  7. districtFor                                                    */
  /* ------------------------------------------------------------------ */
  describe('districtFor', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('maps recommendation_engine to a district', () => {
      expect(types).toContain("case 'recommendation_engine':");
    });

    it('has 45 districtFor cases', () => {
      const fn = types.match(/export function districtFor[\s\S]*?^}/m);
      expect(fn).toBeTruthy();
      const cases = (fn![0].match(/case '/g) || []).length;
      expect(cases).toBe(45);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  8. SUBJECT_MAP                                                    */
  /* ------------------------------------------------------------------ */
  describe('SUBJECT_MAP (event-bus.ts)', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    const subjects = [
      'sven.recommend.generated',
      'sven.recommend.model_trained',
      'sven.recommend.interaction_recorded',
      'sven.recommend.campaign_launched',
    ];

    for (const s of subjects) {
      it(`includes ${s}`, () => {
        expect(bus).toContain(`'${s}'`);
      });
    }

    it('has 195 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      const entries = (m![1].match(/^\s+'/gm) || []).length;
      expect(entries).toBe(195);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  9. Task executor switch cases                                     */
  /* ------------------------------------------------------------------ */
  describe('Task executor switch cases', () => {
    const exec = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    const cases = [
      'recommendation_generate',
      'model_train',
      'interaction_record',
      'campaign_create',
      'feedback_submit_recommend',
      'recommend_refresh',
      'campaign_manage',
    ];

    for (const c of cases) {
      it(`routes ${c}`, () => {
        expect(exec).toContain(`case '${c}'`);
      });
    }

    it('has 215 total switch cases', () => {
      const count = (exec.match(/case '/g) || []).length;
      expect(count).toBe(215);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  10. Task executor handler methods                                 */
  /* ------------------------------------------------------------------ */
  describe('Task executor handler methods', () => {
    const exec = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    const handlers = [
      'handleRecommendationGenerate',
      'handleModelTrain',
      'handleInteractionRecord',
      'handleCampaignCreate',
      'handleFeedbackSubmitRecommend',
      'handleRecommendRefresh',
      'handleCampaignManage',
    ];

    for (const h of handlers) {
      it(`has ${h} method`, () => {
        expect(exec).toContain(h);
      });
    }

    it('has 211 total handler methods', () => {
      const count = (exec.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(count).toBe(211);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  11. .gitattributes                                                */
  /* ------------------------------------------------------------------ */
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

    it('covers migration SQL', () => {
      expect(ga).toContain('20260604120000_agent_marketplace_recommendations.sql');
    });

    it('covers shared types', () => {
      expect(ga).toContain('agent-marketplace-recommendations.ts');
    });

    it('covers SKILL.md', () => {
      expect(ga).toContain('agent-marketplace-recommendations/**');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  12. CHANGELOG                                                     */
  /* ------------------------------------------------------------------ */
  describe('CHANGELOG.md', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');

    it('mentions Batch 62', () => {
      expect(cl).toContain('Batch 62');
    });

    it('mentions Agent Marketplace Recommendations', () => {
      expect(cl).toContain('Agent Marketplace Recommendations');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  13. Migration file count                                          */
  /* ------------------------------------------------------------------ */
  describe('Overall migration count', () => {
    it('has 48 migration files', () => {
      const dir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));
      expect(files.length).toBe(48);
    });
  });
});
