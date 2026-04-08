import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 5.6 Community Consent Service
 * Per-user federation consent toggles.
 * Default: OFF. Options: OFF | READ_ONLY | CONTRIBUTE.
 * GDPR Article 7 compliant: explicit consent, revocable at any time.
 */

interface CommunityConsent {
  id: string;
  organization_id: string;
  user_id: string;
  consent_level: string;
  federated_topics: string[];
  share_agent_data: boolean;
  share_memory_data: boolean;
  consent_given_at: string | null;
  created_at: string;
  updated_at: string;
}

export class CommunityConsentService {
  constructor(private pool: pg.Pool) {}

  /**
   * Get consent for a specific user. Returns default (OFF) if none set.
   */
  async getConsent(organizationId: string, userId: string): Promise<CommunityConsent> {
    const result = await this.pool.query(
      `SELECT * FROM federation_consent
       WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId],
    );

    if (result.rows[0]) return this.mapRow(result.rows[0]);

    // Return default OFF state
    return {
      id: '',
      organization_id: organizationId,
      user_id: userId,
      consent_level: 'off',
      federated_topics: [],
      share_agent_data: false,
      share_memory_data: false,
      consent_given_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Update consent level for a user. Requires explicit action.
   */
  async updateConsent(
    organizationId: string,
    userId: string,
    input: {
      consent_level: string;
      federated_topics?: string[];
      share_agent_data?: boolean;
      share_memory_data?: boolean;
      consent_ip?: string;
    },
  ): Promise<CommunityConsent> {
    const validLevels = ['off', 'read_only', 'contribute'];
    if (!validLevels.includes(input.consent_level)) {
      throw new Error(`Invalid consent level. Must be one of: ${validLevels.join(', ')}`);
    }

    // GDPR: when setting to OFF, clear all sharing flags
    const isOff = input.consent_level === 'off';
    const shareAgent = isOff ? false : (input.share_agent_data ?? false);
    const shareMemory = isOff ? false : (input.share_memory_data ?? false);
    const topics = isOff ? [] : (input.federated_topics ?? []);
    const consentGivenAt = isOff ? null : new Date().toISOString();

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO federation_consent (
        id, organization_id, user_id, consent_level, federated_topics,
        share_agent_data, share_memory_data, consent_given_at, consent_ip,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (organization_id, user_id) DO UPDATE SET
        consent_level = EXCLUDED.consent_level,
        federated_topics = EXCLUDED.federated_topics,
        share_agent_data = EXCLUDED.share_agent_data,
        share_memory_data = EXCLUDED.share_memory_data,
        consent_given_at = EXCLUDED.consent_given_at,
        consent_ip = EXCLUDED.consent_ip,
        updated_at = NOW()
      RETURNING *`,
      [
        id,
        organizationId,
        userId,
        input.consent_level,
        JSON.stringify(topics),
        shareAgent,
        shareMemory,
        consentGivenAt,
        input.consent_ip || null,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Revoke all consent (GDPR right to withdraw).
   */
  async revokeConsent(organizationId: string, userId: string): Promise<CommunityConsent> {
    return this.updateConsent(organizationId, userId, { consent_level: 'off' });
  }

  /**
   * Check if user has consent to participate in a specific topic.
   */
  async canParticipate(
    organizationId: string,
    userId: string,
    topicName: string,
    action: 'read' | 'write',
  ): Promise<boolean> {
    const consent = await this.getConsent(organizationId, userId);

    if (consent.consent_level === 'off') return false;
    if (action === 'write' && consent.consent_level === 'read_only') return false;

    // If specific topics are set, check if this topic is included
    if (consent.federated_topics.length > 0) {
      return consent.federated_topics.includes(topicName);
    }

    // No topic restriction = all topics allowed at their consent level
    return true;
  }

  /**
   * Get consent statistics for the organization.
   */
  async getStats(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT
        consent_level,
        COUNT(*) AS count,
        COUNT(*) FILTER (WHERE share_agent_data = TRUE) AS sharing_agent,
        COUNT(*) FILTER (WHERE share_memory_data = TRUE) AS sharing_memory
       FROM federation_consent
       WHERE organization_id = $1
       GROUP BY consent_level`,
      [organizationId],
    );

    const stats: Record<string, unknown> = { off: 0, read_only: 0, contribute: 0 };
    let totalSharingAgent = 0;
    let totalSharingMemory = 0;

    for (const row of result.rows) {
      stats[row.consent_level] = parseInt(row.count, 10);
      totalSharingAgent += parseInt(row.sharing_agent, 10);
      totalSharingMemory += parseInt(row.sharing_memory, 10);
    }

    return {
      by_level: stats,
      sharing_agent_data: totalSharingAgent,
      sharing_memory_data: totalSharingMemory,
    };
  }

  private mapRow(row: any): CommunityConsent {
    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      consent_level: row.consent_level,
      federated_topics: Array.isArray(row.federated_topics)
        ? row.federated_topics
        : JSON.parse(row.federated_topics || '[]'),
      share_agent_data: row.share_agent_data,
      share_memory_data: row.share_memory_data,
      consent_given_at: row.consent_given_at?.toISOString?.() ?? row.consent_given_at ?? null,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
      updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
    };
  }
}
