/**
 * Visual companion types — data contracts for rendering the buddy
 * avatar across frontend surfaces (Tauri desktop, Flutter mobile,
 * admin-ui web).
 *
 * These types define the companion's visual profile, animation
 * states, accessory slots, and XP/level display data. Frontend
 * apps consume these via the gateway-api WebSocket or REST.
 *
 * The companion is a gamification layer on top of the buddy system.
 * It gives visual feedback for mood, level, achievements, and
 * streaks, creating an emotional bond between user and agent.
 */

// ── Species & Appearance ──────────────────────────────────────────

export type CompanionSpecies =
  | 'fox'
  | 'owl'
  | 'cat'
  | 'robot'
  | 'ghost'
  | 'custom';

export type CompanionAnimationState =
  | 'idle'
  | 'thinking'
  | 'talking'
  | 'celebrating'
  | 'sleeping'
  | 'waving'
  | 'error'
  | 'focused'
  | 'happy'
  | 'concerned';

export interface CompanionAppearance {
  /** Selected species. */
  species: CompanionSpecies;
  /** Primary color (hex). */
  primaryColor: string;
  /** Accent color (hex). */
  accentColor: string;
  /** Current animation state. */
  animationState: CompanionAnimationState;
  /** Custom avatar URL (only for 'custom' species). */
  customAvatarUrl?: string;
}

// ── Accessory System ──────────────────────────────────────────────

export type AccessorySlot =
  | 'hat'
  | 'glasses'
  | 'badge'
  | 'background'
  | 'trail';

export interface Accessory {
  /** Unique identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Slot this accessory fits into. */
  slot: AccessorySlot;
  /** Asset URL or bundled asset key. */
  assetKey: string;
  /** How this accessory was obtained. */
  source: 'achievement' | 'level' | 'streak' | 'purchase' | 'gift';
  /** Minimum level required to equip (0 = no requirement). */
  minLevel: number;
  /** Whether this accessory is currently equipped. */
  equipped: boolean;
}

// ── XP & Level Display ───────────────────────────────────────────

export interface XpDisplayData {
  /** Current total XP. */
  currentXp: number;
  /** Current level. */
  level: number;
  /** XP required for current level. */
  currentLevelXp: number;
  /** XP required for next level. */
  nextLevelXp: number;
  /** Progress toward next level (0-1). */
  progress: number;
  /** XP gained in current session. */
  sessionXp: number;
}

// ── Achievement Display ──────────────────────────────────────────

export interface AchievementDisplay {
  /** Achievement identifier. */
  id: string;
  /** Display title. */
  title: string;
  /** Description of how to earn. */
  description: string;
  /** Emoji or icon key. */
  icon: string;
  /** Whether unlocked. */
  unlocked: boolean;
  /** When unlocked (ISO string), null if locked. */
  unlockedAt: string | null;
  /** Progress toward unlocking (0-1), null if binary. */
  progress: number | null;
  /** Accessory reward ID, if any. */
  rewardAccessoryId?: string;
}

// ── Streak Display ───────────────────────────────────────────────

export interface StreakDisplay {
  /** Current consecutive active days. */
  currentStreak: number;
  /** Longest streak ever. */
  longestStreak: number;
  /** Total active days (lifetime). */
  totalActiveDays: number;
  /** Whether the streak is active today. */
  activeToday: boolean;
  /** Days until streak breaks (0 = must be active today). */
  daysUntilBreak: number;
  /** Last 7 days activity (newest first, true = active). */
  weekHistory: boolean[];
}

// ── Full Companion Profile (API Response) ────────────────────────

export interface CompanionProfile {
  /** Companion display name. */
  name: string;
  /** Visual appearance config. */
  appearance: CompanionAppearance;
  /** XP and level display data. */
  xp: XpDisplayData;
  /** Streak tracking data. */
  streak: StreakDisplay;
  /** All achievements with unlock status. */
  achievements: AchievementDisplay[];
  /** All accessories (equipped and unequipped). */
  accessories: Accessory[];
  /** Currently equipped accessories, mapped by slot. */
  equippedAccessories: Partial<Record<AccessorySlot, string>>;
  /** Tasks completed (lifetime). */
  tasksCompleted: number;
  /** Messages exchanged (lifetime). */
  messagesExchanged: number;
}

// ── Companion Events (WebSocket) ─────────────────────────────────

export type CompanionEventType =
  | 'mood_change'
  | 'xp_gained'
  | 'level_up'
  | 'achievement_unlocked'
  | 'streak_updated'
  | 'accessory_unlocked'
  | 'animation_trigger';

export interface CompanionEvent {
  type: CompanionEventType;
  timestamp: string;
  data: CompanionMoodChangeEvent
    | CompanionXpGainedEvent
    | CompanionLevelUpEvent
    | CompanionAchievementEvent
    | CompanionStreakEvent
    | CompanionAccessoryEvent
    | CompanionAnimationEvent;
}

export interface CompanionMoodChangeEvent {
  previousMood: CompanionAnimationState;
  newMood: CompanionAnimationState;
  reason: string;
}

export interface CompanionXpGainedEvent {
  amount: number;
  reason: string;
  newTotal: number;
  levelProgress: number;
}

export interface CompanionLevelUpEvent {
  previousLevel: number;
  newLevel: number;
  totalXp: number;
  unlockedRewards: string[];
}

export interface CompanionAchievementEvent {
  achievement: AchievementDisplay;
  rewardAccessory?: Accessory;
}

export interface CompanionStreakEvent {
  previousStreak: number;
  newStreak: number;
  isNewRecord: boolean;
}

export interface CompanionAccessoryEvent {
  accessory: Accessory;
  source: 'achievement' | 'level' | 'streak' | 'purchase' | 'gift';
}

export interface CompanionAnimationEvent {
  animation: CompanionAnimationState;
  durationMs: number;
  reason: string;
}

// ── Companion Settings (User Preferences) ────────────────────────

export interface CompanionSettings {
  /** Whether the companion is visible. */
  enabled: boolean;
  /** Selected species. */
  species: CompanionSpecies;
  /** Primary color (hex). */
  primaryColor: string;
  /** Accent color (hex). */
  accentColor: string;
  /** Whether to show XP notifications. */
  showXpNotifications: boolean;
  /** Whether to show achievement popups. */
  showAchievements: boolean;
  /** Whether to show streak reminders. */
  showStreakReminders: boolean;
  /** Animation speed multiplier (0.5 = slow, 1 = normal, 2 = fast). */
  animationSpeed: number;
  /** Whether to respect prefers-reduced-motion. */
  respectReducedMotion: boolean;
  /** Custom avatar URL (only for 'custom' species). */
  customAvatarUrl?: string;
}

/**
 * Default companion settings for new users.
 */
export const DEFAULT_COMPANION_SETTINGS: CompanionSettings = {
  enabled: true,
  species: 'fox',
  primaryColor: '#FF6B35',
  accentColor: '#004E89',
  showXpNotifications: true,
  showAchievements: true,
  showStreakReminders: true,
  animationSpeed: 1,
  respectReducedMotion: true,
};
