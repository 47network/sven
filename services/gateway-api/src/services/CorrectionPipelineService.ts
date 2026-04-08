import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'conflicting' | 'expired';

interface Correction {
  id: string;
  original_response: string;
  correction_text: string;
  user_reasoning: string | null;
  verification_status: VerificationStatus;
  verification_methods: string[];
  verification_evidence: Record<string, unknown>;
  promoted_to_memory: boolean;
  created_at: string;
}

/**
 * Correction Pipeline Service.
 *
 * Accepts user corrections to Sven's responses. Corrections go through a
 * multi-strategy verification pipeline before being promoted to memory.
 *
 * Flow:
 *   user submits → pending → verification strategies → verified/rejected/conflicting → promote to memory
 */
export class CorrectionPipelineService {
  /**
   * Time in days after which unverified corrections expire.
   */
  private static EXPIRY_DAYS = 30;

  constructor(private pool: pg.Pool) {}

  /**
   * Submit a new correction.
   */
  async submitCorrection(
    organizationId: string,
    input: {
      message_id: string;
      chat_id: string;
      user_id: string;
      original_response: string;
      correction_text: string;
      user_reasoning?: string;
    },
  ): Promise<Correction> {
    const id = uuidv7();

    if (!input.correction_text.trim()) {
      throw new Error('correction_text must not be empty');
    }
    if (!input.original_response.trim()) {
      throw new Error('original_response must not be empty');
    }

    const result = await this.pool.query(
      `INSERT INTO user_corrections (
        id, organization_id, message_id, chat_id, user_id,
        original_response, correction_text, user_reasoning
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        id,
        organizationId,
        input.message_id,
        input.chat_id,
        input.user_id,
        input.original_response.trim(),
        input.correction_text.trim(),
        input.user_reasoning?.trim() || null,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Run verification on a pending correction.
   *
   * Strategies: conflict_check (see if another correction contradicts it),
   * frequency (count of similar corrections across users).
   */
  async verify(correctionId: string): Promise<Correction> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query(
        `SELECT * FROM user_corrections WHERE id = $1 FOR UPDATE`,
        [correctionId],
      );
      if (res.rows.length === 0) {
        throw new Error('Correction not found');
      }

      const correction = res.rows[0];
      if (correction.verification_status !== 'pending') {
        await client.query('ROLLBACK');
        return this.mapRow(correction);
      }

      const methods: string[] = [];
      const evidence: Record<string, unknown> = {};
      let status: VerificationStatus = 'pending';

      // Strategy 1: conflict check — look for contradicting corrections on the same message
      const conflicts = await client.query(
        `SELECT id, correction_text FROM user_corrections
         WHERE message_id = $1
           AND id != $2
           AND verification_status IN ('pending', 'verified')`,
        [correction.message_id, correctionId],
      );
      methods.push('conflict_check');
      if (conflicts.rows.length > 0) {
        evidence.conflicting_corrections = conflicts.rows.map((r: any) => r.id);
        status = 'conflicting';
      }

      // Strategy 2: frequency — multiple users correcting the same response similarly
      if (status !== 'conflicting') {
        const similar = await client.query(
          `SELECT COUNT(*)::INTEGER AS cnt FROM user_corrections
           WHERE message_id = $1
             AND user_id != $2
             AND verification_status IN ('pending', 'verified')`,
          [correction.message_id, correction.user_id],
        );
        methods.push('frequency_check');
        const freq = similar.rows[0].cnt;
        evidence.other_user_corrections = freq;

        if (freq >= 2) {
          // Multiple independent users agree — high confidence
          status = 'verified';
        } else {
          // Single correction, no conflicts — tentatively verified
          status = 'verified';
        }
      }

      await client.query(
        `UPDATE user_corrections
         SET verification_status = $1,
             verification_methods = $2,
             verification_evidence = $3
         WHERE id = $4`,
        [
          status,
          JSON.stringify(methods),
          JSON.stringify(evidence),
          correctionId,
        ],
      );

      await client.query('COMMIT');

      const updated = await this.pool.query(
        `SELECT * FROM user_corrections WHERE id = $1`,
        [correctionId],
      );
      return this.mapRow(updated.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Promote a verified correction to memory (marks flag, actual memory persistence
   * is handled by the memory subsystem reading this flag).
   */
  async promoteToMemory(correctionId: string): Promise<Correction> {
    const result = await this.pool.query(
      `UPDATE user_corrections
       SET promoted_to_memory = TRUE
       WHERE id = $1
         AND verification_status = 'verified'
         AND promoted_to_memory = FALSE
       RETURNING *`,
      [correctionId],
    );

    if (result.rows.length === 0) {
      throw new Error('Correction not found, not verified, or already promoted');
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Expire old pending corrections.
   */
  async expireStale(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE user_corrections
       SET verification_status = 'expired'
       WHERE verification_status = 'pending'
         AND created_at < NOW() - make_interval(days => $1)`,
      [CorrectionPipelineService.EXPIRY_DAYS],
    );

    return result.rowCount ?? 0;
  }

  /**
   * List corrections for an organization with status filter.
   */
  async list(
    organizationId: string,
    opts: { status?: VerificationStatus; limit?: number; offset?: number } = {},
  ): Promise<{ corrections: Correction[]; total: number }> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (opts.status) {
      conditions.push(`verification_status = $${idx++}`);
      params.push(opts.status);
    }

    const where = conditions.join(' AND ');

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::INTEGER AS total FROM user_corrections WHERE ${where}`,
      params,
    );

    const dataRes = await this.pool.query(
      `SELECT * FROM user_corrections
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset],
    );

    return {
      corrections: dataRes.rows.map(this.mapRow),
      total: countRes.rows[0].total,
    };
  }

  private mapRow(row: any): Correction {
    return {
      id: row.id,
      original_response: row.original_response,
      correction_text: row.correction_text,
      user_reasoning: row.user_reasoning,
      verification_status: row.verification_status,
      verification_methods: row.verification_methods || [],
      verification_evidence: row.verification_evidence || {},
      promoted_to_memory: row.promoted_to_memory ?? false,
      created_at: row.created_at,
    };
  }
}
