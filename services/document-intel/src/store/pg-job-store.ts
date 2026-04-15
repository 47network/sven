// ---------------------------------------------------------------------------
// Postgres-backed Document Job Store
// ---------------------------------------------------------------------------

import pg from 'pg';
import crypto from 'node:crypto';

export interface JobRecord {
  id: string;
  orgId: string;
  userId: string | null;
  fileName: string;
  mimeType: string;
  docType: string;
  status: string;
  stage: string;
  piiSafe: boolean;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
}

export class PgJobStore {
  constructor(private readonly pool: pg.Pool) {}

  async createJob(opts: {
    orgId: string;
    userId?: string;
    fileName: string;
    mimeType: string;
    docType: string;
    piiSafe: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO document_jobs (id, org_id, user_id, file_name, mime_type, doc_type, status, stage, pii_safe, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'running', 'ocr', $7, $8, NOW())`,
      [id, opts.orgId, opts.userId || null, opts.fileName, opts.mimeType, opts.docType, opts.piiSafe, JSON.stringify(opts.metadata || {})],
    );
    return id;
  }

  async updateStage(jobId: string, stage: string): Promise<void> {
    await this.pool.query('UPDATE document_jobs SET stage = $2 WHERE id = $1', [jobId, stage]);
  }

  async completeJob(jobId: string): Promise<void> {
    await this.pool.query(
      `UPDATE document_jobs SET status = 'completed', stage = 'done', completed_at = NOW() WHERE id = $1`,
      [jobId],
    );
  }

  async failJob(jobId: string, errorMessage: string): Promise<void> {
    await this.pool.query(
      `UPDATE document_jobs SET status = 'failed', stage = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`,
      [jobId, errorMessage],
    );
  }

  async getJob(jobId: string): Promise<JobRecord | null> {
    const { rows } = await this.pool.query('SELECT * FROM document_jobs WHERE id = $1', [jobId]);
    return rows.length > 0 ? this.rowToJob(rows[0]) : null;
  }

  async listJobs(orgId: string, limit = 50, offset = 0): Promise<JobRecord[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM document_jobs WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [orgId, limit, offset],
    );
    return rows.map(this.rowToJob);
  }

  async getStats(orgId: string): Promise<{
    totalJobs: number;
    byStatus: Record<string, number>;
    byDocType: Record<string, number>;
  }> {
    const total = await this.pool.query(
      'SELECT COUNT(*)::int AS count FROM document_jobs WHERE org_id = $1', [orgId],
    );
    const byStatus = await this.pool.query(
      'SELECT status, COUNT(*)::int AS count FROM document_jobs WHERE org_id = $1 GROUP BY status', [orgId],
    );
    const byDocType = await this.pool.query(
      'SELECT doc_type, COUNT(*)::int AS count FROM document_jobs WHERE org_id = $1 GROUP BY doc_type', [orgId],
    );
    return {
      totalJobs: total.rows[0]?.count || 0,
      byStatus: Object.fromEntries(byStatus.rows.map((r: Record<string, unknown>) => [r.status, r.count])),
      byDocType: Object.fromEntries(byDocType.rows.map((r: Record<string, unknown>) => [r.doc_type, r.count])),
    };
  }

  private rowToJob(row: Record<string, unknown>): JobRecord {
    return {
      id: row.id as string,
      orgId: row.org_id as string,
      userId: row.user_id as string | null,
      fileName: row.file_name as string,
      mimeType: row.mime_type as string,
      docType: row.doc_type as string,
      status: row.status as string,
      stage: row.stage as string,
      piiSafe: row.pii_safe as boolean,
      errorMessage: row.error_message as string | null,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: (row.created_at as Date).toISOString(),
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
    };
  }
}
