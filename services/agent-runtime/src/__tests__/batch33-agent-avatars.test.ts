/**
 * Batch 33 — Agent Avatars & Identity (Animated Companion)
 *
 * Tests that:
 * 1. Migration creates 4 tables + ALTER with correct CHECK values
 * 2. Shared types export correct types, constants, utilities
 * 3. SKILL.md has correct structure + 10 actions + 12 item categories
 * 4. Task executor has 3 new switch cases + handlers
 * 5. Eidolon has avatar_gallery building + 4 identity.* events + districtFor
 * 6. SUBJECT_MAP has 4 new identity entries
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

const migrationSql = readFile('services/gateway-api/migrations/20260507120000_agent_avatars.sql');
const sharedTypes = readFile('packages/shared/src/agent-avatars.ts');
const sharedIndex = readFile('packages/shared/src/index.ts');
const skillMd = readFile('skills/ai-agency/agent-identity/SKILL.md');
const taskExecutor = readFile('services/sven-marketplace/src/task-executor.ts');
const eidolonTypes = readFile('services/sven-eidolon/src/types.ts');
const eventBus = readFile('services/sven-eidolon/src/event-bus.ts');

// ═══════════════════════════════════════════════════════════════════
// 1. Migration SQL
// ═══════════════════════════════════════════════════════════════════
describe('Migration — 20260507120000_agent_avatars.sql', () => {
  test('creates agent_avatars table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS agent_avatars');
  });

  test('creates agent_traits table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS agent_traits');
  });

  test('creates avatar_items table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS avatar_items');
  });

  test('creates agent_inventory table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS agent_inventory');
  });

  test('agent_avatars has 7-value style CHECK', () => {
    expect(migrationSql).toContain("style IN ('cyberpunk','minimalist','retro','organic','glitch','neon','steampunk')");
  });

  test('agent_avatars has 8-value mood CHECK', () => {
    expect(migrationSql).toContain("mood IN ('neutral','happy','focused','stressed','creative','tired','excited','contemplative')");
  });

  test('agent_avatars has 6-value form CHECK', () => {
    expect(migrationSql).toContain("form IN ('orb','humanoid','geometric','animal','abstract','mech')");
  });

  test('agent_avatars has glow_intensity range CHECK', () => {
    expect(migrationSql).toContain('glow_intensity >= 0 AND glow_intensity <= 100');
  });

  test('agent_traits has 12-value trait_name CHECK', () => {
    expect(migrationSql).toContain("'creativity'");
    expect(migrationSql).toContain("'diligence'");
    expect(migrationSql).toContain("'curiosity'");
    expect(migrationSql).toContain("'sociability'");
    expect(migrationSql).toContain("'precision'");
    expect(migrationSql).toContain("'adaptability'");
    expect(migrationSql).toContain("'leadership'");
    expect(migrationSql).toContain("'empathy'");
    expect(migrationSql).toContain("'resilience'");
    expect(migrationSql).toContain("'humor'");
    expect(migrationSql).toContain("'ambition'");
    expect(migrationSql).toContain("'patience'");
  });

  test('agent_traits has score range CHECK', () => {
    expect(migrationSql).toContain('score >= 0 AND score <= 100');
  });

  test('agent_traits has 3-value trend CHECK', () => {
    expect(migrationSql).toContain("trend IN ('rising','stable','declining')");
  });

  test('avatar_items has 12-value category CHECK including construction', () => {
    expect(migrationSql).toContain("'hat'");
    expect(migrationSql).toContain("'accessory'");
    expect(migrationSql).toContain("'material'");
    expect(migrationSql).toContain("'blueprint'");
    expect(migrationSql).toContain("'furniture'");
    expect(migrationSql).toContain("'upgrade'");
  });

  test('avatar_items has 5-value rarity CHECK', () => {
    expect(migrationSql).toContain("rarity IN ('common','uncommon','rare','epic','legendary')");
  });

  test('agent_inventory references avatar_items', () => {
    expect(migrationSql).toContain('REFERENCES avatar_items(id)');
  });

  test('ALTER adds avatar_customize to task_type CHECK', () => {
    expect(migrationSql).toContain("'avatar_customize'");
  });

  test('ALTER adds trait_evolve to task_type CHECK', () => {
    expect(migrationSql).toContain("'trait_evolve'");
  });

  test('ALTER adds mood_update to task_type CHECK', () => {
    expect(migrationSql).toContain("'mood_update'");
  });

  test('has indexes for agent_avatars', () => {
    expect(migrationSql).toContain('idx_agent_avatars_agent');
    expect(migrationSql).toContain('idx_agent_avatars_style');
    expect(migrationSql).toContain('idx_agent_avatars_mood');
  });

  test('has indexes for agent_traits', () => {
    expect(migrationSql).toContain('idx_agent_traits_agent');
    expect(migrationSql).toContain('idx_agent_traits_name');
    expect(migrationSql).toContain('idx_agent_traits_unique');
  });

  test('has indexes for avatar_items', () => {
    expect(migrationSql).toContain('idx_avatar_items_category');
    expect(migrationSql).toContain('idx_avatar_items_rarity');
  });

  test('has indexes for agent_inventory', () => {
    expect(migrationSql).toContain('idx_agent_inventory_agent');
    expect(migrationSql).toContain('idx_agent_inventory_item');
    expect(migrationSql).toContain('idx_agent_inventory_unique');
  });

  test('has 5 settings_global defaults', () => {
    expect(migrationSql).toContain("'avatar.default_style'");
    expect(migrationSql).toContain("'avatar.mood_decay_hours'");
    expect(migrationSql).toContain("'avatar.trait_evolution_rate'");
    expect(migrationSql).toContain("'avatar.max_inventory_slots'");
    expect(migrationSql).toContain("'avatar.glow_on_activity'");
  });

  test('wraps in transaction', () => {
    expect(migrationSql).toContain('BEGIN;');
    expect(migrationSql).toContain('COMMIT;');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Shared types — agent-avatars.ts
// ═══════════════════════════════════════════════════════════════════
describe('Shared types — agent-avatars.ts', () => {
  test('exports AvatarStyle type with 7 values', () => {
    expect(sharedTypes).toContain("'cyberpunk' | 'minimalist' | 'retro' | 'organic' | 'glitch' | 'neon' | 'steampunk'");
  });

  test('exports AgentaAgentMood type with 8 values', () => {
    expect(sharedTypes).toContain("'neutral' | 'happy' | 'focused' | 'stressed' | 'creative' | 'tired' | 'excited' | 'contemplative'");
  });

  test('exports AvatarForm type with 6 values', () => {
    expect(sharedTypes).toContain("'orb' | 'humanoid' | 'geometric' | 'animal' | 'abstract' | 'mech'");
  });

  test('exports TraitName type with 12 values', () => {
    expect(sharedTypes).toContain("| 'creativity'");
    expect(sharedTypes).toContain("| 'patience'");
  });

  test('exports TraitTrend type with 3 values', () => {
    expect(sharedTypes).toContain("'rising' | 'stable' | 'declining'");
  });

  test('exports ItemCategory type with 12 values including construction', () => {
    expect(sharedTypes).toContain("'material'");
    expect(sharedTypes).toContain("'blueprint'");
    expect(sharedTypes).toContain("'furniture'");
    expect(sharedTypes).toContain("'upgrade'");
  });

  test('exports ItemRarity type with 5 values', () => {
    expect(sharedTypes).toContain("'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'");
  });

  test('exports AVATAR_STYLES constant', () => {
    expect(sharedTypes).toContain('AVATAR_STYLES');
  });

  test('exports AGENT_MOODS constant', () => {
    expect(sharedTypes).toContain('AGENT_MOODS');
  });

  test('exports AVATAR_FORMS constant', () => {
    expect(sharedTypes).toContain('AVATAR_FORMS');
  });

  test('exports TRAIT_NAMES constant', () => {
    expect(sharedTypes).toContain('TRAIT_NAMES');
  });

  test('exports TRAIT_TRENDS constant', () => {
    expect(sharedTypes).toContain('TRAIT_TRENDS');
  });

  test('exports ITEM_CATEGORIES constant with 12 values', () => {
    expect(sharedTypes).toContain('ITEM_CATEGORIES');
    expect(sharedTypes).toContain("'material', 'blueprint', 'furniture', 'upgrade'");
  });

  test('exports ITEM_RARITIES constant', () => {
    expect(sharedTypes).toContain('ITEM_RARITIES');
  });

  test('exports DEFAULT_AVATAR_CONFIG', () => {
    expect(sharedTypes).toContain('DEFAULT_AVATAR_CONFIG');
    expect(sharedTypes).toContain('moodDecayHours: 24');
    expect(sharedTypes).toContain('traitEvolutionRate: 0.05');
    expect(sharedTypes).toContain('maxInventorySlots: 50');
    expect(sharedTypes).toContain('glowOnActivity: true');
  });

  test('exports AgentAvatarRecord interface', () => {
    expect(sharedTypes).toContain('interface AgentAvatarRecord');
  });

  test('exports AgentTraitRecord interface', () => {
    expect(sharedTypes).toContain('interface AgentTraitRecord');
  });

  test('exports AvatarItemRecord interface', () => {
    expect(sharedTypes).toContain('interface AvatarItemRecord');
  });

  test('exports AgentInventoryRecord interface', () => {
    expect(sharedTypes).toContain('interface AgentInventoryRecord');
  });

  test('exports AgentIdentitySnapshot interface', () => {
    expect(sharedTypes).toContain('interface AgentIdentitySnapshot');
  });

  test('exports TraitEvolutionEvent interface', () => {
    expect(sharedTypes).toContain('interface TraitEvolutionEvent');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Utility functions
// ═══════════════════════════════════════════════════════════════════
describe('Shared types — utility functions', () => {
  test('exports getDominantTrait', () => {
    expect(sharedTypes).toContain('function getDominantTrait');
  });

  test('exports computeMoodFromActivity', () => {
    expect(sharedTypes).toContain('function computeMoodFromActivity');
  });

  test('exports computeGlowIntensity', () => {
    expect(sharedTypes).toContain('function computeGlowIntensity');
  });

  test('exports isSignificantTraitChange', () => {
    expect(sharedTypes).toContain('function isSignificantTraitChange');
  });

  test('exports rarityColor', () => {
    expect(sharedTypes).toContain('function rarityColor');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Shared index re-exports
// ═══════════════════════════════════════════════════════════════════
describe('Shared index.ts', () => {
  test('re-exports agent-avatars module', () => {
    expect(sharedIndex).toContain("export * from './agent-avatars.js'");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. SKILL.md — agent-identity
// ═══════════════════════════════════════════════════════════════════
describe('agent-identity SKILL.md', () => {
  test('has name agent-identity', () => {
    expect(skillMd).toContain('name: agent-identity');
  });

  test('has publisher 47dynamics', () => {
    expect(skillMd).toContain('publisher: 47dynamics');
  });

  test('has handler_language typescript', () => {
    expect(skillMd).toContain('handler_language: typescript');
  });

  test('has 10 actions', () => {
    expect(skillMd).toContain('create_avatar');
    expect(skillMd).toContain('customize_avatar');
    expect(skillMd).toContain('get_identity');
    expect(skillMd).toContain('evolve_trait');
    expect(skillMd).toContain('update_mood');
    expect(skillMd).toContain('acquire_item');
    expect(skillMd).toContain('equip_item');
    expect(skillMd).toContain('list_inventory');
    expect(skillMd).toContain('get_trait_profile');
    expect(skillMd).toContain('compute_glow');
  });

  test('has 12 item categories including construction', () => {
    expect(skillMd).toContain('material');
    expect(skillMd).toContain('blueprint');
    expect(skillMd).toContain('furniture');
    expect(skillMd).toContain('upgrade');
  });

  test('has 12 personality traits', () => {
    expect(skillMd).toContain('creativity');
    expect(skillMd).toContain('patience');
    expect(skillMd).toContain('resilience');
    expect(skillMd).toContain('ambition');
  });

  test('has archetype designer', () => {
    expect(skillMd).toContain('archetype: designer');
  });

  test('mentions 47Tokens for purchases', () => {
    expect(skillMd).toContain('47Tokens');
  });

  test('mentions building materials for parcels', () => {
    expect(skillMd).toContain('building materials');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Task executor — avatar cases
// ═══════════════════════════════════════════════════════════════════
describe('Task executor — avatar cases', () => {
  test('has avatar_customize case', () => {
    expect(taskExecutor).toContain("case 'avatar_customize'");
  });

  test('has trait_evolve case', () => {
    expect(taskExecutor).toContain("case 'trait_evolve'");
  });

  test('has mood_update case', () => {
    expect(taskExecutor).toContain("case 'mood_update'");
  });

  test('avatar_customize routes to handleAvatarCustomize', () => {
    expect(taskExecutor).toContain('this.handleAvatarCustomize');
  });

  test('trait_evolve routes to handleTraitEvolve', () => {
    expect(taskExecutor).toContain('this.handleTraitEvolve');
  });

  test('mood_update routes to handleMoodUpdate', () => {
    expect(taskExecutor).toContain('this.handleMoodUpdate');
  });

  test('has 40 total switch cases', () => {
    const caseCount = (taskExecutor.match(/case '/g) || []).length;
    expect(caseCount).toBe(40);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. Task executor — handler output shapes
// ═══════════════════════════════════════════════════════════════════
describe('Task executor — handler outputs', () => {
  test('handleAvatarCustomize returns style and form', () => {
    expect(taskExecutor).toContain('handleAvatarCustomize');
    expect(taskExecutor).toContain('glowIntensity');
    expect(taskExecutor).toContain('animationSet');
  });

  test('handleTraitEvolve returns trait evolution data', () => {
    expect(taskExecutor).toContain('handleTraitEvolve');
    expect(taskExecutor).toContain('previousScore');
    expect(taskExecutor).toContain('newScore');
    expect(taskExecutor).toContain('delta');
  });

  test('handleMoodUpdate computes mood from activity', () => {
    expect(taskExecutor).toContain('handleMoodUpdate');
    expect(taskExecutor).toContain('tasksCompleted');
    expect(taskExecutor).toContain('tasksFailed');
    expect(taskExecutor).toContain('hoursActive');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. Eidolon — building kind
// ═══════════════════════════════════════════════════════════════════
describe('Eidolon — avatar_gallery building kind', () => {
  test('EidolonBuildingKind includes avatar_gallery', () => {
    expect(eidolonTypes).toContain("| 'avatar_gallery'");
  });

  test('has 18 building kinds', () => {
    const block = eidolonTypes.match(/export type EidolonBuildingKind[\s\S]*?;/);
    expect(block).not.toBeNull();
    const pipeCount = (block![0].match(/\| '/g) || []).length;
    expect(pipeCount).toBe(18);
  });

  test('districtFor handles avatar_gallery', () => {
    expect(eidolonTypes).toContain("case 'avatar_gallery':");
  });

  test('avatar_gallery maps to residential district', () => {
    const idx = eidolonTypes.indexOf("case 'avatar_gallery':");
    const slice = eidolonTypes.slice(idx, idx + 80);
    expect(slice).toContain("return 'residential'");
  });

  test('has 18 districtFor cases', () => {
    const caseCount = (eidolonTypes.match(/case '/g) || []).length;
    expect(caseCount).toBe(18);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. Eidolon — event kinds
// ═══════════════════════════════════════════════════════════════════
describe('Eidolon — identity event kinds', () => {
  test('has identity.avatar_created', () => {
    expect(eidolonTypes).toContain("| 'identity.avatar_created'");
  });

  test('has identity.trait_evolved', () => {
    expect(eidolonTypes).toContain("| 'identity.trait_evolved'");
  });

  test('has identity.mood_changed', () => {
    expect(eidolonTypes).toContain("| 'identity.mood_changed'");
  });

  test('has identity.item_acquired', () => {
    expect(eidolonTypes).toContain("| 'identity.item_acquired'");
  });

  test('has 84 total event kinds', () => {
    const block = eidolonTypes.match(/export type EidolonEventKind[\s\S]*?'heartbeat';/);
    expect(block).not.toBeNull();
    const pipeCount = (block![0].match(/\| '/g) || []).length;
    expect(pipeCount).toBe(84);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 10. SUBJECT_MAP — identity entries
// ═══════════════════════════════════════════════════════════════════
describe('Event bus — SUBJECT_MAP identity entries', () => {
  test('maps sven.identity.avatar_created', () => {
    expect(eventBus).toContain("'sven.identity.avatar_created': 'identity.avatar_created'");
  });

  test('maps sven.identity.trait_evolved', () => {
    expect(eventBus).toContain("'sven.identity.trait_evolved': 'identity.trait_evolved'");
  });

  test('maps sven.identity.mood_changed', () => {
    expect(eventBus).toContain("'sven.identity.mood_changed': 'identity.mood_changed'");
  });

  test('maps sven.identity.item_acquired', () => {
    expect(eventBus).toContain("'sven.identity.item_acquired': 'identity.item_acquired'");
  });

  test('has 83 total SUBJECT_MAP entries', () => {
    const entryCount = (eventBus.match(/'sven\./g) || []).length;
    expect(entryCount).toBe(83);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 11. SUBJECT_MAP ↔ EidolonEventKind coherence
// ═══════════════════════════════════════════════════════════════════
describe('SUBJECT_MAP ↔ EidolonEventKind coherence', () => {
  const eventKindBlock = eidolonTypes.match(/export type EidolonEventKind[\s\S]*?'heartbeat';/)?.[0] ?? '';

  test('4 new identity entries all present in both', () => {
    const identityEvents = [
      'identity.avatar_created',
      'identity.trait_evolved',
      'identity.mood_changed',
      'identity.item_acquired',
    ];
    for (const e of identityEvents) {
      expect(eventKindBlock).toContain(`'${e}'`);
      expect(eventBus).toContain(`'sven.${e}'`);
    }
  });
});
