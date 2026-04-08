/**
 * Hierarchical permission evaluation system.
 *
 * Implements multi-tier permission resolution with configurable
 * rule sources and three-valued decisions (allow / deny / abstain).
 * Higher tiers override lower ones: system > org > workspace > user > adapter.
 *
 * Prior art: RBAC (1992), ABAC, Unix file permissions (1970s),
 * AWS IAM policy evaluation, Kubernetes RBAC, Apache Shiro.
 */

import { createLogger } from './logger.js';

const logger = createLogger('permission-hierarchy');

// ──── Types ──────────────────────────────────────────────────────

export type PermissionDecision = 'allow' | 'deny' | 'abstain';

export type PermissionTier = 'system' | 'organization' | 'workspace' | 'user' | 'adapter';

/** Priority order — lower index = higher priority */
const TIER_PRIORITY: PermissionTier[] = ['system', 'organization', 'workspace', 'user', 'adapter'];

export interface PermissionRule {
  /** Unique rule identifier */
  ruleId: string;
  /** Which tier this rule belongs to */
  tier: PermissionTier;
  /** Resource being accessed (supports glob patterns: tool.*, file.read) */
  resource: string;
  /** The action (invoke, read, write, delete, admin) */
  action: string;
  /** The decision */
  effect: PermissionDecision;
  /** Optional condition for ABAC-style checks */
  condition?: PermissionCondition;
  /** Priority within the same tier (higher number wins) */
  priority: number;
  /** Whether this rule is currently active */
  enabled: boolean;
  /** Human-readable description */
  description?: string;
}

export interface PermissionCondition {
  /** Field in the context to check */
  field: string;
  /** Comparison operator */
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'lt' | 'gte' | 'lte' | 'matches';
  /** Value(s) to compare against */
  value: unknown;
}

export interface PermissionContext {
  /** User or agent identity */
  subjectId: string;
  /** Role of the subject */
  role?: string;
  /** Resource being accessed */
  resource: string;
  /** Action being attempted */
  action: string;
  /** Adapter / channel origin */
  adapterId?: string;
  /** Workspace scope */
  workspaceId?: string;
  /** Organization scope */
  organizationId?: string;
  /** Additional context fields for ABAC-style conditions */
  attributes?: Record<string, unknown>;
}

export interface PermissionEvaluation {
  /** Final decision */
  decision: PermissionDecision;
  /** Which rule produced the final decision */
  decidingRule: PermissionRule | null;
  /** Which tier made the decision */
  decidingTier: PermissionTier | null;
  /** All rules that were evaluated */
  evaluatedRules: Array<{
    rule: PermissionRule;
    matched: boolean;
    decision: PermissionDecision;
  }>;
  /** Total evaluation time in microseconds */
  evaluationTimeUs: number;
}

// ──── Condition Evaluator ────────────────────────────────────────

/**
 * Evaluate a single ABAC-style condition against a context.
 */
function evaluateCondition(
  condition: PermissionCondition,
  context: PermissionContext,
): boolean {
  const attrs = context.attributes || {};
  const fieldValue = attrs[condition.field] ?? (context as unknown as Record<string, unknown>)[condition.field];

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
    case 'gt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value;
    case 'lt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value;
    case 'gte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue >= condition.value;
    case 'lte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue <= condition.value;
    case 'matches':
      if (typeof fieldValue !== 'string' || typeof condition.value !== 'string') return false;
      try {
        return new RegExp(condition.value).test(fieldValue);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

// ──── Resource Matching ──────────────────────────────────────────

/**
 * Match a resource pattern against a concrete resource.
 * Supports:
 * - Exact match: "tool.web_search"
 * - Wildcard suffix: "tool.*"
 * - Double wildcard: "**" (matches everything)
 * - Segment wildcard: "file.*.read"
 */
function matchesResource(pattern: string, resource: string): boolean {
  if (pattern === '**' || pattern === '*') return true;
  if (pattern === resource) return true;

  // Convert glob pattern to regex
  const regexStr = pattern
    .split('.')
    .map((segment) => {
      if (segment === '**') return '.*';
      if (segment === '*') return '[^.]+';
      return escapeRegex(segment);
    })
    .join('\\.');

  try {
    return new RegExp('^' + regexStr + '$').test(resource);
  } catch {
    return false;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ──── Permission Engine ──────────────────────────────────────────

/**
 * HierarchicalPermissionEngine evaluates permission rules across
 * multiple tiers. Higher tiers take precedence over lower ones.
 * Within a tier, higher-priority rules win. If no rule matches,
 * the default decision applies.
 */
export class HierarchicalPermissionEngine {
  private rules: PermissionRule[] = [];
  private defaultDecision: PermissionDecision;

  constructor(defaultDecision: PermissionDecision = 'deny') {
    this.defaultDecision = defaultDecision;
  }

  /**
   * Add a permission rule.
   */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  /**
   * Add multiple rules at once.
   */
  addRules(rules: PermissionRule[]): void {
    this.rules.push(...rules);
  }

  /**
   * Remove a rule by ID.
   */
  removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex((r) => r.ruleId === ruleId);
    if (idx === -1) return false;
    this.rules.splice(idx, 1);
    return true;
  }

  /**
   * Clear all rules.
   */
  clearRules(): void {
    this.rules = [];
  }

  /**
   * Evaluate a permission request against all loaded rules.
   *
   * Evaluation order:
   * 1. Filter rules by resource + action match
   * 2. Evaluate conditions
   * 3. Group by tier
   * 4. Within each tier, highest-priority rule wins
   * 5. Across tiers, highest-tier (system > org > ...) non-abstain wins
   * 6. If all abstain, use defaultDecision
   */
  evaluate(context: PermissionContext): PermissionEvaluation {
    const startTime = performance.now();
    const evaluated: PermissionEvaluation['evaluatedRules'] = [];
    let decidingRule: PermissionRule | null = null;
    let decidingTier: PermissionTier | null = null;
    let finalDecision: PermissionDecision = 'abstain';

    // Group active rules by tier
    const rulesByTier = new Map<PermissionTier, PermissionRule[]>();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const resourceMatch = matchesResource(rule.resource, context.resource);
      const actionMatch = rule.action === '*' || rule.action === context.action;

      if (!resourceMatch || !actionMatch) {
        evaluated.push({ rule, matched: false, decision: 'abstain' });
        continue;
      }

      // Evaluate conditions if present
      if (rule.condition) {
        const conditionMet = evaluateCondition(rule.condition, context);
        if (!conditionMet) {
          evaluated.push({ rule, matched: false, decision: 'abstain' });
          continue;
        }
      }

      evaluated.push({ rule, matched: true, decision: rule.effect });

      const tierRules = rulesByTier.get(rule.tier) || [];
      tierRules.push(rule);
      rulesByTier.set(rule.tier, tierRules);
    }

    // Evaluate tiers in priority order
    for (const tier of TIER_PRIORITY) {
      const tierRules = rulesByTier.get(tier);
      if (!tierRules || tierRules.length === 0) continue;

      // Within a tier, sort by priority descending
      tierRules.sort((a, b) => b.priority - a.priority);

      // Explicit deny in any tier always wins within that tier
      const denyRule = tierRules.find((r) => r.effect === 'deny');
      if (denyRule) {
        finalDecision = 'deny';
        decidingRule = denyRule;
        decidingTier = tier;
        break; // Deny from highest tier is final
      }

      const allowRule = tierRules.find((r) => r.effect === 'allow');
      if (allowRule) {
        finalDecision = 'allow';
        decidingRule = allowRule;
        decidingTier = tier;
        break; // Allow from highest tier is final unless overridden by deny in same tier
      }
    }

    // If all abstained, use default
    if (finalDecision === 'abstain') {
      finalDecision = this.defaultDecision;
    }

    const evaluationTimeUs = Math.round((performance.now() - startTime) * 1000);

    logger.debug('Permission evaluated', {
      resource: context.resource,
      action: context.action,
      subjectId: context.subjectId,
      decision: finalDecision,
      decidingTier,
      evaluationTimeUs,
    });

    return {
      decision: finalDecision,
      decidingRule,
      decidingTier,
      evaluatedRules: evaluated,
      evaluationTimeUs,
    };
  }

  /**
   * Convenience check — returns true if allowed.
   */
  isAllowed(context: PermissionContext): boolean {
    return this.evaluate(context).decision === 'allow';
  }

  /**
   * Get all rules for a specific tier.
   */
  getRules(tier?: PermissionTier): PermissionRule[] {
    if (tier) return this.rules.filter((r) => r.tier === tier);
    return [...this.rules];
  }

  /**
   * Get rule count by tier.
   */
  getRuleCounts(): Record<PermissionTier, number> {
    const counts = {} as Record<PermissionTier, number>;
    for (const tier of TIER_PRIORITY) {
      counts[tier] = this.rules.filter((r) => r.tier === tier).length;
    }
    return counts;
  }
}

/**
 * Create a default permission engine with standard system rules.
 * System-tier rules are always present:
 * - Deny all by default
 * - Allow admin role on everything
 */
export function createDefaultPermissionEngine(): HierarchicalPermissionEngine {
  const engine = new HierarchicalPermissionEngine('deny');

  // System tier: admin has full access
  engine.addRule({
    ruleId: 'system-admin-allow-all',
    tier: 'system',
    resource: '**',
    action: '*',
    effect: 'allow',
    condition: { field: 'role', operator: 'eq', value: 'admin' },
    priority: 1000,
    enabled: true,
    description: 'System administrators have full access',
  });

  return engine;
}
