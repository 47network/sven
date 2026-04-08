import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

type PatternType =
  | 'repeated_question'
  | 'common_struggle'
  | 'unexpected_workflow'
  | 'feature_request'
  | 'recurring_error'
  | 'expertise_gap';

type PatternStatus = 'observed' | 'confirmed' | 'actioned' | 'dismissed';

interface ObservedPattern {
  id: string;
  pattern_type: PatternType;
  title: string;
  description: string;
  occurrence_count: number;
  evidence: unknown[];
  status: PatternStatus;
  created_at: string;
  updated_at: string;
}

const VALID_PATTERN_TYPES: ReadonlySet<string> = new Set([
  'repeated_question',
  'common_struggle',
  'unexpected_workflow',
  'feature_request',
  'recurring_error',
  'expertise_gap',
]);

const VALID_STATUSES: ReadonlySet<string> = new Set([
  'observed',
  'confirmed',
  'actioned',
  'dismissed',
]);

/**
 * Pattern Observation Service.
 *
 * Detects and records recurring user patterns so Sven can learn organically:
 * - "This question keeps coming up" → document or improve
 * - "Users struggle with X" → adapt approach
 * - "Unexpected workflow discovered" → expand coverage
 */
export class PatternObservationService {
  constructor(private pool: pg.Pool) {}

  /**
   * Record a new pattern or increment if a matching pattern already exists.
   *
   * Deduplication is by (organization_id, pattern_type, title).
   * If a match is found, occurrence_count increments and evidence appends.
   */
  async observe(
    organizationId: string,
    input: {
      pattern_type: PatternType;
      title: string;
      description: string;
      evidence_item?: Record<string, unknown>;
    },
  ): Promise<ObservedPattern> {
    if (!VALID_PATTERN_TYPES.has(input.pattern_type)) {
      throw new Error(`Invalid pattern_type: ${input.pattern_type}`);
    }

    const title = input.title.trim();
    if (!title) throw new Error('title must not be empty');

    // Try to find existing matching pattern
    const existing = await this.pool.query(
      `SELECT id, evidence, occurrence_count FROM observed_patterns
       WHERE organization_id = $1
         AND pattern_type = $2
         AND LOWER(title) = LOWER($3)
         AND status NOT IN ('dismissed')
       LIMIT 1`,
      [organizationId, input.pattern_type, title],
    );

    const evidenceItem = input.evidence_item || {};

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const updatedEvidence = [...(row.evidence || []), evidenceItem];
      const updatedCount = row.occurrence_count + 1;

      // Auto-confirm after enough observations
      const newStatus = updatedCount >= 5 ? 'confirmed' : undefined;

      const updateParts = [
        'occurrence_count = $2',
        'evidence = $3',
        'updated_at = NOW()',
      ];
      const params: unknown[] = [row.id, updatedCount, JSON.stringify(updatedEvidence)];
      let idx = 4;

      if (newStatus) {
        updateParts.push(`status = $${idx++}`);
        params.push(newStatus);
      }

      await this.pool.query(
        `UPDATE observed_patterns SET ${updateParts.join(', ')} WHERE id = $1`,
        params,
      );

      const result = await this.pool.query(
        `SELECT * FROM observed_patterns WHERE id = $1`,
        [row.id],
      );
      return this.mapRow(result.rows[0]);
    }

    // Create new pattern observation
    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO observed_patterns (
        id, organization_id, pattern_type, title, description,
        occurrence_count, evidence, status
      ) VALUES ($1, $2, $3, $4, $5, 1, $6, 'observed')
      RETURNING *`,
      [
        id,
        organizationId,
        input.pattern_type,
        title,
        input.description.trim(),
        JSON.stringify([evidenceItem]),
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Update pattern status.
   */
  async updateStatus(
    patternId: string,
    status: PatternStatus,
  ): Promise<ObservedPattern> {
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const result = await this.pool.query(
      `UPDATE observed_patterns
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, patternId],
    );

    if (result.rows.length === 0) {
      throw new Error('Pattern not found');
    }
    return this.mapRow(result.rows[0]);
  }

  /**
   * List patterns for an organization with optional filters.
   */
  async list(
    organizationId: string,
    opts: {
      type?: PatternType;
      status?: PatternStatus;
      minOccurrences?: number;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ patterns: ObservedPattern[]; total: number }> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (opts.type) {
      conditions.push(`pattern_type = $${idx++}`);
      params.push(opts.type);
    }
    if (opts.status) {
      conditions.push(`status = $${idx++}`);
      params.push(opts.status);
    }
    if (opts.minOccurrences) {
      conditions.push(`occurrence_count >= $${idx++}`);
      params.push(opts.minOccurrences);
    }

    const where = conditions.join(' AND ');

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::INTEGER AS total FROM observed_patterns WHERE ${where}`,
      params,
    );

    const dataRes = await this.pool.query(
      `SELECT * FROM observed_patterns
       WHERE ${where}
       ORDER BY occurrence_count DESC, updated_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset],
    );

    return {
      patterns: dataRes.rows.map(this.mapRow),
      total: countRes.rows[0].total,
    };
  }

  /**
   * Get daily self-improvement snapshot.
   */
  async getSelfImprovementSnapshot(
    organizationId: string,
    days = 7,
  ): Promise<unknown[]> {
    const result = await this.pool.query(
      `SELECT * FROM self_improvement_snapshots
       WHERE organization_id = $1
         AND snapshot_date > CURRENT_DATE - make_interval(days => $2)
       ORDER BY snapshot_date DESC`,
      [organizationId, days],
    );
    return result.rows;
  }

  /**
   * Record daily self-improvement snapshot.
   */
  async recordSnapshot(
    organizationId: string,
    metrics: {
      corrections_received: number;
      corrections_verified: number;
      avg_confidence: number;
      calibration_error: number;
      positive_feedback_count: number;
      negative_feedback_count: number;
      patterns_observed: number;
      patterns_actioned: number;
    },
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO self_improvement_snapshots (
        id, organization_id, snapshot_date,
        corrections_received, corrections_verified,
        avg_confidence, calibration_error,
        positive_feedback_count, negative_feedback_count,
        patterns_observed, patterns_actioned
      ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (organization_id, snapshot_date) DO UPDATE SET
        corrections_received = EXCLUDED.corrections_received,
        corrections_verified = EXCLUDED.corrections_verified,
        avg_confidence = EXCLUDED.avg_confidence,
        calibration_error = EXCLUDED.calibration_error,
        positive_feedback_count = EXCLUDED.positive_feedback_count,
        negative_feedback_count = EXCLUDED.negative_feedback_count,
        patterns_observed = EXCLUDED.patterns_observed,
        patterns_actioned = EXCLUDED.patterns_actioned`,
      [
        uuidv7(),
        organizationId,
        metrics.corrections_received,
        metrics.corrections_verified,
        metrics.avg_confidence,
        metrics.calibration_error,
        metrics.positive_feedback_count,
        metrics.negative_feedback_count,
        metrics.patterns_observed,
        metrics.patterns_actioned,
      ],
    );
  }

  private mapRow(row: any): ObservedPattern {
    return {
      id: row.id,
      pattern_type: row.pattern_type,
      title: row.title,
      description: row.description,
      occurrence_count: row.occurrence_count,
      evidence: row.evidence || [],
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
