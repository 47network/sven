import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 6.6 Community Bridge Service
 * Local agent participates in community (if user consents via Batch 5 consent toggles).
 * Files bugs, requests features, shares insights — bridging on-device agents to federation.
 */

type BridgeAction = 'file_bug' | 'request_feature' | 'share_insight' | 'ask_question' | 'vote';

interface BridgeEvent {
  id: string;
  organization_id: string;
  user_id: string;
  device_id: string;
  action: BridgeAction;
  payload: Record<string, unknown>;
  consent_verified: boolean;
  consent_level: string;
  target_community_topic: string | null;
  remote_entity_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface BridgeConfig {
  id: string;
  organization_id: string;
  user_id: string;
  auto_file_bugs: boolean;
  auto_share_insights: boolean;
  auto_request_features: boolean;
  min_confidence_to_share: number;
  created_at: string;
}

export class CommunityBridgeService {
  constructor(private pool: pg.Pool) {}

  /** Get or create bridge config for a user */
  async getConfig(organizationId: string, userId: string): Promise<BridgeConfig> {
    const result = await this.pool.query(
      `SELECT * FROM gemma4_community_bridge_config WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId],
    );
    if (result.rows[0]) return this.mapConfig(result.rows[0]);

    // Default: all auto-actions disabled, high confidence threshold
    const id = uuidv7();
    const ins = await this.pool.query(
      `INSERT INTO gemma4_community_bridge_config (
        id, organization_id, user_id, auto_file_bugs, auto_share_insights,
        auto_request_features, min_confidence_to_share, created_at
      ) VALUES ($1,$2,$3,FALSE,FALSE,FALSE,0.8,NOW())
      ON CONFLICT (organization_id, user_id) DO UPDATE SET updated_at = NOW()
      RETURNING *`,
      [id, organizationId, userId],
    );
    return this.mapConfig(ins.rows[0]);
  }

  /** Update bridge config */
  async updateConfig(organizationId: string, userId: string, updates: Partial<BridgeConfig>): Promise<BridgeConfig> {
    const fields: string[] = [];
    const params: unknown[] = [organizationId, userId];
    if (updates.auto_file_bugs !== undefined) { params.push(updates.auto_file_bugs); fields.push(`auto_file_bugs = $${params.length}`); }
    if (updates.auto_share_insights !== undefined) { params.push(updates.auto_share_insights); fields.push(`auto_share_insights = $${params.length}`); }
    if (updates.auto_request_features !== undefined) { params.push(updates.auto_request_features); fields.push(`auto_request_features = $${params.length}`); }
    if (updates.min_confidence_to_share !== undefined) {
      if (updates.min_confidence_to_share < 0 || updates.min_confidence_to_share > 1) throw new Error('min_confidence_to_share must be 0–1');
      params.push(updates.min_confidence_to_share); fields.push(`min_confidence_to_share = $${params.length}`);
    }
    if (fields.length === 0) return this.getConfig(organizationId, userId);
    fields.push('updated_at = NOW()');
    const result = await this.pool.query(
      `UPDATE gemma4_community_bridge_config SET ${fields.join(', ')} WHERE organization_id = $1 AND user_id = $2 RETURNING *`,
      params,
    );
    return this.mapConfig(result.rows[0]);
  }

  /**
   * Submit a bridge action from on-device agent to community.
   * Verifies consent before processing.
   */
  async submitAction(
    organizationId: string,
    userId: string,
    input: {
      device_id: string;
      action: BridgeAction;
      payload: Record<string, unknown>;
      consent_level: string;
    },
  ): Promise<BridgeEvent> {
    // Consent must be at least READ_ONLY to submit (CONTRIBUTE for writes)
    const writeActions: BridgeAction[] = ['file_bug', 'request_feature', 'share_insight'];
    const requiresContribute = writeActions.includes(input.action);
    const consentOk = requiresContribute
      ? input.consent_level === 'CONTRIBUTE'
      : ['READ_ONLY', 'CONTRIBUTE'].includes(input.consent_level);

    const id = uuidv7();
    if (!consentOk) {
      await this.pool.query(
        `INSERT INTO gemma4_community_bridge_events (
          id, organization_id, user_id, device_id, action, payload,
          consent_verified, consent_level, status, error_message, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,'rejected','Insufficient consent level',NOW())`,
        [id, organizationId, userId, input.device_id, input.action, JSON.stringify(input.payload), input.consent_level],
      );
      return {
        id, organization_id: organizationId, user_id: userId, device_id: input.device_id,
        action: input.action, payload: input.payload, consent_verified: false,
        consent_level: input.consent_level, target_community_topic: null,
        remote_entity_id: null, status: 'rejected', error_message: 'Insufficient consent level',
        created_at: new Date().toISOString(),
      };
    }

    await this.pool.query(
      `INSERT INTO gemma4_community_bridge_events (
        id, organization_id, user_id, device_id, action, payload,
        consent_verified, consent_level, status, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,'submitted',NOW())`,
      [id, organizationId, userId, input.device_id, input.action, JSON.stringify(input.payload), input.consent_level],
    );

    return {
      id, organization_id: organizationId, user_id: userId, device_id: input.device_id,
      action: input.action, payload: input.payload, consent_verified: true,
      consent_level: input.consent_level, target_community_topic: null,
      remote_entity_id: null, status: 'submitted', error_message: null,
      created_at: new Date().toISOString(),
    };
  }

  /** List bridge events for a user */
  async listEvents(organizationId: string, userId: string, opts?: { action?: BridgeAction; limit?: number }): Promise<BridgeEvent[]> {
    const conditions = ['organization_id = $1', 'user_id = $2'];
    const params: unknown[] = [organizationId, userId];
    if (opts?.action) { params.push(opts.action); conditions.push(`action = $${params.length}`); }
    const limit = opts?.limit ?? 50;
    params.push(limit);
    const result = await this.pool.query(
      `SELECT * FROM gemma4_community_bridge_events WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((r) => this.mapEvent(r));
  }

  /** Get bridge activity stats for the org */
  async getStats(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT action, status, COUNT(*) as count
       FROM gemma4_community_bridge_events
       WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY action, status ORDER BY count DESC`,
      [organizationId],
    );
    const total = result.rows.reduce((s, r) => s + Number(r.count), 0);
    const rejected = result.rows.filter((r) => r.status === 'rejected').reduce((s, r) => s + Number(r.count), 0);
    return { period: '30_days', total_events: total, rejected_for_consent: rejected, breakdown: result.rows };
  }

  private mapConfig(r: Record<string, unknown>): BridgeConfig {
    return {
      id: String(r.id), organization_id: String(r.organization_id), user_id: String(r.user_id),
      auto_file_bugs: Boolean(r.auto_file_bugs), auto_share_insights: Boolean(r.auto_share_insights),
      auto_request_features: Boolean(r.auto_request_features),
      min_confidence_to_share: Number(r.min_confidence_to_share), created_at: String(r.created_at),
    };
  }

  private mapEvent(r: Record<string, unknown>): BridgeEvent {
    return {
      id: String(r.id), organization_id: String(r.organization_id), user_id: String(r.user_id),
      device_id: String(r.device_id), action: r.action as BridgeAction,
      payload: (r.payload as Record<string, unknown>) || {},
      consent_verified: Boolean(r.consent_verified), consent_level: String(r.consent_level),
      target_community_topic: r.target_community_topic ? String(r.target_community_topic) : null,
      remote_entity_id: r.remote_entity_id ? String(r.remote_entity_id) : null,
      status: String(r.status), error_message: r.error_message ? String(r.error_message) : null,
      created_at: String(r.created_at),
    };
  }
}
