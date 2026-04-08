import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

interface ModerationResult {
  decision: 'auto_approve' | 'flag_for_review' | 'reject';
  risk_score: number;
  risk_factors: string[];
  explanation: string;
}

/**
 * Smart Agent Moderator.
 * Intelligently filters agent posts using heuristic risk scoring.
 * Simple/safe posts → auto-published.
 * Risky/uncertain posts → flagged for admin review with explanation.
 *
 * Risk factors:
 * - Content length anomaly (too short or excessive)
 * - External URLs or link spam
 * - Mentions of sensitive topics (financial, medical, legal)
 * - Code execution suggestions
 * - Repetitive content (same agent posting similar content)
 * - Aggressive or hostile tone markers
 */
export class AgentModeratorService {
  private static readonly AUTO_APPROVE_THRESHOLD = 0.3;
  private static readonly FLAG_THRESHOLD = 0.7;

  constructor(private pool: pg.Pool) {}

  async moderatePost(
    organizationId: string,
    agentId: string,
    postLogId: string,
    content: string,
  ): Promise<ModerationResult> {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Factor 1: Content length anomaly
    if (content.length < 10) {
      riskFactors.push('content_too_short');
      riskScore += 0.2;
    } else if (content.length > 5000) {
      riskFactors.push('content_excessive_length');
      riskScore += 0.1;
    }

    // Factor 2: External URLs
    const urlCount = (content.match(/https?:\/\/[^\s]+/gi) || []).length;
    if (urlCount > 3) {
      riskFactors.push('excessive_urls');
      riskScore += 0.3;
    } else if (urlCount > 0) {
      riskFactors.push('contains_urls');
      riskScore += 0.05;
    }

    // Factor 3: Sensitive topic markers
    const sensitivePatterns = [
      { pattern: /\b(invest|financial|trading|crypto|stock|bitcoin)\b/i, label: 'financial_advice' },
      { pattern: /\b(diagnos|medical|prescription|symptom|treatment|dosage)\b/i, label: 'medical_content' },
      { pattern: /\b(legal|lawyer|lawsuit|court|litigation|attorney)\b/i, label: 'legal_content' },
      { pattern: /\b(password|credential|secret|api[_-]?key|token)\b/i, label: 'credential_content' },
    ];
    for (const { pattern, label } of sensitivePatterns) {
      if (pattern.test(content)) {
        riskFactors.push(label);
        riskScore += 0.25;
      }
    }

    // Factor 4: Code execution suggestions
    if (/\b(sudo|rm\s+-rf|eval\(|exec\(|DROP\s+TABLE|DELETE\s+FROM)\b/i.test(content)) {
      riskFactors.push('dangerous_code_suggestion');
      riskScore += 0.5;
    }

    // Factor 5: Repetitive content (check against recent posts by same agent)
    const recentPosts = await this.pool.query(
      `SELECT content_preview FROM agent_post_log
       WHERE agent_id = $1 AND organization_id = $2
         AND created_at > NOW() - INTERVAL '1 hour'
         AND content_preview IS NOT NULL
       ORDER BY created_at DESC LIMIT 5`,
      [agentId, organizationId],
    );
    const preview = content.slice(0, 500);
    for (const row of recentPosts.rows) {
      if (row.content_preview && this.similarity(preview, row.content_preview) > 0.8) {
        riskFactors.push('repetitive_content');
        riskScore += 0.3;
        break;
      }
    }

    // Factor 6: Hostile tone markers
    if (/\b(stupid|idiot|dumb|hate|kill|destroy|attack)\b/i.test(content)) {
      riskFactors.push('hostile_tone');
      riskScore += 0.4;
    }

    // Clamp
    riskScore = Math.min(riskScore, 1.0);

    // Decide
    let decision: ModerationResult['decision'];
    let explanation: string;

    if (riskScore <= AgentModeratorService.AUTO_APPROVE_THRESHOLD) {
      decision = 'auto_approve';
      explanation = 'Low risk content — auto-approved';
    } else if (riskScore >= AgentModeratorService.FLAG_THRESHOLD) {
      decision = 'reject';
      explanation = `High risk (${riskScore.toFixed(2)}): ${riskFactors.join(', ')}`;
    } else {
      decision = 'flag_for_review';
      explanation = `Medium risk (${riskScore.toFixed(2)}): ${riskFactors.join(', ')}. Flagged for admin review`;
    }

    // Persist decision
    await this.pool.query(
      `INSERT INTO agent_moderation_decisions (
        id, organization_id, post_log_id, agent_id, decision,
        risk_score, risk_factors, explanation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uuidv7(),
        organizationId,
        postLogId,
        agentId,
        decision,
        riskScore,
        JSON.stringify(riskFactors),
        explanation,
      ],
    );

    // Update post log
    const moderationStatus = decision === 'auto_approve' ? 'auto_approved' : 'pending';
    await this.pool.query(
      `UPDATE agent_post_log SET moderation_status = $2, risk_score = $3, moderation_reason = $4
       WHERE id = $1`,
      [postLogId, moderationStatus, riskScore, explanation],
    );

    return { decision, risk_score: riskScore, risk_factors: riskFactors, explanation };
  }

  async reviewDecision(
    organizationId: string,
    decisionId: string,
    reviewedBy: string,
    finalDecision: 'approved' | 'rejected',
  ): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE agent_moderation_decisions
       SET reviewed_by = $3, reviewed_at = NOW(), final_decision = $4
       WHERE id = $1 AND organization_id = $2 AND final_decision IS NULL
       RETURNING post_log_id`,
      [decisionId, organizationId, reviewedBy, finalDecision],
    );
    if (!result.rows[0]) return false;

    // Update the post log status
    const postStatus = finalDecision === 'approved' ? 'approved' : 'rejected';
    await this.pool.query(
      `UPDATE agent_post_log SET moderation_status = $2 WHERE id = $1`,
      [result.rows[0].post_log_id, postStatus],
    );

    return true;
  }

  async getPendingReviews(
    organizationId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ decisions: any[]; total: number }> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const safeOffset = Math.max(offset, 0);

    const [data, count] = await Promise.all([
      this.pool.query(
        `SELECT d.*, p.content_preview, p.post_type, p.agent_id,
                a.persona_display_name, a.agent_persona_type
         FROM agent_moderation_decisions d
         JOIN agent_post_log p ON d.post_log_id = p.id
         LEFT JOIN agent_personas a ON d.agent_id = a.id
         WHERE d.organization_id = $1
           AND d.decision = 'flag_for_review'
           AND d.final_decision IS NULL
         ORDER BY d.created_at DESC
         LIMIT $2 OFFSET $3`,
        [organizationId, safeLimit, safeOffset],
      ),
      this.pool.query(
        `SELECT COUNT(*)::INTEGER AS total FROM agent_moderation_decisions
         WHERE organization_id = $1 AND decision = 'flag_for_review' AND final_decision IS NULL`,
        [organizationId],
      ),
    ]);

    return { decisions: data.rows, total: count.rows[0]?.total || 0 };
  }

  /**
   * Simple trigram-like similarity for detecting repetitive content.
   * Not a full NLP comparison — just enough for spam detection.
   */
  private similarity(a: string, b: string): number {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 1.0;
    if (!na || !nb) return 0.0;

    const wordsA = new Set(na.split(/\s+/));
    const wordsB = new Set(nb.split(/\s+/));
    const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union > 0 ? intersection / union : 0;
  }
}
