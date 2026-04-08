import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';

const logger = createLogger('memory-consent');

export interface MemoryConsentRecord {
  id: string;
  user_id: string;
  organization_id: string;
  consent_given: boolean;
  consent_scope: 'full' | 'conversation' | 'facts';
  retention_days: number | null;
  allow_consolidation: boolean;
  allow_emotional_tracking: boolean;
  allow_reasoning_capture: boolean;
  forget_requested_at: string | null;
  forget_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsentUpdate {
  consent_given?: boolean;
  consent_scope?: 'full' | 'conversation' | 'facts';
  retention_days?: number | null;
  allow_consolidation?: boolean;
  allow_emotional_tracking?: boolean;
  allow_reasoning_capture?: boolean;
}

const VALID_SCOPES = ['full', 'conversation', 'facts'] as const;

function isValidScope(s: unknown): s is 'full' | 'conversation' | 'facts' {
  return typeof s === 'string' && (VALID_SCOPES as readonly string[]).includes(s);
}

/**
 * GDPR Articles 15-17 compliance service.
 *
 * - Article 15: Right of access — user can see all stored data
 * - Article 16: Right to rectification — user can correct stored data
 * - Article 17: Right to erasure ("right to be forgotten")
 *
 * All consent changes and data access requests are audit-logged.
 */
export class MemoryConsentService {
  constructor(private pool: pg.Pool) {}

  /**
   * Get or create a consent record for a user in an organization.
   * Default: consent_given = true, scope = 'full', all features allowed.
   */
  async getConsent(userId: string, orgId: string): Promise<MemoryConsentRecord> {
    const existing = await this.pool.query(
      `SELECT * FROM memory_consent
       WHERE user_id = $1 AND organization_id = $2
       LIMIT 1`,
      [userId, orgId],
    );

    if (existing.rows.length > 0) {
      return existing.rows[0] as MemoryConsentRecord;
    }

    // Create default consent record
    const id = uuidv7();
    const res = await this.pool.query(
      `INSERT INTO memory_consent
       (id, user_id, organization_id, consent_given, consent_scope,
        allow_consolidation, allow_emotional_tracking, allow_reasoning_capture)
       VALUES ($1, $2, $3, true, 'full', true, true, true)
       ON CONFLICT (user_id, organization_id) DO NOTHING
       RETURNING *`,
      [id, userId, orgId],
    );

    if (res.rows.length > 0) {
      return res.rows[0] as MemoryConsentRecord;
    }

    // Concurrent insert race — re-read
    const retry = await this.pool.query(
      `SELECT * FROM memory_consent
       WHERE user_id = $1 AND organization_id = $2
       LIMIT 1`,
      [userId, orgId],
    );
    return retry.rows[0] as MemoryConsentRecord;
  }

  /**
   * Update consent preferences. Audit-logged.
   */
  async updateConsent(userId: string, orgId: string, update: ConsentUpdate): Promise<MemoryConsentRecord> {
    // Ensure record exists
    await this.getConsent(userId, orgId);

    const sets: string[] = [];
    const params: unknown[] = [];

    if (update.consent_given !== undefined) {
      params.push(update.consent_given);
      sets.push(`consent_given = $${params.length}`);
    }
    if (update.consent_scope !== undefined) {
      if (!isValidScope(update.consent_scope)) {
        throw new Error(`Invalid consent scope: ${String(update.consent_scope)}. Must be one of: ${VALID_SCOPES.join(', ')}`);
      }
      params.push(update.consent_scope);
      sets.push(`consent_scope = $${params.length}`);
    }
    if (update.retention_days !== undefined) {
      const days = update.retention_days === null ? null : Math.max(1, Math.min(3650, Number(update.retention_days)));
      params.push(days);
      sets.push(`retention_days = $${params.length}`);
    }
    if (update.allow_consolidation !== undefined) {
      params.push(update.allow_consolidation);
      sets.push(`allow_consolidation = $${params.length}`);
    }
    if (update.allow_emotional_tracking !== undefined) {
      params.push(update.allow_emotional_tracking);
      sets.push(`allow_emotional_tracking = $${params.length}`);
    }
    if (update.allow_reasoning_capture !== undefined) {
      params.push(update.allow_reasoning_capture);
      sets.push(`allow_reasoning_capture = $${params.length}`);
    }

    if (sets.length === 0) {
      return this.getConsent(userId, orgId);
    }

    params.push(userId);
    params.push(orgId);

    const res = await this.pool.query(
      `UPDATE memory_consent
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE user_id = $${params.length - 1} AND organization_id = $${params.length}
       RETURNING *`,
      params,
    );

    const record = res.rows[0] as MemoryConsentRecord;

    logger.info('Memory consent updated', {
      user_id: userId,
      organization_id: orgId,
      changes: update,
    });

    return record;
  }

  /**
   * GDPR Article 15: Right of access — export all data Sven holds for this user.
   */
  async exportUserData(userId: string, orgId: string): Promise<{
    memories: unknown[];
    emotional_states: unknown[];
    reasoning: unknown[];
    understanding: unknown[];
    consent: MemoryConsentRecord;
  }> {
    const [memories, emotional, reasoning, understanding, consent] = await Promise.all([
      this.pool.query(
        `SELECT id, key, value, source, importance, created_at, updated_at
         FROM memories
         WHERE user_id = $1 AND (organization_id IS NOT DISTINCT FROM $2)
           AND archived_at IS NULL
         ORDER BY created_at DESC`,
        [userId, orgId],
      ),
      this.pool.query(
        `SELECT id, detected_mood, sentiment_score, frustration_level,
                excitement_level, confusion_level, created_at
         FROM emotional_states
         WHERE user_id = $1 AND organization_id = $2
         ORDER BY created_at DESC`,
        [userId, orgId],
      ),
      this.pool.query(
        `SELECT id, topic, user_choice, sven_suggestion, reasoning, created_at
         FROM user_reasoning
         WHERE user_id = $1 AND organization_id = $2
         ORDER BY created_at DESC`,
        [userId, orgId],
      ),
      this.pool.query(
        `SELECT dimension, pattern_summary, evidence_count, confidence, updated_at
         FROM user_understanding
         WHERE user_id = $1 AND organization_id = $2
         ORDER BY dimension`,
        [userId, orgId],
      ),
      this.getConsent(userId, orgId),
    ]);

    logger.info('User data exported (GDPR Art.15)', { user_id: userId, organization_id: orgId });

    return {
      memories: memories.rows,
      emotional_states: emotional.rows,
      reasoning: reasoning.rows,
      understanding: understanding.rows,
      consent,
    };
  }

  /**
   * GDPR Article 17: Right to erasure ("Forget me").
   * Deletes ALL user data: memories, emotional states, reasoning, understanding.
   * Sets forget_requested_at and forget_completed_at on the consent record.
   */
  async forgetUser(userId: string, orgId: string): Promise<{
    memories_deleted: number;
    emotional_states_deleted: number;
    reasoning_deleted: number;
    understanding_deleted: number;
  }> {
    // Mark forget request timestamp
    await this.pool.query(
      `UPDATE memory_consent
       SET forget_requested_at = NOW(), consent_given = false, updated_at = NOW()
       WHERE user_id = $1 AND organization_id = $2`,
      [userId, orgId],
    );

    // Delete all user data in a transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const memoriesRes = await client.query(
        `DELETE FROM memories
         WHERE user_id = $1 AND (organization_id IS NOT DISTINCT FROM $2)
         RETURNING id`,
        [userId, orgId],
      );

      const emotionalRes = await client.query(
        `DELETE FROM emotional_states
         WHERE user_id = $1 AND organization_id = $2
         RETURNING id`,
        [userId, orgId],
      );

      const reasoningRes = await client.query(
        `DELETE FROM user_reasoning
         WHERE user_id = $1 AND organization_id = $2
         RETURNING id`,
        [userId, orgId],
      );

      const understandingRes = await client.query(
        `DELETE FROM user_understanding
         WHERE user_id = $1 AND organization_id = $2
         RETURNING id`,
        [userId, orgId],
      );

      await client.query('COMMIT');

      // Mark forget completed
      await this.pool.query(
        `UPDATE memory_consent
         SET forget_completed_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND organization_id = $2`,
        [userId, orgId],
      );

      const result = {
        memories_deleted: memoriesRes.rows.length,
        emotional_states_deleted: emotionalRes.rows.length,
        reasoning_deleted: reasoningRes.rows.length,
        understanding_deleted: understandingRes.rows.length,
      };

      logger.info('User data erased (GDPR Art.17)', {
        user_id: userId,
        organization_id: orgId,
        ...result,
      });

      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Failed to erase user data', { user_id: userId, error: String(err) });
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a specific feature is consented for a user.
   * Used by other services before recording data.
   */
  async isFeatureConsented(
    userId: string,
    orgId: string,
    feature: 'consolidation' | 'emotional_tracking' | 'reasoning_capture',
  ): Promise<boolean> {
    try {
      const consent = await this.getConsent(userId, orgId);
      if (!consent.consent_given) return false;
      switch (feature) {
        case 'consolidation': return consent.allow_consolidation;
        case 'emotional_tracking': return consent.allow_emotional_tracking;
        case 'reasoning_capture': return consent.allow_reasoning_capture;
        default: return false;
      }
    } catch {
      // On error, default deny — fail-safe
      return false;
    }
  }

  /**
   * Apply retention policy: delete memories older than retention_days.
   * Called by the consolidation sweep worker.
   */
  async applyRetentionPolicy(orgId: string): Promise<number> {
    const consentRecords = await this.pool.query(
      `SELECT user_id, retention_days
       FROM memory_consent
       WHERE organization_id = $1
         AND consent_given = true
         AND retention_days IS NOT NULL`,
      [orgId],
    );

    let totalDeleted = 0;

    for (const record of consentRecords.rows) {
      const days = Number(record.retention_days);
      if (days <= 0) continue;

      const res = await this.pool.query(
        `DELETE FROM memories
         WHERE user_id = $1
           AND (organization_id IS NOT DISTINCT FROM $2)
           AND created_at < NOW() - make_interval(days => $3)
           AND consolidation_status IS DISTINCT FROM 'consolidated'
         RETURNING id`,
        [record.user_id, orgId, days],
      );
      totalDeleted += res.rows.length;
    }

    if (totalDeleted > 0) {
      logger.info('Retention policy applied', { organization_id: orgId, deleted: totalDeleted });
    }
    return totalDeleted;
  }
}
