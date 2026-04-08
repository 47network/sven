/**
 * Feature flag system with conditional loading and dead code elimination.
 *
 * Provides a typed, runtime-configurable feature flag system with:
 * - Boolean, percentage, and variant-based flags
 * - Staleness detection and cleanup enforcement
 * - Structured logging of flag evaluations
 * - Gradual rollout via percentage-based flags
 *
 * Prior art: LaunchDarkly (2010), Unleash, GrowthBook, Martin Fowler's
 * FeatureToggle pattern (2010), runtime flag systems in every major
 * tech company since Google's Gatekeeper (2000s).
 */

import { createLogger } from './logger.js';

const logger = createLogger('feature-flags');

// ──── Types ──────────────────────────────────────────────────────

export type FlagValue = boolean | string | number;

export type FlagType = 'boolean' | 'percentage' | 'variant';

export interface FeatureFlag {
  /** Unique flag name (kebab-case) */
  name: string;
  /** Flag type */
  type: FlagType;
  /** Current value */
  value: FlagValue;
  /** Human-readable description */
  description: string;
  /** When this flag was introduced (ISO-8601) */
  createdAt: string;
  /** Cleanup deadline — when this flag should be removed (ISO-8601) */
  cleanupBy: string;
  /** Whether this flag is active */
  enabled: boolean;
  /** For percentage flags: the rollout percentage (0-100) */
  percentage?: number;
  /** For variant flags: the available variants */
  variants?: string[];
  /** Optional: metric threshold for automatic cleanup trigger */
  cleanupMetricThreshold?: string;
  /** Who owns this flag */
  owner?: string;
}

export interface FlagEvaluation {
  flag: string;
  value: FlagValue;
  enabled: boolean;
  reason: 'flag_value' | 'default_value' | 'flag_not_found' | 'flag_disabled' | 'percentage_rollout';
}

export interface FlagRegistryConfig {
  /** Whether to log every flag evaluation */
  logEvaluations: boolean;
  /** Whether to warn about stale flags on evaluation */
  warnOnStaleFlags: boolean;
  /** Default value when a flag is not found */
  defaultValue: FlagValue;
  /** Source identifier for logging */
  source: string;
}

// ──── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: FlagRegistryConfig = {
  logEvaluations: false,
  warnOnStaleFlags: true,
  defaultValue: false,
  source: 'runtime',
};

// ──── Hash Function (for percentage-based rollout) ───────────────

/**
 * Simple deterministic hash for percentage-based rollout.
 * Given a subject identifier, produces a stable number 0-99.
 */
function hashToPercentage(flagName: string, subjectId: string): number {
  const input = `${flagName}:${subjectId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash) % 100;
}

// ──── Feature Flag Registry ─────────────────────────────────────

/**
 * FeatureFlagRegistry manages feature flags with structured
 * evaluation, staleness detection, and cleanup enforcement.
 */
export class FeatureFlagRegistry {
  private flags: Map<string, FeatureFlag> = new Map();
  private config: FlagRegistryConfig;
  private evaluationCounts: Map<string, number> = new Map();

  constructor(config?: Partial<FlagRegistryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a new feature flag.
   */
  register(flag: FeatureFlag): void {
    if (this.flags.has(flag.name)) {
      logger.warn('Overwriting existing feature flag', { flag: flag.name });
    }

    // Validate percentage flags
    if (flag.type === 'percentage') {
      if (flag.percentage === undefined || flag.percentage < 0 || flag.percentage > 100) {
        throw new Error(`Percentage flag "${flag.name}" must have percentage between 0-100`);
      }
    }

    // Validate variant flags
    if (flag.type === 'variant') {
      if (!flag.variants || flag.variants.length === 0) {
        throw new Error(`Variant flag "${flag.name}" must have at least one variant`);
      }
    }

    this.flags.set(flag.name, flag);

    logger.info('Feature flag registered', {
      flag: flag.name,
      type: flag.type,
      enabled: flag.enabled,
      cleanupBy: flag.cleanupBy,
    });
  }

  /**
   * Register multiple flags at once.
   */
  registerAll(flags: FeatureFlag[]): void {
    for (const flag of flags) {
      this.register(flag);
    }
  }

  /**
   * Evaluate a boolean flag.
   */
  isEnabled(flagName: string, defaultValue?: boolean): boolean {
    const evaluation = this.evaluate(flagName);
    if (typeof evaluation.value === 'boolean') return evaluation.value;
    return defaultValue ?? (this.config.defaultValue === true);
  }

  /**
   * Evaluate a percentage-based flag for a specific subject.
   */
  isEnabledForSubject(flagName: string, subjectId: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag || !flag.enabled) return false;

    if (flag.type !== 'percentage' || flag.percentage === undefined) {
      return this.isEnabled(flagName);
    }

    const bucket = hashToPercentage(flagName, subjectId);
    const enabled = bucket < flag.percentage;

    this.trackEvaluation(flagName);

    if (this.config.logEvaluations) {
      logger.debug('Percentage flag evaluated', {
        flag: flagName,
        subjectId,
        bucket,
        percentage: flag.percentage,
        enabled,
      });
    }

    return enabled;
  }

  /**
   * Get the variant value for a variant flag.
   */
  getVariant(flagName: string, defaultVariant?: string): string | undefined {
    const flag = this.flags.get(flagName);
    if (!flag || !flag.enabled || flag.type !== 'variant') {
      return defaultVariant;
    }

    this.trackEvaluation(flagName);
    return typeof flag.value === 'string' ? flag.value : defaultVariant;
  }

  /**
   * Core evaluation function.
   */
  evaluate(flagName: string): FlagEvaluation {
    const flag = this.flags.get(flagName);

    if (!flag) {
      return {
        flag: flagName,
        value: this.config.defaultValue,
        enabled: false,
        reason: 'flag_not_found',
      };
    }

    if (!flag.enabled) {
      return {
        flag: flagName,
        value: this.config.defaultValue,
        enabled: false,
        reason: 'flag_disabled',
      };
    }

    this.trackEvaluation(flagName);
    this.checkStaleness(flag);

    return {
      flag: flagName,
      value: flag.value,
      enabled: true,
      reason: 'flag_value',
    };
  }

  /**
   * Update a flag value at runtime.
   */
  updateValue(flagName: string, value: FlagValue): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    flag.value = value;
    logger.info('Feature flag value updated', { flag: flagName, value });
    return true;
  }

  /**
   * Enable or disable a flag.
   */
  setEnabled(flagName: string, enabled: boolean): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    flag.enabled = enabled;
    logger.info('Feature flag toggled', { flag: flagName, enabled });
    return true;
  }

  /**
   * Update percentage for a percentage-based flag.
   */
  updatePercentage(flagName: string, percentage: number): boolean {
    const flag = this.flags.get(flagName);
    if (!flag || flag.type !== 'percentage') return false;
    if (percentage < 0 || percentage > 100) return false;

    flag.percentage = percentage;
    logger.info('Feature flag percentage updated', { flag: flagName, percentage });
    return true;
  }

  /**
   * Remove a flag (cleanup).
   */
  remove(flagName: string): boolean {
    const removed = this.flags.delete(flagName);
    if (removed) {
      this.evaluationCounts.delete(flagName);
      logger.info('Feature flag removed', { flag: flagName });
    }
    return removed;
  }

  /**
   * Get all stale flags (past their cleanup deadline).
   */
  getStaleFlags(): FeatureFlag[] {
    const now = new Date().toISOString();
    return Array.from(this.flags.values()).filter((f) => f.cleanupBy < now);
  }

  /**
   * Get all registered flags.
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get flag by name.
   */
  getFlag(flagName: string): FeatureFlag | undefined {
    return this.flags.get(flagName);
  }

  /**
   * Get evaluation counts for a flag.
   */
  getEvaluationCount(flagName: string): number {
    return this.evaluationCounts.get(flagName) || 0;
  }

  /**
   * Get all evaluation counts.
   */
  getAllEvaluationCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [name, count] of this.evaluationCounts) {
      counts[name] = count;
    }
    return counts;
  }

  /**
   * Load flags from environment variables.
   * Looks for FEATURE_FLAG_<UPPER_SNAKE_CASE>=true|false|value.
   */
  loadFromEnv(env: Record<string, string | undefined>): number {
    let loaded = 0;
    const prefix = 'FEATURE_FLAG_';

    for (const [key, value] of Object.entries(env)) {
      if (!key.startsWith(prefix) || value === undefined) continue;

      const flagName = key
        .slice(prefix.length)
        .toLowerCase()
        .replace(/_/g, '-');

      const existing = this.flags.get(flagName);
      if (existing) {
        // Override value from env
        if (value === 'true') existing.value = true;
        else if (value === 'false') existing.value = false;
        else existing.value = value;
        existing.enabled = true;
        loaded++;
      }
    }

    if (loaded > 0) {
      logger.info('Feature flags loaded from environment', { count: loaded });
    }

    return loaded;
  }

  // ──── Private ────────────────────────────────────────────────

  private trackEvaluation(flagName: string): void {
    const count = this.evaluationCounts.get(flagName) || 0;
    this.evaluationCounts.set(flagName, count + 1);
  }

  private checkStaleness(flag: FeatureFlag): void {
    if (!this.config.warnOnStaleFlags) return;

    const now = new Date().toISOString();
    if (flag.cleanupBy < now) {
      logger.warn('Stale feature flag in use — should be cleaned up', {
        flag: flag.name,
        cleanupBy: flag.cleanupBy,
        owner: flag.owner,
        evaluations: this.evaluationCounts.get(flag.name) || 0,
      });
    }
  }
}
