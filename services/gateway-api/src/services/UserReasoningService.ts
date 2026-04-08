import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';

const logger = createLogger('user-reasoning');

export interface UserReasoningRecord {
  id: string;
  user_id: string;
  organization_id: string;
  chat_id: string | null;
  topic: string;
  user_choice: string;
  sven_suggestion: string | null;
  reasoning: string;
  expertise_area: string | null;
  pattern_tags: string[];
  created_at: string;
}

export interface UserUnderstandingRecord {
  id: string;
  user_id: string;
  organization_id: string;
  dimension: string;
  pattern_summary: string;
  evidence_count: number;
  confidence: number;
  updated_at: string;
}

const VALID_DIMENSIONS = [
  'risk_tolerance',
  'tech_preferences',
  'communication_style',
  'decision_speed',
  'detail_orientation',
  'collaboration_preference',
  'learning_style',
  'domain_expertise',
] as const;

export class UserReasoningService {
  constructor(private pool: pg.Pool) {}

  /**
   * Record a user's reasoning when they make a choice —
   * especially when they override Sven's suggestion.
   */
  async recordReasoning(params: {
    user_id: string;
    organization_id: string;
    chat_id?: string | null;
    topic: string;
    user_choice: string;
    sven_suggestion?: string | null;
    reasoning: string;
    expertise_area?: string | null;
    pattern_tags?: string[];
  }): Promise<UserReasoningRecord> {
    if (!params.topic || params.topic.length > 500) {
      throw new Error('Topic is required and must be ≤500 characters');
    }
    if (!params.reasoning || params.reasoning.length > 5000) {
      throw new Error('Reasoning is required and must be ≤5000 characters');
    }
    if (!params.user_choice || params.user_choice.length > 2000) {
      throw new Error('User choice is required and must be ≤2000 characters');
    }

    const id = uuidv7();
    const tags = Array.isArray(params.pattern_tags)
      ? params.pattern_tags.filter((t) => typeof t === 'string' && t.length <= 100).slice(0, 20)
      : [];

    const res = await this.pool.query(
      `INSERT INTO user_reasoning
       (id, user_id, organization_id, chat_id, topic, user_choice,
        sven_suggestion, reasoning, expertise_area, pattern_tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[])
       RETURNING *`,
      [
        id,
        params.user_id,
        params.organization_id,
        params.chat_id ?? null,
        params.topic,
        params.user_choice,
        params.sven_suggestion ?? null,
        params.reasoning,
        params.expertise_area ?? null,
        tags,
      ],
    );

    // Async: update understanding model (non-blocking)
    this.updateUnderstandingFromReasoning(params.user_id, params.organization_id, params.topic, params.reasoning, tags)
      .catch((err) => logger.warn('Failed to update user understanding', { error: String(err) }));

    return res.rows[0] as UserReasoningRecord;
  }

  /**
   * List reasoning records for a user, optionally filtered by topic.
   */
  async listReasoning(params: {
    user_id: string;
    organization_id: string;
    topic?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: UserReasoningRecord[]; total: number }> {
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = Math.max(0, Number(params.offset || 0));

    let where = 'WHERE user_id = $1 AND organization_id = $2';
    const queryParams: unknown[] = [params.user_id, params.organization_id];

    if (params.topic) {
      queryParams.push(`%${params.topic}%`);
      where += ` AND topic ILIKE $${queryParams.length}`;
    }

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM user_reasoning ${where}`,
      queryParams,
    );
    const total = Number(countRes.rows[0]?.total || 0);

    const dataParams = [...queryParams, limit, offset];
    const dataRes = await this.pool.query(
      `SELECT * FROM user_reasoning ${where}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { rows: dataRes.rows as UserReasoningRecord[], total };
  }

  /**
   * Get the aggregated understanding model for a user.
   */
  async getUnderstanding(params: {
    user_id: string;
    organization_id: string;
    dimension?: string;
  }): Promise<UserUnderstandingRecord[]> {
    let where = 'WHERE user_id = $1 AND organization_id = $2';
    const queryParams: unknown[] = [params.user_id, params.organization_id];

    if (params.dimension) {
      queryParams.push(params.dimension);
      where += ` AND dimension = $${queryParams.length}`;
    }

    const res = await this.pool.query(
      `SELECT * FROM user_understanding ${where}
       ORDER BY confidence DESC, evidence_count DESC`,
      queryParams,
    );
    return res.rows as UserUnderstandingRecord[];
  }

  /**
   * Internal: derive understanding dimensions from a new reasoning entry.
   * Uses pattern tags and topic to infer dimensions.
   */
  private async updateUnderstandingFromReasoning(
    userId: string,
    orgId: string,
    topic: string,
    reasoning: string,
    tags: string[],
  ): Promise<void> {
    // Map tags and topic to understanding dimensions
    const dimensionUpdates = new Map<string, string>();

    const lower = `${topic} ${reasoning} ${tags.join(' ')}`.toLowerCase();

    if (/\b(risk|safe|conservative|aggressive|caution|bold)\b/.test(lower)) {
      const isConservative = /\b(safe|conservative|caution|careful)\b/.test(lower);
      dimensionUpdates.set('risk_tolerance', isConservative ? 'conservative' : 'risk-tolerant');
    }

    if (/\b(tech|framework|language|library|tool|stack|platform|infra)\b/.test(lower)) {
      dimensionUpdates.set('tech_preferences', `Prefers: ${topic.slice(0, 200)}`);
    }

    if (/\b(detail|thorough|specific|precise|overview|summary|brief)\b/.test(lower)) {
      const isDetailed = /\b(detail|thorough|specific|precise)\b/.test(lower);
      dimensionUpdates.set('detail_orientation', isDetailed ? 'detail-oriented' : 'high-level');
    }

    if (/\b(quick|fast|immediate|slow|deliberate|think|consider)\b/.test(lower)) {
      const isFast = /\b(quick|fast|immediate)\b/.test(lower);
      dimensionUpdates.set('decision_speed', isFast ? 'decisive' : 'deliberate');
    }

    for (const [dimension, summary] of dimensionUpdates) {
      await this.pool.query(
        `INSERT INTO user_understanding (id, user_id, organization_id, dimension, pattern_summary, evidence_count, confidence)
         VALUES ($1, $2, $3, $4, $5, 1, 0.3)
         ON CONFLICT (user_id, organization_id, dimension)
         DO UPDATE SET
           pattern_summary = $5,
           evidence_count = user_understanding.evidence_count + 1,
           confidence = LEAST(1.0, user_understanding.confidence + 0.05),
           updated_at = NOW()`,
        [uuidv7(), userId, orgId, dimension, summary],
      );
    }
  }
}
