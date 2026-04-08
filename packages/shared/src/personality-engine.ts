/**
 * Personality engine — configurable buddy personality and mood system.
 *
 * Manages mood states, personality traits, context-aware greetings,
 * milestone celebrations, and streak tracking. Drives the buddy's
 * tone, vocabulary, and behavioral style across all surfaces.
 *
 * Personality modes are org-configurable: professional, friendly,
 * casual, terse. Mood is derived from operational signals (error
 * rates, approval backlogs, streak length, time of day).
 *
 * Prior art: Clippy (1997), GitHub Copilot tone, Tamagotchi mood
 * system, RPG companion NPCs, Slack bot personality frameworks.
 */

import { createLogger } from './logger.js';

const log = createLogger('personality-engine');

// ── Types ─────────────────────────────────────────────────────────

export type MoodState =
  | 'idle'
  | 'thinking'
  | 'listening'
  | 'speaking'
  | 'happy'
  | 'concerned'
  | 'celebrating'
  | 'focused';

export type PersonalityMode =
  | 'professional'
  | 'friendly'
  | 'casual'
  | 'terse';

export interface PersonalityConfig {
  /** Personality mode. Default 'professional'. */
  mode: PersonalityMode;
  /** Whether streak tracking is enabled. Default true. */
  streakTracking: boolean;
  /** Whether milestone celebrations are enabled. Default true. */
  milestones: boolean;
  /** Greeting style. Default true. */
  contextGreetings: boolean;
}

export interface MoodSignals {
  /** Tool error rate (0-1) in last 24h. */
  errorRate: number;
  /** Number of pending approvals. */
  pendingApprovals: number;
  /** Consecutive active days. */
  streakDays: number;
  /** Total tool runs in last 24h. */
  toolRuns: number;
  /** Whether a milestone was just hit. */
  milestoneHit: boolean;
  /** Hour of day (0-23) in user timezone. */
  hourOfDay: number;
  /** Minutes since last user activity. */
  minutesSinceActivity: number;
}

export interface BuddyProfile {
  /** Display name for the buddy. */
  name: string;
  /** Current mood state. */
  mood: MoodState;
  /** Current XP points. */
  xp: number;
  /** Current level (derived from XP). */
  level: number;
  /** Current streak in days. */
  streakDays: number;
  /** Total tasks completed (lifetime). */
  tasksCompleted: number;
  /** Unlocked achievements. */
  achievements: Achievement[];
  /** Current personality mode. */
  personalityMode: PersonalityMode;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: Date;
}

export interface Milestone {
  type: 'streak' | 'tasks' | 'level' | 'first';
  value: number;
  message: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  totalActiveDays: number;
}

// ── Personality Trait Maps ────────────────────────────────────────

interface TraitSet {
  greetings: { morning: string[]; afternoon: string[]; evening: string[]; return: string[] };
  celebrations: string[];
  encouragements: string[];
  concerns: string[];
  signoffs: string[];
}

const TRAITS: Record<PersonalityMode, TraitSet> = {
  professional: {
    greetings: {
      morning: ['Good morning.', 'Morning — here\'s your update.'],
      afternoon: ['Good afternoon.', 'Afternoon check-in.'],
      evening: ['Good evening.', 'End-of-day summary.'],
      return: ['Welcome back.', 'Good to have you back.'],
    },
    celebrations: [
      'Milestone achieved.',
      'Notable progress reached.',
      'A significant threshold has been crossed.',
    ],
    encouragements: [
      'Steady progress.',
      'Operations running smoothly.',
      'All systems nominal.',
    ],
    concerns: [
      'Elevated error rate detected.',
      'Action items require attention.',
      'Some issues need review.',
    ],
    signoffs: [
      'Standing by.',
      'Ready when you are.',
    ],
  },
  friendly: {
    greetings: {
      morning: ['Good morning! ☀️', 'Hey, good morning! Ready for a great day?'],
      afternoon: ['Good afternoon! 👋', 'Hey there! How\'s the day going?'],
      evening: ['Good evening! 🌙', 'Hey! Wrapping up for the day?'],
      return: ['Welcome back! 😊', 'Great to see you again!'],
    },
    celebrations: [
      'Awesome work! 🎉',
      'That\'s a great milestone! 🎯',
      'Look at you go! 🚀',
    ],
    encouragements: [
      'Things are looking great!',
      'You\'re on a roll!',
      'Keep it up — solid progress!',
    ],
    concerns: [
      'Heads up — a few things need attention.',
      'I noticed some hiccups worth looking into.',
      'A couple of items could use your eyes.',
    ],
    signoffs: [
      'I\'m here if you need me!',
      'Just holler if you need anything!',
    ],
  },
  casual: {
    greetings: {
      morning: ['morning! ☕', 'yo, morning!'],
      afternoon: ['hey hey 👋', 'sup, afternoon check'],
      evening: ['evening! 🌙', 'hey, end of day vibes'],
      return: ['yo, welcome back!', 'oh hey, you\'re back!'],
    },
    celebrations: [
      'nice!! 🎉',
      'let\'s gooo 🚀',
      'absolute legend 🏆',
    ],
    encouragements: [
      'smooth sailing today',
      'all good on my end',
      'vibes are immaculate',
    ],
    concerns: [
      'yo just flagging a few things',
      'couple things acting up',
      'might wanna check on a few things',
    ],
    signoffs: [
      'hmu if you need anything',
      'i\'m around ✌️',
    ],
  },
  terse: {
    greetings: {
      morning: ['Morning.'],
      afternoon: ['Afternoon.'],
      evening: ['Evening.'],
      return: ['Back.'],
    },
    celebrations: ['Done.', 'Milestone.'],
    encouragements: ['OK.', 'Clear.'],
    concerns: ['Issues.', 'Check errors.'],
    signoffs: ['Ready.'],
  },
};

// ── XP & Level Constants ──────────────────────────────────────────

const XP_PER_TOOL_RUN = 1;
const XP_PER_APPROVAL_RESOLVED = 5;
const XP_PER_IMPROVEMENT_COMPLETED = 10;
const XP_PER_STREAK_DAY = 3;
const XP_PER_MILESTONE = 25;

function levelFromXp(xp: number): number {
  // Level = floor(sqrt(xp / 50)) + 1 — slow curve
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 50;
}

// ── Achievement Definitions ───────────────────────────────────────

const ACHIEVEMENT_DEFS: Array<{
  id: string;
  title: string;
  description: string;
  icon: string;
  check: (profile: { xp: number; streakDays: number; tasksCompleted: number; level: number }) => boolean;
}> = [
  { id: 'first_task', title: 'First Steps', description: 'Complete your first task', icon: '👶', check: (p) => p.tasksCompleted >= 1 },
  { id: 'streak_3', title: 'Getting Started', description: '3-day activity streak', icon: '🔥', check: (p) => p.streakDays >= 3 },
  { id: 'streak_7', title: 'Week Warrior', description: '7-day activity streak', icon: '⚡', check: (p) => p.streakDays >= 7 },
  { id: 'streak_30', title: 'Monthly Master', description: '30-day activity streak', icon: '🏆', check: (p) => p.streakDays >= 30 },
  { id: 'tasks_10', title: 'Getting Things Done', description: 'Complete 10 tasks', icon: '📋', check: (p) => p.tasksCompleted >= 10 },
  { id: 'tasks_100', title: 'Centurion', description: 'Complete 100 tasks', icon: '💯', check: (p) => p.tasksCompleted >= 100 },
  { id: 'tasks_1000', title: 'Task Legend', description: 'Complete 1000 tasks', icon: '🌟', check: (p) => p.tasksCompleted >= 1000 },
  { id: 'level_5', title: 'Apprentice', description: 'Reach level 5', icon: '🎓', check: (p) => p.level >= 5 },
  { id: 'level_10', title: 'Expert', description: 'Reach level 10', icon: '🧙', check: (p) => p.level >= 10 },
  { id: 'level_25', title: 'Grandmaster', description: 'Reach level 25', icon: '👑', check: (p) => p.level >= 25 },
];

// ── PersonalityEngine ─────────────────────────────────────────────

const DEFAULT_CONFIG: PersonalityConfig = {
  mode: 'professional',
  streakTracking: true,
  milestones: true,
  contextGreetings: true,
};

export class PersonalityEngine {
  private config: PersonalityConfig;
  private currentMood: MoodState = 'idle';
  private profile: BuddyProfile;

  constructor(config?: Partial<PersonalityConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.profile = {
      name: 'Sven',
      mood: 'idle',
      xp: 0,
      level: 1,
      streakDays: 0,
      tasksCompleted: 0,
      achievements: [],
      personalityMode: this.config.mode,
    };
  }

  static fromEnv(): PersonalityEngine {
    const mode = (process.env.BUDDY_PERSONALITY_MODE || 'professional') as PersonalityMode;
    const validModes: PersonalityMode[] = ['professional', 'friendly', 'casual', 'terse'];
    return new PersonalityEngine({
      mode: validModes.includes(mode) ? mode : 'professional',
      streakTracking: (process.env.BUDDY_STREAK_TRACKING || 'true').toLowerCase() === 'true',
      milestones: (process.env.BUDDY_MILESTONES || 'true').toLowerCase() === 'true',
      contextGreetings: (process.env.BUDDY_CONTEXT_GREETINGS || 'true').toLowerCase() === 'true',
    });
  }

  /**
   * Derive mood from operational signals.
   */
  deriveMood(signals: MoodSignals): MoodState {
    if (signals.milestoneHit) {
      this.currentMood = 'celebrating';
    } else if (signals.errorRate > 0.3) {
      this.currentMood = 'concerned';
    } else if (signals.pendingApprovals > 5) {
      this.currentMood = 'focused';
    } else if (signals.streakDays >= 7 && signals.errorRate < 0.05) {
      this.currentMood = 'happy';
    } else if (signals.minutesSinceActivity > 120) {
      this.currentMood = 'idle';
    } else {
      this.currentMood = 'listening';
    }

    this.profile.mood = this.currentMood;
    return this.currentMood;
  }

  /**
   * Get a context-appropriate greeting.
   */
  getGreeting(hourOfDay: number, isReturning: boolean): string {
    const traits = TRAITS[this.config.mode];
    if (!this.config.contextGreetings) return '';

    if (isReturning) {
      return this.pick(traits.greetings.return);
    }

    if (hourOfDay < 12) return this.pick(traits.greetings.morning);
    if (hourOfDay < 18) return this.pick(traits.greetings.afternoon);
    return this.pick(traits.greetings.evening);
  }

  /**
   * Get a mood-appropriate message fragment.
   */
  getMoodMessage(): string {
    const traits = TRAITS[this.config.mode];
    switch (this.currentMood) {
      case 'celebrating':
        return this.pick(traits.celebrations);
      case 'concerned':
        return this.pick(traits.concerns);
      case 'happy':
      case 'listening':
        return this.pick(traits.encouragements);
      default:
        return '';
    }
  }

  /**
   * Get a sign-off message.
   */
  getSignoff(): string {
    return this.pick(TRAITS[this.config.mode].signoffs);
  }

  /**
   * Award XP for actions. Returns newly unlocked achievements.
   */
  awardXp(reason: 'tool_run' | 'approval_resolved' | 'improvement_completed' | 'streak_day' | 'milestone', count = 1): Achievement[] {
    const xpMap = {
      tool_run: XP_PER_TOOL_RUN,
      approval_resolved: XP_PER_APPROVAL_RESOLVED,
      improvement_completed: XP_PER_IMPROVEMENT_COMPLETED,
      streak_day: XP_PER_STREAK_DAY,
      milestone: XP_PER_MILESTONE,
    };

    const gained = (xpMap[reason] ?? 1) * count;
    const prevLevel = this.profile.level;
    this.profile.xp += gained;
    this.profile.level = levelFromXp(this.profile.xp);

    if (reason === 'tool_run') this.profile.tasksCompleted += count;

    const newAchievements: Achievement[] = [];
    const unlockedIds = new Set(this.profile.achievements.map((a) => a.id));

    for (const def of ACHIEVEMENT_DEFS) {
      if (unlockedIds.has(def.id)) continue;
      if (def.check(this.profile)) {
        const achievement: Achievement = {
          id: def.id,
          title: def.title,
          description: def.description,
          icon: def.icon,
          unlockedAt: new Date(),
        };
        this.profile.achievements.push(achievement);
        newAchievements.push(achievement);
        log.info('Achievement unlocked', { id: def.id, title: def.title });
      }
    }

    if (this.profile.level > prevLevel) {
      log.info('Level up', { from: prevLevel, to: this.profile.level, xp: this.profile.xp });
    }

    return newAchievements;
  }

  /**
   * Update streak data. Returns true if streak was extended.
   */
  updateStreak(data: StreakData): boolean {
    if (!this.config.streakTracking) return false;

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    this.profile.streakDays = data.currentStreak;

    if (data.lastActiveDate === yesterday || data.lastActiveDate === today) {
      // Streak is active
      return data.lastActiveDate === yesterday; // extended today
    }

    return false;
  }

  /**
   * Check for milestones. Returns any that were hit.
   */
  checkMilestones(toolRuns: number, tasksCompleted: number): Milestone[] {
    if (!this.config.milestones) return [];

    const milestones: Milestone[] = [];
    const traits = TRAITS[this.config.mode];

    // Streak milestones
    const streakThresholds = [3, 7, 14, 30, 60, 100];
    for (const threshold of streakThresholds) {
      if (this.profile.streakDays === threshold) {
        milestones.push({
          type: 'streak',
          value: threshold,
          message: `${threshold}-day streak! ${this.pick(traits.celebrations)}`,
        });
      }
    }

    // Task milestones
    const taskThresholds = [1, 10, 50, 100, 500, 1000, 5000];
    for (const threshold of taskThresholds) {
      if (tasksCompleted === threshold) {
        milestones.push({
          type: 'tasks',
          value: threshold,
          message: `${threshold} tasks completed! ${this.pick(traits.celebrations)}`,
        });
      }
    }

    return milestones;
  }

  /**
   * Get the full buddy profile snapshot.
   */
  getProfile(): BuddyProfile {
    return { ...this.profile };
  }

  /**
   * Get XP progress toward next level.
   */
  getLevelProgress(): { current: number; next: number; progress: number } {
    const current = xpForLevel(this.profile.level);
    const next = xpForLevel(this.profile.level + 1);
    const progress = next > current ? (this.profile.xp - current) / (next - current) : 1;
    return { current, next, progress: Math.min(1, Math.max(0, progress)) };
  }

  /**
   * Set profile from persisted state (DB load).
   */
  loadProfile(data: Partial<BuddyProfile>): void {
    if (data.xp !== undefined) this.profile.xp = data.xp;
    if (data.level !== undefined) this.profile.level = data.level;
    if (data.streakDays !== undefined) this.profile.streakDays = data.streakDays;
    if (data.tasksCompleted !== undefined) this.profile.tasksCompleted = data.tasksCompleted;
    if (data.achievements) this.profile.achievements = data.achievements;
    if (data.name) this.profile.name = data.name;
    // Recalculate level from XP for consistency
    this.profile.level = levelFromXp(this.profile.xp);
  }

  /**
   * Get serializable profile for persistence.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.profile.name,
      xp: this.profile.xp,
      level: this.profile.level,
      streakDays: this.profile.streakDays,
      tasksCompleted: this.profile.tasksCompleted,
      achievements: this.profile.achievements,
      personalityMode: this.config.mode,
    };
  }

  /**
   * Get current mood.
   */
  get mood(): MoodState {
    return this.currentMood;
  }

  /**
   * Get current personality mode.
   */
  get mode(): PersonalityMode {
    return this.config.mode;
  }

  private pick(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
