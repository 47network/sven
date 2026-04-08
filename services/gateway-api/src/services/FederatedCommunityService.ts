import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 5.4 Federated Community Service
 * Manages cross-instance community topics where posts from one
 * Sven instance are visible on another (opt-in). Like Matrix rooms
 * spanning homeservers.
 */

interface FederatedTopic {
  id: string;
  organization_id: string;
  topic_name: string;
  description: string;
  direction: string;
  peer_id: string | null;
  nats_subject: string;
  message_count: number;
  last_message_at: string | null;
  is_active: boolean;
  created_at: string;
}

export class FederatedCommunityService {
  constructor(private pool: pg.Pool) {}

  /**
   * Create a federated community topic with a specific peer.
   */
  async createTopic(
    organizationId: string,
    input: {
      topic_name: string;
      description?: string;
      direction?: string;
      peer_id: string;
    },
  ): Promise<FederatedTopic> {
    if (!input.topic_name?.trim()) throw new Error('Topic name is required');
    if (!input.peer_id?.trim()) throw new Error('Peer ID is required');

    const validDirections = ['publish', 'subscribe', 'bidirectional'];
    const direction = input.direction || 'bidirectional';
    if (!validDirections.includes(direction)) {
      throw new Error(`Invalid direction. Must be one of: ${validDirections.join(', ')}`);
    }

    // Verify peer exists and is active
    const peer = await this.pool.query(
      `SELECT id, status, trust_level FROM federation_peers
       WHERE id = $1 AND organization_id = $2`,
      [input.peer_id, organizationId],
    );
    if (!peer.rows[0]) throw new Error('Peer not found');
    if (peer.rows[0].status === 'blocked') throw new Error('Cannot create topic with blocked peer');
    if (peer.rows[0].trust_level === 'untrusted') {
      throw new Error('Peer must be at least verified before creating federated topics');
    }

    // Build NATS subject for this federated topic
    const sanitizedName = input.topic_name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const natsSubject = `federation.community.${sanitizedName}`;

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO federation_community_topics (
        id, organization_id, topic_name, description, direction,
        peer_id, nats_subject, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW())
      ON CONFLICT (organization_id, topic_name, peer_id) DO UPDATE SET
        direction = EXCLUDED.direction,
        description = EXCLUDED.description,
        is_active = TRUE
      RETURNING *`,
      [
        id,
        organizationId,
        input.topic_name.trim(),
        input.description?.trim() || '',
        direction,
        input.peer_id,
        natsSubject,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Record an incoming/outgoing federated message.
   */
  async recordMessage(organizationId: string, topicId: string): Promise<void> {
    await this.pool.query(
      `UPDATE federation_community_topics
       SET message_count = message_count + 1, last_message_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [topicId, organizationId],
    );
  }

  /**
   * List federated topics.
   */
  async listTopics(
    organizationId: string,
    options?: { peer_id?: string; active_only?: boolean },
  ): Promise<FederatedTopic[]> {
    const conditions = ['t.organization_id = $1'];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (options?.peer_id) {
      conditions.push(`t.peer_id = $${idx++}`);
      params.push(options.peer_id);
    }
    if (options?.active_only !== false) {
      conditions.push('t.is_active = TRUE');
    }

    const result = await this.pool.query(
      `SELECT t.* FROM federation_community_topics t
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC`,
      params,
    );

    return result.rows.map((r: any) => this.mapRow(r));
  }

  /**
   * Deactivate a topic (soft delete).
   */
  async deactivateTopic(organizationId: string, topicId: string): Promise<void> {
    await this.pool.query(
      `UPDATE federation_community_topics SET is_active = FALSE
       WHERE id = $1 AND organization_id = $2`,
      [topicId, organizationId],
    );
  }

  /**
   * Get federation community summary for the instance.
   */
  async getSummary(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE is_active = TRUE) AS active_topics,
        COUNT(*) AS total_topics,
        COALESCE(SUM(message_count), 0) AS total_messages,
        COUNT(DISTINCT peer_id) FILTER (WHERE is_active = TRUE) AS active_peers
       FROM federation_community_topics
       WHERE organization_id = $1`,
      [organizationId],
    );

    const row = result.rows[0];
    return {
      active_topics: parseInt(row.active_topics, 10),
      total_topics: parseInt(row.total_topics, 10),
      total_messages: parseInt(row.total_messages, 10),
      active_peers: parseInt(row.active_peers, 10),
    };
  }

  private mapRow(row: any): FederatedTopic {
    return {
      id: row.id,
      organization_id: row.organization_id,
      topic_name: row.topic_name,
      description: row.description,
      direction: row.direction,
      peer_id: row.peer_id,
      nats_subject: row.nats_subject,
      message_count: parseInt(row.message_count, 10),
      last_message_at: row.last_message_at?.toISOString?.() ?? row.last_message_at,
      is_active: row.is_active,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
    };
  }
}
