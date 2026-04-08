/**
 * Permission hooks — before/after decision callbacks with audit trail.
 *
 * Wraps the permission evaluation lifecycle with pluggable hooks
 * (before-check, after-check, on-deny, on-escalation) and produces
 * a structured, immutable audit trail suitable for SOC 2 / ISO 27001.
 *
 * Prior art: Spring Security filters (2004), Express middleware,
 * Ruby on_Rails before_action/after_action, ASP.NET authorization filters,
 * AWS CloudTrail, Linux audit subsystem (auditd).
 */

import { createLogger } from './logger.js';

const logger = createLogger('permission-hooks');

// ──── Types ──────────────────────────────────────────────────────

export type AuditDecision = 'allow' | 'deny' | 'escalate' | 'error';

export interface AuditEntry {
  /** Unique audit entry ID */
  entryId: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Who requested the action */
  subjectId: string;
  /** Role of the subject at time of check */
  subjectRole?: string;
  /** Resource being accessed */
  resource: string;
  /** Action being attempted */
  action: string;
  /** Final decision */
  decision: AuditDecision;
  /** Which rule/tier produced the decision */
  decidedBy?: string;
  /** Request correlation ID */
  correlationId?: string;
  /** Adapter or channel of origin */
  origin?: string;
  /** IP address (if applicable) */
  ipAddress?: string;
  /** Additional context (never contains PII or secrets) */
  metadata?: Record<string, unknown>;
  /** Time taken to evaluate in microseconds */
  evaluationTimeUs?: number;
}

export interface PermissionHookContext {
  subjectId: string;
  subjectRole?: string;
  resource: string;
  action: string;
  correlationId?: string;
  origin?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook that runs BEFORE permission evaluation.
 * Can modify the context or short-circuit with an early decision.
 */
export type BeforeCheckHook = (
  context: PermissionHookContext,
) => Promise<{ proceed: true } | { proceed: false; decision: AuditDecision; reason: string }>;

/**
 * Hook that runs AFTER permission evaluation.
 * Receives the decision and audit entry. Cannot change the decision.
 */
export type AfterCheckHook = (
  entry: AuditEntry,
  context: PermissionHookContext,
) => Promise<void>;

/**
 * Hook that runs specifically on deny decisions.
 * Useful for alerting, rate tracking, or escalation.
 */
export type OnDenyHook = (
  entry: AuditEntry,
  context: PermissionHookContext,
) => Promise<void>;

export interface PermissionHooksConfig {
  /** Maximum audit trail entries to retain in memory */
  maxAuditEntries: number;
  /** Callback to persist audit entries (DB, log aggregator, etc.) */
  persistFn?: (entry: AuditEntry) => Promise<void>;
  /** Whether to persist synchronously (await) or fire-and-forget */
  persistSync: boolean;
}

// ──── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: PermissionHooksConfig = {
  maxAuditEntries: 5000,
  persistSync: false,
};

// ──── ID Generation (simple, no external deps) ───────────────────

let auditCounter = 0;

function generateAuditId(): string {
  const ts = Date.now().toString(36);
  const seq = (auditCounter++).toString(36).padStart(4, '0');
  const rand = Math.random().toString(36).slice(2, 6);
  return `aud-${ts}-${seq}-${rand}`;
}

// ──── Permission Hook Manager ────────────────────────────────────

/**
 * PermissionHookManager orchestrates before/after hooks around
 * permission evaluations and maintains an auditable trail.
 */
export class PermissionHookManager {
  private beforeHooks: BeforeCheckHook[] = [];
  private afterHooks: AfterCheckHook[] = [];
  private denyHooks: OnDenyHook[] = [];
  private auditTrail: AuditEntry[] = [];
  private config: PermissionHooksConfig;

  constructor(config?: Partial<PermissionHooksConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a before-check hook.
   */
  onBeforeCheck(hook: BeforeCheckHook): void {
    this.beforeHooks.push(hook);
  }

  /**
   * Register an after-check hook.
   */
  onAfterCheck(hook: AfterCheckHook): void {
    this.afterHooks.push(hook);
  }

  /**
   * Register a deny hook.
   */
  onDeny(hook: OnDenyHook): void {
    this.denyHooks.push(hook);
  }

  /**
   * Execute the hook chain around a permission evaluation function.
   * The evaluateFn is the actual permission check (e.g., HierarchicalPermissionEngine.evaluate).
   */
  async executeWithHooks(
    context: PermissionHookContext,
    evaluateFn: () => Promise<{
      decision: AuditDecision;
      decidedBy?: string;
      evaluationTimeUs?: number;
    }>,
  ): Promise<AuditEntry> {
    // Run before hooks
    for (const hook of this.beforeHooks) {
      try {
        const result = await hook(context);
        if (!result.proceed) {
          // Short-circuit: before hook decided
          const entry = this.createEntry(context, result.decision, `before-hook: ${result.reason}`);
          await this.recordEntry(entry, context);
          return entry;
        }
      } catch (err: any) {
        logger.error('Before-check hook error', {
          error: err.message,
          subjectId: context.subjectId,
          resource: context.resource,
        });
        // On hook error, deny by default (fail-closed)
        const entry = this.createEntry(context, 'error', `before-hook error: ${err.message}`);
        await this.recordEntry(entry, context);
        return entry;
      }
    }

    // Run the actual evaluation
    let decision: AuditDecision;
    let decidedBy: string | undefined;
    let evaluationTimeUs: number | undefined;

    try {
      const result = await evaluateFn();
      decision = result.decision;
      decidedBy = result.decidedBy;
      evaluationTimeUs = result.evaluationTimeUs;
    } catch (err: any) {
      logger.error('Permission evaluation error', {
        error: err.message,
        subjectId: context.subjectId,
        resource: context.resource,
      });
      decision = 'error';
      decidedBy = `evaluation error: ${err.message}`;
    }

    const entry = this.createEntry(context, decision, decidedBy, evaluationTimeUs);
    await this.recordEntry(entry, context);

    return entry;
  }

  /**
   * Record an externally-produced audit entry (for cases where
   * the permission check is not wrapped by this manager).
   */
  async recordExternalEntry(entry: AuditEntry): Promise<void> {
    this.appendToTrail(entry);
    await this.persistEntry(entry);
  }

  /**
   * Get the in-memory audit trail (newest first).
   */
  getAuditTrail(
    filters?: Partial<{
      subjectId: string;
      resource: string;
      decision: AuditDecision;
      since: string;
      limit: number;
    }>,
  ): AuditEntry[] {
    let results = [...this.auditTrail].reverse();

    if (filters) {
      if (filters.subjectId) {
        results = results.filter((e) => e.subjectId === filters.subjectId);
      }
      if (filters.resource) {
        results = results.filter((e) => e.resource === filters.resource);
      }
      if (filters.decision) {
        results = results.filter((e) => e.decision === filters.decision);
      }
      if (filters.since) {
        const since = filters.since;
        results = results.filter((e) => e.timestamp >= since);
      }
      if (filters.limit) {
        results = results.slice(0, filters.limit);
      }
    }

    return results;
  }

  /**
   * Get deny count for a subject within a time window.
   * Useful for rate-limiting or brute-force detection.
   */
  getDenyCount(subjectId: string, windowMs: number): number {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    return this.auditTrail.filter(
      (e) => e.subjectId === subjectId && e.decision === 'deny' && e.timestamp >= cutoff,
    ).length;
  }

  /**
   * Clear the in-memory audit trail.
   */
  clearTrail(): void {
    this.auditTrail = [];
  }

  /**
   * Get audit trail size.
   */
  getTrailSize(): number {
    return this.auditTrail.length;
  }

  // ──── Private ────────────────────────────────────────────────

  private createEntry(
    context: PermissionHookContext,
    decision: AuditDecision,
    decidedBy?: string,
    evaluationTimeUs?: number,
  ): AuditEntry {
    return {
      entryId: generateAuditId(),
      timestamp: new Date().toISOString(),
      subjectId: context.subjectId,
      subjectRole: context.subjectRole,
      resource: context.resource,
      action: context.action,
      decision,
      decidedBy,
      correlationId: context.correlationId,
      origin: context.origin,
      ipAddress: context.ipAddress,
      metadata: context.metadata,
      evaluationTimeUs,
    };
  }

  private async recordEntry(
    entry: AuditEntry,
    context: PermissionHookContext,
  ): Promise<void> {
    this.appendToTrail(entry);

    // Run after hooks
    for (const hook of this.afterHooks) {
      try {
        await hook(entry, context);
      } catch (err: any) {
        logger.error('After-check hook error', { error: err.message, entryId: entry.entryId });
      }
    }

    // Run deny hooks if applicable
    if (entry.decision === 'deny') {
      for (const hook of this.denyHooks) {
        try {
          await hook(entry, context);
        } catch (err: any) {
          logger.error('Deny hook error', { error: err.message, entryId: entry.entryId });
        }
      }
    }

    // Persist
    await this.persistEntry(entry);
  }

  private appendToTrail(entry: AuditEntry): void {
    this.auditTrail.push(entry);
    while (this.auditTrail.length > this.config.maxAuditEntries) {
      this.auditTrail.shift();
    }
  }

  private async persistEntry(entry: AuditEntry): Promise<void> {
    if (!this.config.persistFn) return;

    if (this.config.persistSync) {
      try {
        await this.config.persistFn(entry);
      } catch (err: any) {
        logger.error('Audit persist error', { error: err.message, entryId: entry.entryId });
      }
    } else {
      // Fire and forget — log errors only
      this.config.persistFn(entry).catch((err: any) => {
        logger.error('Audit persist error (async)', { error: err.message, entryId: entry.entryId });
      });
    }
  }
}
