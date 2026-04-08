import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

interface ConfidenceFactors {
  rag_relevance_score?: number;
  memory_recency_score?: number;
  tool_success_score?: number;
  model_uncertainty_score?: number;
  [key: string]: number | undefined;
}

interface ResponseConfidence {
  id: string;
  message_id: string;
  chat_id: string;
  overall_confidence: number;
  factors: ConfidenceFactors;
  disclosed_to_user: boolean;
  created_at: string;
}

interface ConfidenceCalibration {
  avg_confidence: number;
  avg_confidence_when_correct: number;
  avg_confidence_when_incorrect: number;
  calibration_error: number;
  total_scored: number;
  low_confidence_count: number;
}

/**
 * Confidence Scoring Service.
 *
 * Every response gets an internal confidence score (0-1) based on:
 * - RAG chunk relevance (similarity scores from retrieval)
 * - Memory recency (how recent matched memories are)
 * - Tool call success history (recent tool success/failure ratio)
 * - Model uncertainty signals (perplexity, token probs if available)
 *
 * When confidence < threshold, triggers uncertainty disclosure.
 */
export class ConfidenceScoringService {
  private static readonly DISCLOSURE_THRESHOLD = 0.5;
  private static readonly LOW_CONFIDENCE_THRESHOLD = 0.3;

  constructor(private pool: pg.Pool) {}

  /**
   * Compute and store confidence score for a response.
   */
  async scoreResponse(
    organizationId: string,
    messageId: string,
    chatId: string,
    factors: ConfidenceFactors,
  ): Promise<ResponseConfidence> {
    const overall = this.computeOverallConfidence(factors);
    const shouldDisclose = overall < ConfidenceScoringService.DISCLOSURE_THRESHOLD;

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO response_confidence (
        id, organization_id, message_id, chat_id,
        overall_confidence, rag_relevance_score, memory_recency_score,
        tool_success_score, model_uncertainty_score, factors,
        disclosed_to_user
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        id,
        organizationId,
        messageId,
        chatId,
        overall,
        factors.rag_relevance_score ?? null,
        factors.memory_recency_score ?? null,
        factors.tool_success_score ?? null,
        factors.model_uncertainty_score ?? null,
        JSON.stringify(factors),
        shouldDisclose,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Get confidence for a specific message.
   */
  async getConfidence(organizationId: string, messageId: string): Promise<ResponseConfidence | null> {
    const result = await this.pool.query(
      `SELECT * FROM response_confidence WHERE message_id = $1 AND organization_id = $2`,
      [messageId, organizationId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Check if response should include uncertainty disclosure.
   */
  shouldDisclose(overallConfidence: number): boolean {
    return overallConfidence < ConfidenceScoringService.DISCLOSURE_THRESHOLD;
  }

  /**
   * Generate uncertainty disclosure text for low-confidence responses.
   */
  generateDisclosureText(confidence: number, factors: ConfidenceFactors): string {
    const parts: string[] = [];

    if (confidence < ConfidenceScoringService.LOW_CONFIDENCE_THRESHOLD) {
      parts.push("I'm not very confident about this response.");
    } else {
      parts.push("I'm somewhat uncertain about parts of this response.");
    }

    if (factors.rag_relevance_score !== undefined && factors.rag_relevance_score < 0.4) {
      parts.push("I couldn't find highly relevant information in my knowledge base.");
    }
    if (factors.memory_recency_score !== undefined && factors.memory_recency_score < 0.3) {
      parts.push('My relevant memories on this topic are quite old.');
    }
    if (factors.tool_success_score !== undefined && factors.tool_success_score < 0.5) {
      parts.push('Some of my tool calls had issues.');
    }

    parts.push('You may want to verify this independently.');
    return parts.join(' ');
  }

  /**
   * Get confidence calibration metrics for an org.
   * Compares confidence scores against feedback signals.
   */
  async getCalibrationMetrics(
    organizationId: string,
    days = 30,
  ): Promise<ConfidenceCalibration> {
    const result = await this.pool.query(
      `SELECT
         COUNT(*)::INTEGER AS total_scored,
         AVG(rc.overall_confidence) AS avg_confidence,
         AVG(CASE WHEN frs.feedback_signal = 'up' THEN rc.overall_confidence END) AS avg_when_correct,
         AVG(CASE WHEN frs.feedback_signal = 'down' THEN rc.overall_confidence END) AS avg_when_incorrect,
         COUNT(CASE WHEN rc.overall_confidence < 0.5 THEN 1 END)::INTEGER AS low_confidence_count
       FROM response_confidence rc
       LEFT JOIN feedback_routing_signals frs
         ON rc.message_id = frs.message_id AND rc.organization_id = frs.organization_id
       WHERE rc.organization_id = $1
         AND rc.created_at > NOW() - make_interval(days => $2)`,
      [organizationId, days],
    );

    const row = result.rows[0] || {};
    const avgCorrect = parseFloat(row.avg_when_correct) || 0;
    const avgIncorrect = parseFloat(row.avg_when_incorrect) || 0;

    return {
      avg_confidence: parseFloat(row.avg_confidence) || 0,
      avg_confidence_when_correct: avgCorrect,
      avg_confidence_when_incorrect: avgIncorrect,
      calibration_error: Math.abs(avgCorrect - avgIncorrect),
      total_scored: row.total_scored || 0,
      low_confidence_count: row.low_confidence_count || 0,
    };
  }

  /**
   * Get recent low-confidence responses for review.
   */
  async getLowConfidenceResponses(
    organizationId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ responses: ResponseConfidence[]; total: number }> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);

    const [data, count] = await Promise.all([
      this.pool.query(
        `SELECT * FROM response_confidence
         WHERE organization_id = $1 AND overall_confidence < $2
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [organizationId, ConfidenceScoringService.DISCLOSURE_THRESHOLD, safeLimit, safeOffset],
      ),
      this.pool.query(
        `SELECT COUNT(*)::INTEGER AS total FROM response_confidence
         WHERE organization_id = $1 AND overall_confidence < $2`,
        [organizationId, ConfidenceScoringService.DISCLOSURE_THRESHOLD],
      ),
    ]);

    return {
      responses: data.rows.map((r: any) => this.mapRow(r)),
      total: count.rows[0]?.total || 0,
    };
  }

  /**
   * Weighted average confidence computation.
   * Weights: RAG=0.35, Memory=0.25, Tool=0.2, Model=0.2
   */
  private computeOverallConfidence(factors: ConfidenceFactors): number {
    const weights = {
      rag_relevance_score: 0.35,
      memory_recency_score: 0.25,
      tool_success_score: 0.20,
      model_uncertainty_score: 0.20,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [key, weight] of Object.entries(weights)) {
      const value = factors[key];
      if (value !== undefined && value !== null) {
        const clamped = Math.max(0, Math.min(1, value));
        weightedSum += clamped * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return 0.5; // Default neutral when no signals
    return Math.max(0, Math.min(1, weightedSum / totalWeight));
  }

  private mapRow(row: any): ResponseConfidence {
    return {
      id: row.id,
      message_id: row.message_id,
      chat_id: row.chat_id,
      overall_confidence: parseFloat(row.overall_confidence) || 0,
      factors: row.factors || {},
      disclosed_to_user: row.disclosed_to_user,
      created_at: row.created_at,
    };
  }
}
