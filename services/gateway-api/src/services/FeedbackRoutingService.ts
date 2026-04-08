import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

interface FeedbackSignal {
  id: string;
  feedback_signal: string;
  model_used: string | null;
  skill_used: string | null;
  task_type: string | null;
  confidence_at_response: number | null;
  routing_context: Record<string, unknown>;
  created_at: string;
}

interface RoutingRecommendation {
  model: string;
  positive_rate: number;
  total_signals: number;
  confidence: number;
}

/**
 * Feedback Routing Loop Service.
 *
 * Maps thumbs up/down feedback to models, skills, and task types.
 * Over time builds a routing table: which models/skills work best for which task types.
 * Not fine-tuning — retrieval + routing intelligence.
 */
export class FeedbackRoutingService {
  constructor(private pool: pg.Pool) {}

  /**
   * Record enriched feedback signal with routing context.
   */
  async recordSignal(
    organizationId: string,
    input: {
      feedback_id: string;
      message_id: string;
      chat_id: string;
      feedback_signal: 'up' | 'down';
      model_used?: string;
      skill_used?: string;
      task_type?: string;
      confidence_at_response?: number;
      routing_context?: Record<string, unknown>;
    },
  ): Promise<FeedbackSignal> {
    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO feedback_routing_signals (
        id, organization_id, feedback_id, message_id, chat_id,
        feedback_signal, model_used, skill_used, task_type,
        confidence_at_response, routing_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        id,
        organizationId,
        input.feedback_id,
        input.message_id,
        input.chat_id,
        input.feedback_signal,
        input.model_used?.trim() || null,
        input.skill_used?.trim() || null,
        input.task_type?.trim() || null,
        input.confidence_at_response ?? null,
        JSON.stringify(input.routing_context || {}),
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Get best-performing model for a task type based on feedback history.
   */
  async getModelRecommendations(
    organizationId: string,
    taskType?: string,
    minSignals = 5,
  ): Promise<RoutingRecommendation[]> {
    const conditions = ['organization_id = $1', 'model_used IS NOT NULL'];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (taskType) {
      conditions.push(`task_type = $${idx++}`);
      params.push(taskType.trim());
    }

    const result = await this.pool.query(
      `SELECT
         model_used AS model,
         COUNT(*)::INTEGER AS total_signals,
         COUNT(CASE WHEN feedback_signal = 'up' THEN 1 END)::INTEGER AS positive_count,
         ROUND(
           COUNT(CASE WHEN feedback_signal = 'up' THEN 1 END)::NUMERIC /
           NULLIF(COUNT(*), 0), 3
         ) AS positive_rate
       FROM feedback_routing_signals
       WHERE ${conditions.join(' AND ')}
       GROUP BY model_used
       HAVING COUNT(*) >= $${idx}
       ORDER BY positive_rate DESC, total_signals DESC`,
      [...params, minSignals],
    );

    return result.rows.map((r: any) => ({
      model: r.model,
      positive_rate: parseFloat(r.positive_rate) || 0,
      total_signals: r.total_signals,
      confidence: Math.min(1, r.total_signals / 100), // Higher signal count = higher confidence in recommendation
    }));
  }

  /**
   * Get best-performing skill for a task type.
   */
  async getSkillRecommendations(
    organizationId: string,
    taskType?: string,
    minSignals = 3,
  ): Promise<RoutingRecommendation[]> {
    const conditions = ['organization_id = $1', 'skill_used IS NOT NULL'];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (taskType) {
      conditions.push(`task_type = $${idx++}`);
      params.push(taskType.trim());
    }

    const result = await this.pool.query(
      `SELECT
         skill_used AS model,
         COUNT(*)::INTEGER AS total_signals,
         COUNT(CASE WHEN feedback_signal = 'up' THEN 1 END)::INTEGER AS positive_count,
         ROUND(
           COUNT(CASE WHEN feedback_signal = 'up' THEN 1 END)::NUMERIC /
           NULLIF(COUNT(*), 0), 3
         ) AS positive_rate
       FROM feedback_routing_signals
       WHERE ${conditions.join(' AND ')}
       GROUP BY skill_used
       HAVING COUNT(*) >= $${idx}
       ORDER BY positive_rate DESC, total_signals DESC`,
      [...params, minSignals],
    );

    return result.rows.map((r: any) => ({
      model: r.model,
      positive_rate: parseFloat(r.positive_rate) || 0,
      total_signals: r.total_signals,
      confidence: Math.min(1, r.total_signals / 50),
    }));
  }

  /**
   * Get feedback summary by task type.
   */
  async getTaskTypeSummary(
    organizationId: string,
    days = 30,
  ): Promise<{ task_type: string; total: number; positive_rate: number }[]> {
    const result = await this.pool.query(
      `SELECT
         COALESCE(task_type, 'unclassified') AS task_type,
         COUNT(*)::INTEGER AS total,
         ROUND(
           COUNT(CASE WHEN feedback_signal = 'up' THEN 1 END)::NUMERIC /
           NULLIF(COUNT(*), 0), 3
         ) AS positive_rate
       FROM feedback_routing_signals
       WHERE organization_id = $1
         AND created_at > NOW() - make_interval(days => $2)
       GROUP BY task_type
       ORDER BY total DESC`,
      [organizationId, days],
    );

    return result.rows.map((r: any) => ({
      task_type: r.task_type,
      total: r.total,
      positive_rate: parseFloat(r.positive_rate) || 0,
    }));
  }

  private mapRow(row: any): FeedbackSignal {
    return {
      id: row.id,
      feedback_signal: row.feedback_signal,
      model_used: row.model_used,
      skill_used: row.skill_used,
      task_type: row.task_type,
      confidence_at_response: row.confidence_at_response ? parseFloat(row.confidence_at_response) : null,
      routing_context: row.routing_context || {},
      created_at: row.created_at,
    };
  }
}
