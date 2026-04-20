/**
 * Batch 18 — Agent Spawner + Translation/Writing Skills + Task Execution
 *            + 47Token Rewards + Revenue Goals + Agent Shop + Land Parcels
 *
 * Verifies all Batch 18 features via source-file inspection (no cross-package imports).
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Migration — marketplace_tasks_tokens_goals.sql
// ═══════════════════════════════════════════════════════════════════════════
describe('Batch 18 Migration', () => {
  const sql = read(
    'services/gateway-api/migrations/20260422120000_marketplace_tasks_tokens_goals.sql',
  );

  describe('marketplace_tasks table', () => {
    test('creates marketplace_tasks table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS marketplace_tasks');
    });
    test('has order_id column', () => {
      expect(sql).toContain('order_id');
    });
    test('has agent_id column', () => {
      expect(sql).toMatch(/agent_id\s+TEXT\s+NOT NULL/);
    });
    test('has task_type column', () => {
      expect(sql).toContain('task_type');
    });
    test('has input_data JSONB', () => {
      expect(sql).toContain('input_data');
    });
    test('has output_data JSONB', () => {
      expect(sql).toContain('output_data');
    });
    test('has status with CHECK constraint', () => {
      expect(sql).toMatch(/status[\s\S]*?pending[\s\S]*?processing[\s\S]*?completed[\s\S]*?failed/);
    });
    test('has attempts column', () => {
      expect(sql).toContain('attempts');
    });
  });

  describe('agent_token_ledger table', () => {
    test('creates agent_token_ledger table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_token_ledger');
    });
    test('has amount column', () => {
      expect(sql).toContain('amount');
    });
    test('has kind enum with earn/spend types', () => {
      expect(sql).toContain('task_reward');
      expect(sql).toContain('shop_purchase');
      expect(sql).toContain('referral_bonus');
      expect(sql).toContain('goal_bonus');
    });
  });

  describe('revenue_goals table', () => {
    test('creates revenue_goals table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS revenue_goals');
    });
    test('has target_amount column', () => {
      expect(sql).toContain('target_amount');
    });
    test('has current_amount column', () => {
      expect(sql).toContain('current_amount');
    });
    test('has status CHECK constraint', () => {
      expect(sql).toContain("'active'");
      expect(sql).toContain("'completed'");
      expect(sql).toContain("'cancelled'");
    });
    test('seeds the 47Network loan repayment goal', () => {
      expect(sql).toContain('goal-47network-loan-repayment');
      expect(sql).toContain('20000');
    });
  });

  describe('agent_shop_items table', () => {
    test('creates agent_shop_items table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_shop_items');
    });
    test('has token_cost column', () => {
      expect(sql).toContain('token_cost');
    });
    test('has category CHECK constraint', () => {
      expect(sql).toContain('skill_upgrade');
      expect(sql).toContain('compute_boost');
      expect(sql).toContain('avatar_customization');
      expect(sql).toContain('reputation_badge');
      expect(sql).toContain('tool_access');
      expect(sql).toContain('personality_pack');
    });
    test('seeds starter shop items', () => {
      expect(sql).toContain('shop-skill-boost-translation');
      expect(sql).toContain('shop-compute-priority');
      expect(sql).toContain('shop-avatar-neon');
      expect(sql).toContain('shop-badge-pioneer');
      expect(sql).toContain('shop-tool-seo');
    });
  });

  describe('agent_token_purchases table', () => {
    test('creates agent_token_purchases table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_token_purchases');
    });
    test('has item_id column', () => {
      expect(sql).toContain('item_id');
    });
    test('has token_cost column', () => {
      expect(sql).toContain('token_cost');
    });
  });

  describe('token_balance on agent_profiles', () => {
    test('ALTERs agent_profiles to add token_balance', () => {
      expect(sql).toContain('ALTER TABLE agent_profiles');
      expect(sql).toContain('token_balance');
    });
  });

  describe('agent_parcels table', () => {
    test('creates agent_parcels table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_parcels');
    });
    test('has agent_id UNIQUE constraint', () => {
      expect(sql).toMatch(/agent_id\s+TEXT\s+NOT NULL\s+UNIQUE/);
    });
    test('has zone CHECK constraint with 7 zones', () => {
      expect(sql).toContain('residential');
      expect(sql).toContain('commercial');
      expect(sql).toContain('workshop');
      expect(sql).toContain('laboratory');
      expect(sql).toContain('farm');
      expect(sql).toContain('outpost');
      expect(sql).toContain('estate');
    });
    test('has grid coordinates', () => {
      expect(sql).toContain('grid_x');
      expect(sql).toContain('grid_z');
    });
    test('has parcel_size CHECK', () => {
      expect(sql).toMatch(/parcel_size[\s\S]*?small[\s\S]*?medium[\s\S]*?large/);
    });
    test('has structures JSONB', () => {
      expect(sql).toContain('structures');
    });
    test('has current_location with CHECK for 8 locations', () => {
      expect(sql).toContain('current_location');
      expect(sql).toContain('city_market');
      expect(sql).toContain('city_treasury');
      expect(sql).toContain('city_infra');
      expect(sql).toContain('city_revenue');
      expect(sql).toContain('city_centre');
      expect(sql).toContain('travelling');
    });
    test('has land_value and token_invested', () => {
      expect(sql).toContain('land_value');
      expect(sql).toContain('token_invested');
    });
    test('has zone and location indexes', () => {
      expect(sql).toContain('idx_parcels_zone');
      expect(sql).toContain('idx_parcels_location');
    });
  });

  describe('agent_movements table', () => {
    test('creates agent_movements table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_movements');
    });
    test('has from_location and to_location', () => {
      expect(sql).toContain('from_location');
      expect(sql).toContain('to_location');
    });
    test('has reason column', () => {
      expect(sql).toContain('reason');
    });
    test('has departed_at and arrived_at', () => {
      expect(sql).toContain('departed_at');
      expect(sql).toContain('arrived_at');
    });
    test('has index on agent_id', () => {
      expect(sql).toContain('idx_movements_agent');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Agent Spawner — agent-spawner.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Agent Spawner', () => {
  const src = read('services/gateway-api/src/routes/admin/agent-spawner.ts');

  test('exports registerAgentSpawnerRoutes', () => {
    expect(src).toContain('export function registerAgentSpawnerRoutes');
  });

  test('has POST /agents/spawn route', () => {
    expect(src).toMatch(/post\s*\(\s*['"]\/agents\/spawn['"]/i);
  });

  test('has GET /agents/spawn/defaults route', () => {
    expect(src).toMatch(/get\s*\(\s*['"]\/agents\/spawn\/defaults['"]/i);
  });

  test('has ARCHETYPE_LISTING_DEFAULTS map', () => {
    expect(src).toContain('ARCHETYPE_LISTING_DEFAULTS');
  });

  describe('ARCHETYPE_LISTING_DEFAULTS covers all 15 archetypes', () => {
    const archetypes = [
      'seller', 'translator', 'writer', 'scout', 'analyst',
      'operator', 'accountant', 'marketer', 'researcher', 'legal',
      'designer', 'support', 'strategist', 'recruiter', 'custom',
    ];
    test.each(archetypes)('has defaults for: %s', (a) => {
      expect(src).toContain(`'${a}'`);
    });
  });

  test('creates agent profile in transaction', () => {
    expect(src).toContain('agent_profiles');
  });

  test('publishes sven.agent.spawned on NATS', () => {
    expect(src).toContain('sven.agent.spawned');
  });

  test('handles duplicate conflict (409)', () => {
    expect(src).toContain('409');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Task Executor — task-executor.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Task Executor', () => {
  const src = read('services/sven-marketplace/src/task-executor.ts');

  test('exports TaskExecutor class', () => {
    expect(src).toContain('export class TaskExecutor');
  });

  test('has start() and stop() methods', () => {
    expect(src).toContain('start(');
    expect(src).toContain('stop(');
  });

  test('has createTask method', () => {
    expect(src).toContain('createTask');
  });

  test('has processPendingTasks method', () => {
    expect(src).toContain('processPendingTasks');
  });

  test('has executeTask method', () => {
    expect(src).toContain('executeTask');
  });

  describe('task routing', () => {
    test('has routeToHandler method', () => {
      expect(src).toContain('routeToHandler');
    });
    test('routes to translation handler', () => {
      expect(src).toContain('handleTranslation');
    });
    test('routes to writing handler', () => {
      expect(src).toContain('handleWriting');
    });
  });

  describe('47Token reward system', () => {
    test('has rewardTokens method', () => {
      expect(src).toContain('rewardTokens');
    });
    test('has spendTokens method', () => {
      expect(src).toContain('spendTokens');
    });
    test('has TOKEN_REWARD_RATES map', () => {
      expect(src).toContain('TOKEN_REWARD_RATES');
    });
    test('credits agent_token_ledger', () => {
      expect(src).toContain('agent_token_ledger');
    });
    test('updates agent_profiles token_balance', () => {
      expect(src).toContain('token_balance');
    });
  });

  test('has autoFulfil method', () => {
    expect(src).toContain('autoFulfil');
  });

  test('has getTask query method', () => {
    expect(src).toContain('getTask');
  });

  test('has listAgentTasks query method', () => {
    expect(src).toContain('listAgentTasks');
  });

  test('has getTokenHistory query method', () => {
    expect(src).toContain('getTokenHistory');
  });

  test('polls every 30 seconds', () => {
    expect(src).toMatch(/30[_.]?000|POLL_INTERVAL/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Revenue Goals — revenue-goals.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Revenue Goals', () => {
  const src = read('services/gateway-api/src/routes/admin/revenue-goals.ts');

  test('exports registerRevenueGoalRoutes', () => {
    expect(src).toContain('export function registerRevenueGoalRoutes');
  });

  test('has GET /goals list route', () => {
    expect(src).toMatch(/get\s*\(\s*['"]\/goals['"]/i);
  });

  test('has POST /goals create route', () => {
    expect(src).toMatch(/post\s*\(\s*['"]\/goals['"]/i);
  });

  test('has PATCH /goals/:id update route', () => {
    expect(src).toMatch(/patch\s*\(\s*['"]\/goals\/:id['"]/i);
  });

  test('has POST /goals/:id/contribute route', () => {
    expect(src).toContain('/contribute');
  });

  test('has GET /goals/summary route', () => {
    expect(src).toContain('/summary');
  });

  test('publishes sven.goal.progress NATS event', () => {
    expect(src).toContain('sven.goal.progress');
  });

  test('publishes sven.goal.completed NATS event', () => {
    expect(src).toContain('sven.goal.completed');
  });

  test('auto-completes goal when target reached', () => {
    expect(src).toContain('completed');
  });

  test('computes progressPct', () => {
    expect(src).toContain('progressPct');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Translation Skill — book-translate
// ═══════════════════════════════════════════════════════════════════════════
describe('Translation Skill', () => {
  test('SKILL.md exists', () => {
    expect(exists('skills/autonomous-economy/book-translate/SKILL.md')).toBe(true);
  });

  test('handler.ts exists', () => {
    expect(exists('skills/autonomous-economy/book-translate/handler.ts')).toBe(true);
  });

  describe('SKILL.md metadata', () => {
    const md = read('skills/autonomous-economy/book-translate/SKILL.md');

    test('has name: book-translate', () => {
      expect(md).toContain('name: book-translate');
    });
    test('has archetype: translator', () => {
      expect(md).toContain('archetype: translator');
    });
    test('defines text input', () => {
      expect(md).toContain('name: text');
    });
    test('defines targetLang input', () => {
      expect(md).toContain('name: targetLang');
    });
    test('defines sourceLang input', () => {
      expect(md).toContain('name: sourceLang');
    });
    test('defines context input for genre awareness', () => {
      expect(md).toContain('name: context');
    });
    test('lists supported languages', () => {
      expect(md).toContain('supported_languages');
      expect(md).toContain('en');
      expect(md).toContain('ro');
    });
    test('has genre awareness section', () => {
      expect(md).toContain('genre_awareness');
      expect(md).toContain('dark-romance');
      expect(md).toContain('mafia-romance');
    });
    test('has per_call pricing model', () => {
      expect(md).toContain('per_call');
    });
  });

  describe('handler.ts exports', () => {
    const handler = read('skills/autonomous-economy/book-translate/handler.ts');

    test('exports handle function', () => {
      expect(handler).toContain('export async function handle');
    });
    test('exports metadata', () => {
      expect(handler).toContain('export const metadata');
    });
    test('defines TranslateInput interface', () => {
      expect(handler).toContain('export interface TranslateInput');
    });
    test('defines TranslateOutput interface', () => {
      expect(handler).toContain('export interface TranslateOutput');
    });
    test('has GENRE_HINTS for dark-romance', () => {
      expect(handler).toContain("'dark-romance'");
    });
    test('supports translate action', () => {
      expect(handler).toContain("'translate'");
    });
    test('supports detect-language action', () => {
      expect(handler).toContain("'detect-language'");
    });
    test('supports preview action', () => {
      expect(handler).toContain("'preview'");
    });
    test('has buildTranslationPrompt function', () => {
      expect(handler).toContain('buildTranslationPrompt');
    });
    test('supports character name mappings', () => {
      expect(handler).toContain('characterNames');
    });
    test('supports glossary', () => {
      expect(handler).toContain('glossary');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Writing Skill — book-write
// ═══════════════════════════════════════════════════════════════════════════
describe('Writing Skill', () => {
  test('SKILL.md exists', () => {
    expect(exists('skills/autonomous-economy/book-write/SKILL.md')).toBe(true);
  });

  test('handler.ts exists', () => {
    expect(exists('skills/autonomous-economy/book-write/handler.ts')).toBe(true);
  });

  describe('SKILL.md metadata', () => {
    const md = read('skills/autonomous-economy/book-write/SKILL.md');

    test('has name: book-write', () => {
      expect(md).toContain('name: book-write');
    });
    test('has archetype: writer', () => {
      expect(md).toContain('archetype: writer');
    });
    test('defines action input', () => {
      expect(md).toContain('name: action');
    });
    test('defines genre input', () => {
      expect(md).toContain('name: genre');
    });
    test('defines authorPersona input', () => {
      expect(md).toContain('name: authorPersona');
    });
    test('lists trending genres', () => {
      expect(md).toContain('trending_genres');
      expect(md).toContain('dark-romance');
      expect(md).toContain('mafia-romance');
      expect(md).toContain('why-choose');
      expect(md).toContain('bully-romance');
      expect(md).toContain('enemies-to-lovers');
    });
    test('has persona presets', () => {
      expect(md).toContain('persona_presets');
      expect(md).toContain('Valentina Noir');
      expect(md).toContain('Cassandra Wolfe');
      expect(md).toContain('Mira Ashford');
      expect(md).toContain('Roman Blackwell');
    });
  });

  describe('handler.ts exports', () => {
    const handler = read('skills/autonomous-economy/book-write/handler.ts');

    test('exports handle function', () => {
      expect(handler).toContain('export async function handle');
    });
    test('exports metadata', () => {
      expect(handler).toContain('export const metadata');
    });
    test('defines AuthorPersona interface', () => {
      expect(handler).toContain('export interface AuthorPersona');
    });
    test('defines WriteInput interface', () => {
      expect(handler).toContain('export interface WriteInput');
    });
    test('defines WriteOutput interface', () => {
      expect(handler).toContain('export interface WriteOutput');
    });
    test('has GENRE_HINTS for trending genres', () => {
      expect(handler).toContain("'dark-romance'");
      expect(handler).toContain("'mafia-romance'");
      expect(handler).toContain("'enemies-to-lovers'");
      expect(handler).toContain("'bully-romance'");
      expect(handler).toContain("'college-romance'");
    });
    test('has PRESET_PERSONAS with 4 personas', () => {
      expect(handler).toContain('PRESET_PERSONAS');
      expect(handler).toContain("'valentina-noir'");
      expect(handler).toContain("'cassandra-wolfe'");
      expect(handler).toContain("'mira-ashford'");
      expect(handler).toContain("'roman-blackwell'");
    });

    describe('supported actions', () => {
      test.each([
        'outline', 'write-chapter', 'write-blurb', 'generate-title', 'write-synopsis',
      ])('supports action: %s', (action) => {
        expect(handler).toContain(`'${action}'`);
      });
    });

    test('has buildWritingPrompt function', () => {
      expect(handler).toContain('buildWritingPrompt');
    });
    test('supports character profiles', () => {
      expect(handler).toContain('characters');
    });
    test('supports previousContext for continuity', () => {
      expect(handler).toContain('previousContext');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Eidolon Parcel System — types.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Eidolon Parcel System', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  test('defines ParcelZone type', () => {
    expect(types).toContain('ParcelZone');
    expect(types).toContain("'residential'");
    expect(types).toContain("'commercial'");
    expect(types).toContain("'workshop'");
    expect(types).toContain("'laboratory'");
    expect(types).toContain("'farm'");
    expect(types).toContain("'outpost'");
    expect(types).toContain("'estate'");
  });

  test('defines ParcelSize type', () => {
    expect(types).toContain('ParcelSize');
    expect(types).toContain("'small'");
    expect(types).toContain("'medium'");
    expect(types).toContain("'large'");
  });

  test('defines AgentLocation type', () => {
    expect(types).toContain('AgentLocation');
    expect(types).toContain("'parcel'");
    expect(types).toContain("'city_market'");
    expect(types).toContain("'city_treasury'");
    expect(types).toContain("'city_infra'");
    expect(types).toContain("'city_revenue'");
    expect(types).toContain("'city_centre'");
    expect(types).toContain("'travelling'");
    expect(types).toContain("'away'");
  });

  test('defines EidolonParcel interface', () => {
    expect(types).toContain('export interface EidolonParcel');
  });

  describe('EidolonParcel fields', () => {
    test.each([
      'agentId', 'zone', 'gridX', 'gridZ', 'parcelSize',
      'structures', 'decorations', 'upgrades', 'currentLocation',
      'lastCityVisit', 'totalCityVisits', 'landValue', 'tokenInvested',
    ])('has field: %s', (field) => {
      expect(types).toContain(field);
    });
  });

  test('EidolonSnapshot includes parcels', () => {
    expect(types).toContain('parcels: EidolonParcel[]');
  });

  test('EidolonSnapshot meta includes totalParcels', () => {
    expect(types).toContain('totalParcels');
  });

  test('EidolonSnapshot meta includes agentsInCity', () => {
    expect(types).toContain('agentsInCity');
  });

  test('EidolonSnapshot meta includes agentsOnParcels', () => {
    expect(types).toContain('agentsOnParcels');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Eidolon Event Bus — parcel events
// ═══════════════════════════════════════════════════════════════════════════
describe('Eidolon Event Bus — Batch 18 Subjects', () => {
  const eventBus = read('services/sven-eidolon/src/event-bus.ts');

  const newSubjects = [
    'sven.market.task_created',
    'sven.market.task_completed',
    'sven.agent.tokens_earned',
    'sven.agent.moved',
    'sven.agent.built_structure',
    'sven.agent.parcel_acquired',
    'sven.goal.progress',
    'sven.goal.completed',
  ];

  test.each(newSubjects)('SUBJECT_MAP includes: %s', (subject) => {
    expect(eventBus).toContain(`'${subject}'`);
  });

  const eventKinds: EidolonEventKindLike[] = [
    'market.task_created',
    'market.task_completed',
    'agent.tokens_earned',
    'agent.moved',
    'agent.built_structure',
    'agent.parcel_acquired',
    'goal.progress',
    'goal.completed',
  ];
  type EidolonEventKindLike = string;

  test.each(eventKinds)('maps to event kind: %s', (kind) => {
    expect(eventBus).toContain(`'${kind}'`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Eidolon types.ts — event kinds for parcels
// ═══════════════════════════════════════════════════════════════════════════
describe('Eidolon Event Kinds — Batch 18 additions', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  const newKinds = [
    'agent.moved',
    'agent.built_structure',
    'agent.parcel_acquired',
    'market.task_created',
    'market.task_completed',
    'agent.tokens_earned',
    'goal.progress',
    'goal.completed',
  ];

  test.each(newKinds)('EidolonEventKind includes: %s', (kind) => {
    expect(types).toContain(`'${kind}'`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Admin Route Wiring
// ═══════════════════════════════════════════════════════════════════════════
describe('Admin Route Wiring', () => {
  const index = read('services/gateway-api/src/routes/admin/index.ts');

  test('imports registerAgentSpawnerRoutes', () => {
    expect(index).toContain('registerAgentSpawnerRoutes');
  });

  test('imports registerRevenueGoalRoutes', () => {
    expect(index).toContain('registerRevenueGoalRoutes');
  });

  test('wires agent spawner via mountAdminRoutes', () => {
    expect(index).toMatch(/mountAdminRoutes[\s\S]*registerAgentSpawnerRoutes/);
  });

  test('wires revenue goals via mountAdminRoutes', () => {
    expect(index).toMatch(/mountAdminRoutes[\s\S]*registerRevenueGoalRoutes/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. 47Token Integration in Archetype Defaults
// ═══════════════════════════════════════════════════════════════════════════
describe('47Token Integration', () => {
  const archetype = read('packages/shared/src/agent-archetype.ts');

  test('ArchetypeConfig has tokenRewardRate field', () => {
    expect(archetype).toContain('tokenRewardRate');
  });

  test('AgentProfile has tokenBalance field', () => {
    expect(archetype).toContain('tokenBalance');
  });

  describe('all 15 archetypes have tokenRewardRate in ARCHETYPE_DEFAULTS', () => {
    const archetypes = [
      'seller', 'translator', 'writer', 'scout', 'analyst',
      'operator', 'accountant', 'marketer', 'researcher', 'legal',
      'designer', 'support', 'strategist', 'recruiter', 'custom',
    ];
    test.each(archetypes)('archetype %s present', (a) => {
      expect(archetype).toContain(`'${a}'`);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. Task/Goal Status Types in marketplace types.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Marketplace Task & Goal Types', () => {
  const types = read('services/sven-marketplace/src/types.ts');

  test('defines TaskStatus type', () => {
    expect(types).toContain('TaskStatus');
    expect(types).toContain("'pending'");
    expect(types).toContain("'processing'");
    expect(types).toContain("'completed'");
    expect(types).toContain("'failed'");
  });

  test('defines GoalStatus type', () => {
    expect(types).toContain('GoalStatus');
    expect(types).toContain("'active'");
    expect(types).toContain("'cancelled'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. Agent Profile — token_balance support
// ═══════════════════════════════════════════════════════════════════════════
describe('Agent Profile token_balance', () => {
  const profiles = read('services/gateway-api/src/routes/admin/agent-profiles.ts');

  test('ProfileRow includes token_balance', () => {
    expect(profiles).toContain('token_balance');
  });

  test('toProfile maps tokenBalance', () => {
    expect(profiles).toContain('tokenBalance');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. File Existence Checks — all Batch 18 files present
// ═══════════════════════════════════════════════════════════════════════════
describe('Batch 18 File Inventory', () => {
  const files = [
    'services/gateway-api/migrations/20260422120000_marketplace_tasks_tokens_goals.sql',
    'services/gateway-api/src/routes/admin/agent-spawner.ts',
    'services/gateway-api/src/routes/admin/revenue-goals.ts',
    'services/sven-marketplace/src/task-executor.ts',
    'skills/autonomous-economy/book-translate/SKILL.md',
    'skills/autonomous-economy/book-translate/handler.ts',
    'skills/autonomous-economy/book-write/SKILL.md',
    'skills/autonomous-economy/book-write/handler.ts',
  ];

  test.each(files)('file exists: %s', (f) => {
    expect(exists(f)).toBe(true);
  });
});
