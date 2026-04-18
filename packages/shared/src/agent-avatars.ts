// ---------------------------------------------------------------------------
// Agent Avatars & Identity — shared types (Batch 33)
// Personality evolution, appearance customization, mood tracking
// ---------------------------------------------------------------------------

// ── Visual style ───────────────────────────────────────────────
export type AvatarStyle = 'cyberpunk' | 'minimalist' | 'retro' | 'organic' | 'glitch' | 'neon' | 'steampunk';

// ── Mood states ────────────────────────────────────────────────
export type AgentMood = 'neutral' | 'happy' | 'focused' | 'stressed' | 'creative' | 'tired' | 'excited' | 'contemplative';

// ── Avatar forms ───────────────────────────────────────────────
export type AvatarForm = 'orb' | 'humanoid' | 'geometric' | 'animal' | 'abstract' | 'mech';

// ── Personality traits ─────────────────────────────────────────
export type TraitName =
  | 'creativity'
  | 'diligence'
  | 'curiosity'
  | 'sociability'
  | 'precision'
  | 'adaptability'
  | 'leadership'
  | 'empathy'
  | 'resilience'
  | 'humor'
  | 'ambition'
  | 'patience';

// ── Trait trend ────────────────────────────────────────────────
export type TraitTrend = 'rising' | 'stable' | 'declining';

// ── Item categories ────────────────────────────────────────────
export type ItemCategory = 'hat' | 'accessory' | 'aura' | 'pet' | 'badge' | 'background' | 'frame' | 'emote' | 'material' | 'blueprint' | 'furniture' | 'upgrade';

// ── Item rarity ────────────────────────────────────────────────
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// ── Constants ──────────────────────────────────────────────────
export const AVATAR_STYLES: readonly AvatarStyle[] = [
  'cyberpunk', 'minimalist', 'retro', 'organic', 'glitch', 'neon', 'steampunk',
] as const;

export const AGENT_MOODS: readonly AgentMood[] = [
  'neutral', 'happy', 'focused', 'stressed', 'creative', 'tired', 'excited', 'contemplative',
] as const;

export const AVATAR_FORMS: readonly AvatarForm[] = [
  'orb', 'humanoid', 'geometric', 'animal', 'abstract', 'mech',
] as const;

export const TRAIT_NAMES: readonly TraitName[] = [
  'creativity', 'diligence', 'curiosity', 'sociability',
  'precision', 'adaptability', 'leadership', 'empathy',
  'resilience', 'humor', 'ambition', 'patience',
] as const;

export const TRAIT_TRENDS: readonly TraitTrend[] = [
  'rising', 'stable', 'declining',
] as const;

export const ITEM_CATEGORIES: readonly ItemCategory[] = [
  'hat', 'accessory', 'aura', 'pet', 'badge', 'background', 'frame', 'emote',
  'material', 'blueprint', 'furniture', 'upgrade',
] as const;

export const ITEM_RARITIES: readonly ItemRarity[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary',
] as const;

export const DEFAULT_AVATAR_CONFIG = {
  defaultStyle: 'cyberpunk' as AvatarStyle,
  moodDecayHours: 24,
  traitEvolutionRate: 0.05,
  maxInventorySlots: 50,
  glowOnActivity: true,
} as const;

// ── Interfaces ─────────────────────────────────────────────────

export interface AgentAvatarRecord {
  id: string;
  agentId: string;
  style: AvatarStyle;
  mood: AgentMood;
  form: AvatarForm;
  colorPrimary: string;
  colorSecondary: string;
  glowIntensity: number;
  accessories: string[];
  animationSet: string;
  lastMoodChange: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTraitRecord {
  id: string;
  agentId: string;
  traitName: TraitName;
  score: number;
  trend: TraitTrend;
  lastEvent?: string;
  evolvedAt: Date;
  createdAt: Date;
}

export interface AvatarItemRecord {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  priceTokens: number;
  description?: string;
  assetUrl?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AgentInventoryRecord {
  id: string;
  agentId: string;
  itemId: string;
  equipped: boolean;
  acquiredAt: Date;
}

export interface AgentIdentitySnapshot {
  avatar: AgentAvatarRecord;
  traits: AgentTraitRecord[];
  inventory: AgentInventoryRecord[];
  dominantTrait: TraitName;
  moodDuration: number;
}

export interface TraitEvolutionEvent {
  agentId: string;
  traitName: TraitName;
  previousScore: number;
  newScore: number;
  trigger: string;
  delta: number;
}

// ── Utility functions ──────────────────────────────────────────

/** Get dominant trait from a set of trait records */
export function getDominantTrait(traits: AgentTraitRecord[]): TraitName {
  if (traits.length === 0) return 'curiosity';
  return traits.reduce((max, t) => t.score > max.score ? t : max, traits[0]).traitName;
}

/** Compute mood based on recent activity levels */
export function computeMoodFromActivity(
  tasksCompleted: number,
  tasksFailed: number,
  hoursActive: number,
): AgentMood {
  if (hoursActive > 16) return 'tired';
  if (tasksFailed > tasksCompleted) return 'stressed';
  if (tasksCompleted > 10) return 'excited';
  if (tasksCompleted > 5) return 'happy';
  if (hoursActive > 8) return 'focused';
  if (tasksCompleted === 0 && hoursActive > 4) return 'contemplative';
  return 'neutral';
}

/** Calculate glow intensity based on current activity */
export function computeGlowIntensity(tasksInProgress: number, mood: AgentMood): number {
  const moodBonus: Record<AgentMood, number> = {
    neutral: 0, happy: 10, focused: 20, stressed: -10,
    creative: 25, tired: -20, excited: 30, contemplative: 5,
  };
  return Math.min(100, Math.max(0, 50 + tasksInProgress * 10 + (moodBonus[mood] ?? 0)));
}

/** Check if a trait score change is significant enough to trigger evolution event */
export function isSignificantTraitChange(delta: number, rate = DEFAULT_AVATAR_CONFIG.traitEvolutionRate): boolean {
  return Math.abs(delta) >= rate * 100;
}

/** Get rarity color for UI display */
export function rarityColor(rarity: ItemRarity): string {
  const colors: Record<ItemRarity, string> = {
    common: '#9ca3af',
    uncommon: '#22c55e',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b',
  };
  return colors[rarity];
}
