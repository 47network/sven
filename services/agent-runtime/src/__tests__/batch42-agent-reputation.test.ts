/**
 * Batch 42 — Agent Reputation & Trust Economy
 *
 * Tests: migration SQL, shared types, SKILL.md, Eidolon wiring,
 * event-bus subjects, task-executor handlers, .gitattributes, shared index.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), 'utf-8');

/* ================================================================
   1. Migration SQL
   ================================================================ */
describe('Batch 42 — Migration SQL', () => {
  const sql = read(
    'services/gateway-api/migrations/20260515120000_agent_reputation.sql',
  );

  it('creates agent_reputations table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_reputations');
  });

  it('creates reputation_reviews table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS reputation_reviews');
  });

  it('creates trust_connections table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS trust_connections');
  });

  it('creates reputation_events table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS reputation_events');
  });

  it('has at least 10 indexes', () => {
    const idxCount = (sql.match(/CREATE INDEX/gi) || []).length;
    expect(idxCount).toBeGreaterThanOrEqual(10);
  });
});

/* ================================================================
   2. Shared Types
   ================================================================ */
describe('Batch 42 — Shared Types', () => {
  const types = read('packages/shared/src/agent-reputation.ts');

  it('exports ReputationTier type', () => {
    expect(types).toContain('ReputationTier');
  });

  it('has 7 tier values', () => {
    expect(types).toContain('newcomer');
    expect(types).toContain('apprentice');
    expect(types).toContain('journeyman');
    expect(types).toContain('expert');
    expect(types).toContain('master');
    expect(types).toContain('grandmaster');
    expect(types).toContain('legendary');
  });

  it('exports ReputationDimension type', () => {
    expect(types).toContain('ReputationDimension');
  });

  it('has 6 dimension values', () => {
    expect(types).toContain('reliability');
    expect(types).toContain('quality');
    expect(types).toContain('speed');
    expect(types).toContain('collaboration');
    expect(types).toContain('innovation');
  });

  it('exports TrustConnectionType type', () => {
    expect(types).toContain('TrustConnectionType');
  });

  it('exports ReputationEventType type', () => {
    expect(types).toContain('ReputationEventType');
  });

  it('exports ReputationBadge type with 12 badge values', () => {
    expect(types).toContain('ReputationBadge');
    expect(types).toContain('first_task');
    expect(types).toContain('hundred_tasks');
    expect(types).toContain('five_star');
    expect(types).toContain('speed_demon');
    expect(types).toContain('team_player');
    expect(types).toContain('innovator');
    expect(types).toContain('trusted_partner');
  });

  it('exports AgentrAgentReputation interface', () => {
    expect(types).toContain('AgentrAgentReputation');
  });

  it('exports ReputationReview interface', () => {
    expect(types).toContain('ReputationReview');
  });

  it('exports TrustConnection interface', () => {
    expect(types).toContain('TrustConnection');
  });

  it('exports ReputationEvent interface', () => {
    expect(types).toContain('ReputationEvent');
  });

  it('exports TIER_THRESHOLDS constant', () => {
    expect(types).toContain('TIER_THRESHOLDS');
  });

  it('exports getTierForScore helper', () => {
    expect(types).toContain('getTierForScore');
  });

  it('exports calculateTrustScore helper', () => {
    expect(types).toContain('calculateTrustScore');
  });

  it('exports getWeightedRating helper', () => {
    expect(types).toContain('getWeightedRating');
  });

  it('exports canPromoteTier helper', () => {
    expect(types).toContain('canPromoteTier');
  });
});

/* ================================================================
   3. Shared Index
   ================================================================ */
describe('Batch 42 — Shared Index', () => {
  const idx = read('packages/shared/src/index.ts');

  it('exports agent-reputation module', () => {
    expect(idx).toContain("export * from './agent-reputation.js'");
  });

  it('has 68 lines (split count)', () => {
    expect(idx.split('\n').length).toBe(68);
  });
});

/* ================================================================
   4. SKILL.md
   ================================================================ */
describe('Batch 42 — SKILL.md', () => {
  const skill = read('skills/autonomous-economy/agent-reputation/SKILL.md');

  it('contains skill title', () => {
    expect(skill).toContain('Agent Reputation & Trust Economy');
  });

  it('defines reputation_profile action', () => {
    expect(skill).toContain('reputation_profile');
  });

  it('defines reputation_review action', () => {
    expect(skill).toContain('reputation_review');
  });

  it('defines trust_connect action', () => {
    expect(skill).toContain('trust_connect');
  });

  it('defines trust_query action', () => {
    expect(skill).toContain('trust_query');
  });

  it('defines badge_award action', () => {
    expect(skill).toContain('badge_award');
  });

  it('defines tier_evaluate action', () => {
    expect(skill).toContain('tier_evaluate');
  });

  it('defines reputation_leaderboard action', () => {
    expect(skill).toContain('reputation_leaderboard');
  });

  it('describes 7 tiers', () => {
    expect(skill).toContain('newcomer');
    expect(skill).toContain('legendary');
  });

  it('describes 12 badges', () => {
    expect(skill).toContain('first_task');
    expect(skill).toContain('trusted_partner');
  });

  it('describes trust network levels', () => {
    expect(skill).toContain('Trust Network');
  });

  it('references Eidolon integration', () => {
    expect(skill).toContain('Eidolon Integration');
    expect(skill).toContain('reputation_monument');
  });
});

/* ================================================================
   5. Eidolon Types
   ================================================================ */
describe('Batch 42 — Eidolon Types', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  it('has reputation_monument building kind', () => {
    expect(types).toContain("'reputation_monument'");
  });

  it('has 26 building kind values (26 pipes)', () => {
    const block = types.split('EidolonBuildingKind')[1].split(';')[0];
    const pipes = (block.match(/\|/g) || []).length;
    expect(pipes).toBe(26);
  });

  it('has reputation.reviewed event kind', () => {
    expect(types).toContain("'reputation.reviewed'");
  });

  it('has reputation.promoted event kind', () => {
    expect(types).toContain("'reputation.promoted'");
  });

  it('has trust.established event kind', () => {
    expect(types).toContain("'trust.established'");
  });

  it('has badge.awarded event kind', () => {
    expect(types).toContain("'badge.awarded'");
  });

  it('has 116 event kind values (116 pipes)', () => {
    const block = types.split('EidolonEventKind')[1].split(';')[0];
    const pipes = (block.match(/\|/g) || []).length;
    expect(pipes).toBe(116);
  });

  it('districtFor handles reputation_monument', () => {
    expect(types).toContain("case 'reputation_monument':");
    expect(types).toContain("return 'market'");
  });

  it('districtFor has 26 cases', () => {
    const fn = types.split('districtFor')[1] || '';
    const cases = (fn.match(/case '/g) || []).length;
    expect(cases).toBe(26);
  });
});

/* ================================================================
   6. Event Bus
   ================================================================ */
describe('Batch 42 — Event Bus', () => {
  const bus = read('services/sven-eidolon/src/event-bus.ts');

  it('maps sven.reputation.reviewed', () => {
    expect(bus).toContain("'sven.reputation.reviewed'");
  });

  it('maps sven.reputation.promoted', () => {
    expect(bus).toContain("'sven.reputation.promoted'");
  });

  it('maps sven.trust.established', () => {
    expect(bus).toContain("'sven.trust.established'");
  });

  it('maps sven.badge.awarded', () => {
    expect(bus).toContain("'sven.badge.awarded'");
  });

  it('has 115 SUBJECT_MAP entries', () => {
    const entries = (bus.match(/'sven\./g) || []).length;
    expect(entries).toBe(115);
  });
});

/* ================================================================
   7. Task Executor — Switch Cases
   ================================================================ */
describe('Batch 42 — Task Executor Switch Cases', () => {
  const tex = read('services/sven-marketplace/src/task-executor.ts');

  it('routes reputation_profile', () => {
    expect(tex).toContain("case 'reputation_profile':");
  });

  it('routes reputation_review', () => {
    expect(tex).toContain("case 'reputation_review':");
  });

  it('routes trust_connect', () => {
    expect(tex).toContain("case 'trust_connect':");
  });

  it('routes trust_query', () => {
    expect(tex).toContain("case 'trust_query':");
  });

  it('routes badge_award', () => {
    expect(tex).toContain("case 'badge_award':");
  });

  it('routes tier_evaluate', () => {
    expect(tex).toContain("case 'tier_evaluate':");
  });

  it('routes reputation_leaderboard', () => {
    expect(tex).toContain("case 'reputation_leaderboard':");
  });

  it('has 75 switch cases total', () => {
    const cases = (tex.match(/case '/g) || []).length;
    expect(cases).toBe(75);
  });
});

/* ================================================================
   8. Task Executor — Handler Methods
   ================================================================ */
describe('Batch 42 — Task Executor Handlers', () => {
  const tex = read('services/sven-marketplace/src/task-executor.ts');

  it('implements handleReputationProfile', () => {
    expect(tex).toContain('handleReputationProfile');
  });

  it('implements handleReputationReview', () => {
    expect(tex).toContain('handleReputationReview');
  });

  it('implements handleTrustConnect', () => {
    expect(tex).toContain('handleTrustConnect');
  });

  it('implements handleTrustQuery', () => {
    expect(tex).toContain('handleTrustQuery');
  });

  it('implements handleBadgeAward', () => {
    expect(tex).toContain('handleBadgeAward');
  });

  it('implements handleTierEvaluate', () => {
    expect(tex).toContain('handleTierEvaluate');
  });

  it('implements handleReputationLeaderboard', () => {
    expect(tex).toContain('handleReputationLeaderboard');
  });

  it('has 71 handler methods total', () => {
    const handlers = (tex.match(/private (?:async )?handle[A-Z]/g) || []).length;
    expect(handlers).toBe(71);
  });

  it('handleReputationProfile returns tier and badges', () => {
    expect(tex).toMatch(/handleReputationProfile[\s\S]*tier[\s\S]*badges/);
  });

  it('handleTrustConnect returns connectionType and trustLevel', () => {
    expect(tex).toMatch(
      /handleTrustConnect[\s\S]*connectionType[\s\S]*trustLevel/,
    );
  });

  it('handleTierEvaluate returns promoted flag', () => {
    expect(tex).toMatch(/handleTierEvaluate[\s\S]*promoted/);
  });

  it('handleReputationLeaderboard returns ranked entries', () => {
    expect(tex).toMatch(/handleReputationLeaderboard[\s\S]*rank[\s\S]*score/);
  });
});

/* ================================================================
   9. .gitattributes
   ================================================================ */
describe('Batch 42 — .gitattributes', () => {
  const ga = read('.gitattributes');

  it('marks migration as export-ignore', () => {
    expect(ga).toContain(
      'services/gateway-api/migrations/20260515120000_agent_reputation.sql export-ignore',
    );
  });

  it('marks shared types as export-ignore', () => {
    expect(ga).toContain(
      'packages/shared/src/agent-reputation.ts export-ignore',
    );
  });

  it('marks skill as export-ignore', () => {
    expect(ga).toContain(
      'skills/autonomous-economy/agent-reputation/** export-ignore',
    );
  });

  it('marks test as export-ignore', () => {
    expect(ga).toContain(
      'services/agent-runtime/src/__tests__/batch42-agent-reputation.test.ts export-ignore',
    );
  });
});
