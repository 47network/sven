// ---------------------------------------------------------------------------
// Postgres-backed Document Summary Store
// ---------------------------------------------------------------------------

import pg from 'pg';
import crypto from 'node:crypto';
import type { DocumentSummary } from '@sven/document-intel/summarizer';

export interface SummaryRecord {
  id: string;
  jobId: string | null;
  orgId: string;
  documentId: string;
  title: string | null;
  summary: string;
  keyPoints: string[];
  style: string;
  wordCount: number;
  originalWordCount: number;
  compressionRatio: number;
  language: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export class PgSummaryStore {
  constructor(private readonly pool: pg.Pool) {}

  async saveSummary(orgId: string, ds: DocumentSummary, jobId?: string): Promise<string> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO document_summaries
         (id, job_id, org_id, document_id, title, summary, key_points, style,
          word_count, original_word_count, compression_ratio, language, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [
        id, jobId || null, orgId, ds.documentId, ds.title, ds.summary,
        JSON.stringify(ds.keyPoints), ds.style, ds.wordCount,
        ds.originalWordCount, ds.compressionRatio, ds.language,
        JSON.stringify(ds.metadata),
      ],
    );
    return id;
  }

  async getByJob(jobId: string): Promise<SummaryRecord | null> {
    const { rows } = await this.pool.query('SELECT * FROM document_summaries WHERE job_id = $1', [jobId]);
    return rows.length > 0 ? this.rowToSummary(rows[0]) : null;
  }

  async listByOrg(orgId: string, limit = 50): Promise<SummaryRecord[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM document_summaries WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2',
      [orgId, limit],
    );
    return rows.map(this.rowToSummary);
  }

  private rowToSummary(row: Record<string, unknown>): SummaryRecord {
    return {
      id: row.id as string,
      jobId: row.job_id as string | null,
      orgId: row.org_id as string,
      documentId: row.document_id as string,
      title: row.title as string | null,
      summary: row.summary as string,
      keyPoints: row.key_points as string[],
      style: row.style as string,
      wordCount: row.word_count as number,
      originalWordCount: row.original_word_count as number,
      compressionRatio: row.compression_ratio as number,
      language: row.language as string,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
