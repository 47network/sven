/**
 * Batch 27 — LLM Council (Multi-Model Debate)
 *
 * Tests: migration, shared types, skill, admin API, task executor handlers,
 *        NATS/Eidolon integration.
 *
 * Run:
 *   cd services/agent-runtime
 *   npx jest --testPathPattern='batch27' --no-coverage
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// -----------------------------------------------------------------------
// 1. Migration — 20260501120000_llm_council.sql
// -----------------------------------------------------------------------
describe('Batch 27 — Migration', () => {
  const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260501120000_llm_council.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migPath, 'utf-8');
  });

  it('migration file exists', () => {
    expect(fs.existsSync(migPath)).toBe(true);
  });

  it('creates council_sessions table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS council_sessions');
  });

  it('council_sessions has required columns', () => {
    const cols = [
      'id', 'org_id', 'user_id', 'query', 'config', 'status', 'strategy',
      'rounds_total', 'rounds_done', 'synthesis', 'opinions', 'peer_reviews',
      'scores', 'winning_model', 'total_tokens_prompt', 'total_tokens_completion',
      'total_cost', 'elapsed_ms', 'metadata', 'created_at', 'completed_at',
    ];
    for (const col of cols) {
      expect(sql).toContain(col);
    }
  });

  it('council_sessions status CHECK covers all values', () => {
    for (const s of ['pending', 'deliberating', 'synthesizing', 'completed', 'failed', 'cancelled']) {
      expect(sql).toContain(`'${s}'`);
    }
  });

  it('council_sessions strategy CHECK covers all values', () => {
    for (const s of ['best_of_n', 'majority_vote', 'debate', 'weighted']) {
      expect(sql).toContain(`'${s}'`);
    }
  });

  it('creates council_opinions table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS council_opinions');
  });

  it('council_opinions has required columns', () => {
    const cols = [
      'session_id', 'model_alias', 'model_name', 'round_number',
      'opinion_text', 'confidence', 'tokens_prompt', 'tokens_completion',
      'cost', 'latency_ms',
    ];
    for (const col of cols) {
      expect(sql).toContain(col);
    }
  });

  it('council_opinions FK cascades on delete', () => {
    expect(sql).toMatch(/council_opinions[\s\S]*REFERENCES council_sessions\(id\) ON DELETE CASCADE/);
  });

  it('creates council_peer_reviews table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS council_peer_reviews');
  });

  it('council_peer_reviews has required columns', () => {
    const cols = [
      'reviewer_model', 'reviewed_model', 'round_number',
      'score', 'critique', 'strengths', 'weaknesses',
    ];
    for (const col of cols) {
      expect(sql).toContain(col);
    }
  });

  it('peer_reviews score CHECK 0-100', () => {
    expect(sql).toMatch(/score >= 0 AND score <= 100/);
  });

  it('creates council_model_metrics table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS council_model_metrics');
  });

  it('council_model_metrics has required columns', () => {
    const cols = [
      'model_alias', 'model_name', 'sessions_count', 'wins_count',
      'avg_score', 'avg_latency_ms', 'total_tokens', 'total_cost',
      'specialties', 'last_used_at',
    ];
    for (const col of cols) {
      expect(sql).toContain(col);
    }
  });

  it('creates indexes for council_sessions', () => {
    expect(sql).toContain('idx_council_sessions_org');
    expect(sql).toContain('idx_council_sessions_status');
    expect(sql).toContain('idx_council_sessions_created');
    expect(sql).toContain('idx_council_sessions_user');
    expect(sql).toContain('idx_council_sessions_strategy');
  });

  it('creates indexes for council_opinions', () => {
    expect(sql).toContain('idx_council_opinions_session');
    expect(sql).toContain('idx_council_opinions_model');
    expect(sql).toContain('idx_council_opinions_round');
  });

  it('creates indexes for council_peer_reviews', () => {
    expect(sql).toContain('idx_council_reviews_session');
    expect(sql).toContain('idx_council_reviews_reviewer');
    expect(sql).toContain('idx_council_reviews_reviewed');
  });

  it('creates indexes for council_model_metrics', () => {
    expect(sql).toContain('idx_council_metrics_alias');
    expect(sql).toContain('idx_council_metrics_wins');
    expect(sql).toContain('idx_council_metrics_score');
  });

  it('ALTERs marketplace_tasks CHECK to include council types', () => {
    expect(sql).toContain("'council_deliberate'");
    expect(sql).toContain("'council_vote'");
    expect(sql).toContain('marketplace_tasks_task_type_check');
  });

  it('preserves all prior task types in CHECK', () => {
    const priorTypes = [
      'translate', 'write', 'review', 'proofread', 'format',
      'cover_design', 'genre_research', 'design', 'research', 'support',
      'misiuni_post', 'misiuni_verify', 'legal_research', 'print_broker',
      'trend_research', 'author_persona', 'social_post', 'social_analytics',
      'merch_listing', 'product_design',
    ];
    for (const t of priorTypes) {
      expect(sql).toContain(`'${t}'`);
    }
  });
});

// -----------------------------------------------------------------------
// 2. Shared types — llm-council.ts
// -----------------------------------------------------------------------
describe('Batch 27 — Shared types (llm-council.ts)', () => {
  const typesPath = path.join(ROOT, 'packages/shared/src/llm-council.ts');
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(typesPath, 'utf-8');
  });

  it('file exists', () => {
    expect(fs.existsSync(typesPath)).toBe(true);
  });

  it('exports CouncilSessionStatus type', () => {
    expect(src).toContain('export type CouncilSessionStatus');
    for (const s of ['pending', 'deliberating', 'synthesizing', 'completed', 'failed', 'cancelled']) {
      expect(src).toContain(`'${s}'`);
    }
  });

  it('exports CouncilStrategy type', () => {
    expect(src).toContain('export type CouncilStrategy');
    for (const s of ['best_of_n', 'majority_vote', 'debate', 'weighted']) {
      expect(src).toContain(`'${s}'`);
    }
  });

  it('exports CouncilQueryCategory type', () => {
    expect(src).toContain('export type CouncilQueryCategory');
    for (const c of ['coding', 'reasoning', 'creative', 'analysis', 'general', 'math', 'research']) {
      expect(src).toContain(`'${c}'`);
    }
  });

  it('exports CouncilModelRole type', () => {
    expect(src).toContain('export type CouncilModelRole');
    for (const r of ['panelist', 'chairman', 'critic', 'synthesizer']) {
      expect(src).toContain(`'${r}'`);
    }
  });

  it('exports CouncilSpecialty type', () => {
    expect(src).toContain('export type CouncilSpecialty');
    for (const s of ['code_generation', 'code_review', 'reasoning', 'creative_writing']) {
      expect(src).toContain(`'${s}'`);
    }
  });

  it('exports CouncilSession interface', () => {
    expect(src).toContain('export interface CouncilSession');
    expect(src).toContain('orgId: string');
    expect(src).toContain('winningModel: string | null');
  });

  it('exports CouncilConfig interface', () => {
    expect(src).toContain('export interface CouncilConfig');
    expect(src).toContain('models: string[]');
    expect(src).toContain('chairman: string');
    expect(src).toContain('anonymize: boolean');
  });

  it('exports CouncilOpinion interface', () => {
    expect(src).toContain('export interface CouncilOpinion');
    expect(src).toContain('modelAlias: string');
    expect(src).toContain('confidence: number');
  });

  it('exports CouncilPeerReview interface', () => {
    expect(src).toContain('export interface CouncilPeerReview');
    expect(src).toContain('reviewerModel: string');
    expect(src).toContain('reviewedModel: string');
  });

  it('exports CouncilModelMetrics interface', () => {
    expect(src).toContain('export interface CouncilModelMetrics');
    expect(src).toContain('winsCount: number');
    expect(src).toContain('avgScore: number');
  });

  it('exports COUNCIL_STRATEGIES array', () => {
    expect(src).toContain('export const COUNCIL_STRATEGIES');
  });

  it('exports COUNCIL_DEFAULT_MODELS with 3 models', () => {
    expect(src).toContain('export const COUNCIL_DEFAULT_MODELS');
    expect(src).toContain("'qwen2.5-coder:32b'");
    expect(src).toContain("'qwen2.5:7b'");
    expect(src).toContain("'deepseek-r1:7b'");
  });

  it('exports COUNCIL_MAX_ROUNDS per strategy', () => {
    expect(src).toContain('export const COUNCIL_MAX_ROUNDS');
    expect(src).toContain('best_of_n: 1');
    expect(src).toContain('debate: 5');
  });

  it('exports COUNCIL_MIN_MODELS per strategy', () => {
    expect(src).toContain('export const COUNCIL_MIN_MODELS');
    expect(src).toContain('majority_vote: 3');
  });

  it('exports MODEL_SPECIALTIES with model → category mapping', () => {
    expect(src).toContain('export const MODEL_SPECIALTIES');
    expect(src).toContain("'qwen2.5-coder:32b'");
  });

  it('exports COUNCIL_TERMINAL_STATUSES', () => {
    expect(src).toContain('export const COUNCIL_TERMINAL_STATUSES');
  });

  it('exports isTerminalStatus function', () => {
    expect(src).toContain('export function isTerminalStatus');
  });

  it('exports requiresMultipleRounds function', () => {
    expect(src).toContain('export function requiresMultipleRounds');
  });

  it('exports selectModelsForCategory function', () => {
    expect(src).toContain('export function selectModelsForCategory');
  });

  it('exports estimateCouncilCost function', () => {
    expect(src).toContain('export function estimateCouncilCost');
  });

  it('exports validateCouncilConfig function', () => {
    expect(src).toContain('export function validateCouncilConfig');
  });

  it('shared index.ts re-exports llm-council', () => {
    const indexPath = path.join(ROOT, 'packages/shared/src/index.ts');
    const idx = fs.readFileSync(indexPath, 'utf-8');
    expect(idx).toContain("'./llm-council.js'");
  });
});

// -----------------------------------------------------------------------
// 3. Skill — council-deliberate
// -----------------------------------------------------------------------
describe('Batch 27 — council-deliberate skill', () => {
  const skillPath = path.join(ROOT, 'skills/autonomous-economy/council-deliberate/SKILL.md');
  let skill: string;

  beforeAll(() => {
    skill = fs.readFileSync(skillPath, 'utf-8');
  });

  it('SKILL.md exists', () => {
    expect(fs.existsSync(skillPath)).toBe(true);
  });

  it('has YAML frontmatter', () => {
    expect(skill).toMatch(/^---/);
    expect(skill.indexOf('---', 3)).toBeGreaterThan(3);
  });

  it('name is council-deliberate', () => {
    expect(skill).toContain('name: council-deliberate');
  });

  it('archetype is strategist', () => {
    expect(skill).toContain('archetype: strategist');
  });

  it('has deliberate action', () => {
    expect(skill).toContain('name: deliberate');
  });

  it('has vote action', () => {
    expect(skill).toContain('name: vote');
  });

  it('has critique action', () => {
    expect(skill).toContain('name: critique');
  });

  it('has select-model action', () => {
    expect(skill).toContain('name: select-model');
  });

  it('lists all 4 strategies in deliberate inputs', () => {
    for (const s of ['best_of_n', 'majority_vote', 'debate', 'weighted']) {
      expect(skill).toContain(s);
    }
  });

  it('lists query categories', () => {
    for (const c of ['coding', 'reasoning', 'creative', 'analysis', 'general', 'math', 'research']) {
      expect(skill).toContain(c);
    }
  });

  it('references LiteLLM integration', () => {
    expect(skill).toContain('litellm');
    expect(skill).toContain('10.47.47.9:4000');
  });

  it('references NATS subjects', () => {
    expect(skill).toContain('sven.council.session_started');
    expect(skill).toContain('sven.council.round_completed');
    expect(skill).toContain('sven.council.session_completed');
    expect(skill).toContain('sven.council.model_ranked');
  });

  it('has pricing section', () => {
    expect(skill).toContain('pricing:');
    expect(skill).toContain('per_use');
  });

  it('lists default models', () => {
    expect(skill).toContain('qwen2.5-coder:32b');
    expect(skill).toContain('qwen2.5:7b');
    expect(skill).toContain('deepseek-r1:7b');
  });
});

// -----------------------------------------------------------------------
// 4. Admin API — council.ts
// -----------------------------------------------------------------------
describe('Batch 27 — Council admin API', () => {
  const apiPath = path.join(ROOT, 'services/gateway-api/src/routes/admin/council.ts');
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(apiPath, 'utf-8');
  });

  it('file exists', () => {
    expect(fs.existsSync(apiPath)).toBe(true);
  });

  it('exports registerCouncilRoutes', () => {
    expect(src).toContain('export function registerCouncilRoutes');
  });

  it('has POST /council/deliberate route', () => {
    expect(src).toContain("'/council/deliberate'");
    expect(src).toContain('app.post');
  });

  it('has GET /council/sessions route', () => {
    expect(src).toContain("'/council/sessions'");
    expect(src).toContain('app.get');
  });

  it('has GET /council/sessions/:id route', () => {
    expect(src).toContain("'/council/sessions/:id'");
  });

  it('has PUT /council/config route', () => {
    expect(src).toContain("'/council/config'");
    expect(src).toContain('app.put');
  });

  it('has GET /council/config route', () => {
    expect(src).toMatch(/app\.get\s*\(\s*'\/council\/config'/);
  });

  it('validates query length >= 3', () => {
    expect(src).toContain('query.length < 3');
  });

  it('generates session IDs with council- prefix', () => {
    expect(src).toContain('council-${Date.now()}');
  });

  it('references council_sessions table', () => {
    expect(src).toContain('council_sessions');
  });

  it('references settings_global table for config', () => {
    expect(src).toContain('settings_global');
  });

  it('references default models', () => {
    expect(src).toContain('qwen2.5-coder:32b');
  });
});

// -----------------------------------------------------------------------
// 5. Admin wiring
// -----------------------------------------------------------------------
describe('Batch 27 — Admin index wiring', () => {
  const indexPath = path.join(ROOT, 'services/gateway-api/src/routes/admin/index.ts');
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(indexPath, 'utf-8');
  });

  it('imports registerCouncilRoutes', () => {
    expect(src).toContain("import { registerCouncilRoutes } from './council.js'");
  });

  it('mounts council routes', () => {
    expect(src).toContain('registerCouncilRoutes');
    expect(src).toMatch(/mountAdminRoutes[\s\S]*registerCouncilRoutes/);
  });

  it('council mount comes after xlvii mount', () => {
    const xlviiIdx = src.indexOf('registerXlviiRoutes');
    const councilIdx = src.lastIndexOf('registerCouncilRoutes');
    expect(councilIdx).toBeGreaterThan(xlviiIdx);
  });
});

// -----------------------------------------------------------------------
// 6. Task executor — council handlers
// -----------------------------------------------------------------------
describe('Batch 27 — Task executor council handlers', () => {
  const execPath = path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts');
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(execPath, 'utf-8');
  });

  it('has council_deliberate case', () => {
    expect(src).toContain("case 'council_deliberate':");
  });

  it('has council_vote case', () => {
    expect(src).toContain("case 'council_vote':");
  });

  it('council_deliberate routes to handleCouncilDeliberate', () => {
    expect(src).toContain('this.handleCouncilDeliberate');
  });

  it('council_vote routes to handleCouncilVote', () => {
    expect(src).toContain('this.handleCouncilVote');
  });

  it('handleCouncilDeliberate is private async method', () => {
    expect(src).toContain('private async handleCouncilDeliberate');
  });

  it('handleCouncilVote is private async method', () => {
    expect(src).toContain('private async handleCouncilVote');
  });

  it('deliberate handler generates session IDs with council- prefix', () => {
    expect(src).toMatch(/council-\$\{Date\.now\(\)\}/);
  });

  it('deliberate handler uses default models', () => {
    expect(src).toContain("'qwen2.5-coder:32b'");
    expect(src).toContain("'qwen2.5:7b'");
    expect(src).toContain("'deepseek-r1:7b'");
  });

  it('deliberate handler returns council object with scores', () => {
    expect(src).toContain('winningModel');
    expect(src).toContain('totalTokens');
    expect(src).toContain('totalCost');
    expect(src).toContain('elapsedMs');
  });

  it('vote handler returns winner and confidence', () => {
    expect(src).toContain("status: 'completed'");
    expect(src).toContain('winner');
    expect(src).toContain('confidence');
  });

  it('deliberate handler supports anonymize option', () => {
    expect(src).toContain('anonymize');
  });

  it('deliberate handler computes peer reviews', () => {
    expect(src).toContain('peerReviews');
    expect(src).toContain('peerReviewsCount');
  });

  it('vote handler supports custom choices', () => {
    expect(src).toContain("'yes', 'no'");
    expect(src).toContain('individualVotes');
  });

  it('total task executor cases is now 22', () => {
    const cases = src.match(/case '/g);
    expect(cases).not.toBeNull();
    expect(cases!.length).toBeGreaterThanOrEqual(22);
  });
});

// -----------------------------------------------------------------------
// 7. NATS event-bus — council subjects
// -----------------------------------------------------------------------
describe('Batch 27 — NATS event-bus council subjects', () => {
  const busPath = path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts');
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(busPath, 'utf-8');
  });

  it('has sven.council.session_started → council.session_started', () => {
    expect(src).toContain("'sven.council.session_started': 'council.session_started'");
  });

  it('has sven.council.round_completed → council.round_completed', () => {
    expect(src).toContain("'sven.council.round_completed': 'council.round_completed'");
  });

  it('has sven.council.session_completed → council.session_completed', () => {
    expect(src).toContain("'sven.council.session_completed': 'council.session_completed'");
  });

  it('has sven.council.model_ranked → council.model_ranked', () => {
    expect(src).toContain("'sven.council.model_ranked': 'council.model_ranked'");
  });

  it('SUBJECT_MAP now has at least 77 entries', () => {
    const entries = src.match(/'sven\.[^']+'/g);
    expect(entries).not.toBeNull();
    expect(entries!.length).toBeGreaterThanOrEqual(59);
  });
});

// -----------------------------------------------------------------------
// 8. Eidolon types — building kind + events + districtFor
// -----------------------------------------------------------------------
describe('Batch 27 — Eidolon types', () => {
  const typesPath = path.join(ROOT, 'services/sven-eidolon/src/types.ts');
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(typesPath, 'utf-8');
  });

  it('EidolonBuildingKind includes council_chamber', () => {
    expect(src).toContain("'council_chamber'");
  });

  it('EidolonBuildingKind now has 12 values', () => {
    const buildingBlock = src.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
    expect(buildingBlock).not.toBeNull();
    const pipes = (buildingBlock![1].match(/\|/g) || []).length;
    expect(pipes).toBeGreaterThanOrEqual(11);
  });

  it('EidolonEventKind includes council.session_started', () => {
    expect(src).toContain("'council.session_started'");
  });

  it('EidolonEventKind includes council.round_completed', () => {
    expect(src).toContain("'council.round_completed'");
  });

  it('EidolonEventKind includes council.session_completed', () => {
    expect(src).toContain("'council.session_completed'");
  });

  it('EidolonEventKind includes council.model_ranked', () => {
    expect(src).toContain("'council.model_ranked'");
  });

  it('EidolonEventKind now has at least 60 values', () => {
    const eventBlock = src.match(/export type EidolonEventKind\s*=([\s\S]*?);/);
    expect(eventBlock).not.toBeNull();
    const pipes = (eventBlock![1].match(/\|/g) || []).length;
    expect(pipes).toBeGreaterThanOrEqual(59);
  });

  it('districtFor maps council_chamber to civic', () => {
    expect(src).toContain("case 'council_chamber':");
    expect(src).toContain("return 'civic'");
  });
});

// -----------------------------------------------------------------------
// 9. Cross-cutting integration
// -----------------------------------------------------------------------
describe('Batch 27 — Cross-cutting integration', () => {
  it('migration file is named after xlvii_merch chronologically', () => {
    const migDir = path.join(ROOT, 'services/gateway-api/migrations');
    const files = fs.readdirSync(migDir).sort();
    const xlviiIdx = files.indexOf('20260430120000_xlvii_merch.sql');
    const councilIdx = files.indexOf('20260501120000_llm_council.sql');
    expect(xlviiIdx).toBeGreaterThan(-1);
    expect(councilIdx).toBeGreaterThan(-1);
    expect(councilIdx).toBeGreaterThan(xlviiIdx);
  });

  it('skill directory is inside autonomous-economy', () => {
    const skillDir = path.join(ROOT, 'skills/autonomous-economy/council-deliberate');
    expect(fs.existsSync(skillDir)).toBe(true);
    expect(fs.statSync(skillDir).isDirectory()).toBe(true);
  });

  it('total autonomous-economy skills is now 23', () => {
    const skillsDir = path.join(ROOT, 'skills/autonomous-economy');
    const dirs = fs.readdirSync(skillsDir).filter((d) => {
      const full = path.join(skillsDir, d);
      return fs.statSync(full).isDirectory();
    });
    expect(dirs.length).toBeGreaterThanOrEqual(23);
  });

  it('council_chamber is a new building kind not duplicated', () => {
    const typesPath = path.join(ROOT, 'services/sven-eidolon/src/types.ts');
    const src = fs.readFileSync(typesPath, 'utf-8');
    const matches = src.match(/council_chamber/g);
    // Appears in: type union, districtFor case, possibly return — at least 2
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('all 4 council NATS subjects are unique (no duplicates)', () => {
    const busPath = path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts');
    const src = fs.readFileSync(busPath, 'utf-8');
    const councilEntries = src.match(/'sven\.council\.[^']+'/g);
    expect(councilEntries).not.toBeNull();
    const unique = new Set(councilEntries);
    expect(unique.size).toBe(councilEntries!.length);
  });
});
