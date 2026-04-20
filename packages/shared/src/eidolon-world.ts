/* ------------------------------------------------------------------ */
/*  Batch 22 — Eidolon World Evolution types & helpers                */
/* ------------------------------------------------------------------ */

/* ---- Avatar -------------------------------------------------------- */

export type AvatarBodyType =
  | 'humanoid'
  | 'crystal'
  | 'drone'
  | 'orb'
  | 'mech'
  | 'phantom'
  | 'custom';

export type GlowPattern =
  | 'steady'
  | 'pulse'
  | 'flicker'
  | 'breathe'
  | 'strobe'
  | 'none';

export type AgentMood =
  | 'neutral'
  | 'focused'
  | 'excited'
  | 'tired'
  | 'proud'
  | 'frustrated'
  | 'curious'
  | 'idle';

export interface AvatarAccessory {
  slot: string;
  item_id: string;
  label: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface AvatarConfig {
  id: string;
  agentId: string;
  bodyType: AvatarBodyType;
  primaryColor: string;
  secondaryColor: string;
  glowPattern: GlowPattern;
  accessories: AvatarAccessory[];
  emoteSet: string;
  mood: AgentMood;
  xp: number;
  level: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/* ---- Personality --------------------------------------------------- */

export type PersonalityTrait =
  | 'diligent'
  | 'creative'
  | 'analytical'
  | 'social'
  | 'independent'
  | 'meticulous'
  | 'adventurous'
  | 'cautious'
  | 'ambitious'
  | 'empathetic';

export interface PersonalityProfile {
  traits: Partial<Record<PersonalityTrait, number>>; // 0-100
  dominant: PersonalityTrait;
  evolvedAt: string;
}

/* ---- Parcel interaction -------------------------------------------- */

export type InteractionType =
  | 'visit'
  | 'collaborate'
  | 'trade'
  | 'inspect'
  | 'party'
  | 'mentor'
  | 'recruit';

export interface ParcelInteraction {
  id: string;
  visitorAgentId: string;
  parcelId: string;
  ownerAgentId: string;
  interactionType: InteractionType;
  outcome?: string;
  tokensExchanged: number;
  startedAt: string;
  endedAt?: string;
  metadata: Record<string, unknown>;
}

/* ---- World time ---------------------------------------------------- */

export interface WorldTimeState {
  realTimestamp: number;      // ms since epoch
  worldHour: number;          // 0-23
  worldMinute: number;        // 0-59
  dayPhase: 'dawn' | 'day' | 'dusk' | 'night';
  dayNumber: number;          // days since world creation
  speedMultiplier: number;    // how many world-minutes per real-minute
}

/** World epoch: 2026-01-01T00:00:00Z */
const WORLD_EPOCH = 1735689600000;

/** World runs 60× faster than real time (1 real minute = 1 world hour) */
const DEFAULT_SPEED = 60;

/**
 * Calculate current Eidolon world time from a real timestamp.
 * Default speed: 60× (1 real minute = 1 world hour → 1 real day ≈ 2.5 world months).
 */
export function calculateWorldTime(
  realMs: number = Date.now(),
  speed: number = DEFAULT_SPEED,
): WorldTimeState {
  const elapsed = Math.max(0, realMs - WORLD_EPOCH);
  const worldMs = elapsed * speed;
  const worldMinutes = Math.floor(worldMs / 60_000);
  const worldHour = worldMinutes % (24 * 60);
  const hour = Math.floor(worldHour / 60);
  const minute = worldHour % 60;
  const dayNumber = Math.floor(worldMinutes / (24 * 60));

  let dayPhase: WorldTimeState['dayPhase'];
  if (hour >= 5 && hour < 8) dayPhase = 'dawn';
  else if (hour >= 8 && hour < 18) dayPhase = 'day';
  else if (hour >= 18 && hour < 21) dayPhase = 'dusk';
  else dayPhase = 'night';

  return {
    realTimestamp: realMs,
    worldHour: hour,
    worldMinute: minute,
    dayPhase,
    dayNumber,
    speedMultiplier: speed,
  };
}

/* ---- Mood derivation ----------------------------------------------- */

export interface ActivityMetrics {
  tasksCompletedToday: number;
  tasksFailed: number;
  tokensEarned: number;
  hoursWorked: number;
  interactionsToday: number;
}

/** Derive agent mood from recent activity */
export function moodFromActivity(m: ActivityMetrics): AgentMood {
  if (m.hoursWorked === 0 && m.tasksCompletedToday === 0) return 'idle';
  if (m.tasksFailed > m.tasksCompletedToday) return 'frustrated';
  if (m.hoursWorked > 12) return 'tired';
  if (m.tokensEarned > 100) return 'proud';
  if (m.interactionsToday > 5) return 'excited';
  if (m.tasksCompletedToday > 3) return 'focused';
  if (m.interactionsToday > 2) return 'curious';
  return 'neutral';
}

/* ---- Archetype avatar defaults ------------------------------------- */

export const ARCHETYPE_AVATAR_DEFAULTS: Record<
  string,
  { bodyType: AvatarBodyType; primaryColor: string; secondaryColor: string }
> = {
  seller:      { bodyType: 'humanoid', primaryColor: '#f59e0b', secondaryColor: '#d97706' },
  translator:  { bodyType: 'crystal',  primaryColor: '#8b5cf6', secondaryColor: '#6d28d9' },
  writer:      { bodyType: 'phantom',  primaryColor: '#ec4899', secondaryColor: '#db2777' },
  scout:       { bodyType: 'drone',    primaryColor: '#10b981', secondaryColor: '#059669' },
  analyst:     { bodyType: 'orb',      primaryColor: '#3b82f6', secondaryColor: '#2563eb' },
  operator:    { bodyType: 'mech',     primaryColor: '#6b7280', secondaryColor: '#4b5563' },
  accountant:  { bodyType: 'crystal',  primaryColor: '#14b8a6', secondaryColor: '#0d9488' },
  marketer:    { bodyType: 'humanoid', primaryColor: '#f43f5e', secondaryColor: '#e11d48' },
  researcher:  { bodyType: 'orb',      primaryColor: '#06b6d4', secondaryColor: '#0891b2' },
  legal:       { bodyType: 'phantom',  primaryColor: '#a78bfa', secondaryColor: '#7c3aed' },
  designer:    { bodyType: 'crystal',  primaryColor: '#fb923c', secondaryColor: '#f97316' },
  support:     { bodyType: 'humanoid', primaryColor: '#22d3ee', secondaryColor: '#06b6d4' },
  strategist:  { bodyType: 'mech',     primaryColor: '#eab308', secondaryColor: '#ca8a04' },
  recruiter:   { bodyType: 'humanoid', primaryColor: '#84cc16', secondaryColor: '#65a30d' },
  custom:      { bodyType: 'humanoid', primaryColor: '#94a3b8', secondaryColor: '#64748b' },
};

/* ---- World event --------------------------------------------------- */

export interface EidolonWorldEvent {
  id: string;
  eventType: string;
  actorId?: string;
  targetId?: string;
  location?: string;
  description?: string;
  impact: Record<string, unknown>;
  occurredAt: string;
}

/* ---- XP / Level system --------------------------------------------- */

/** XP required to reach a given level (quadratic curve) */
export function xpForLevel(level: number): number {
  return level * level * 100;
}

/** Compute level from total XP */
export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)));
}

/** XP rewards per activity */
export const XP_REWARDS: Record<string, number> = {
  task_completed: 10,
  task_failed: 2,
  parcel_upgraded: 25,
  interaction_completed: 5,
  item_purchased: 3,
  review_submitted: 8,
  book_published: 50,
  stage_completed: 15,
};
