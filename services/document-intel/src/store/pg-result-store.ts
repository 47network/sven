// ---------------------------------------------------------------------------
// Postgres-backed Document Result Store
// ---------------------------------------------------------------------------

import pg from 'pg';
import crypto from 'node:crypto';
import type { OcrResult } from '@sven/document-intel/ocr';
import type { StageResult } from '@sven/document-intel/pipeline';

export interface ResultRecord {
  id: string;
  jobId: string;
  orgId: string;
  ocrFullText: string | null;
  ocrLanguage: string | null;
  ocrAvgConfidence: number | null;
  ocrTotalRegions: number;
  ocrPages: unknown[];
  stages: unknown[];
  processingMs: number;
  createdAt: string;
}

export class PgResultStore {
  constructor(private readonly pool: pg.Pool) {}

  async saveResult(opts: {
    jobId: string;
    orgId: string;
    ocrResult: OcrResult | null;
    stages: StageResult[];
    processingMs: number;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const ocr = opts.ocrResult;
    await this.pool.query(
      `INSERT INTO document_results
         (id, job_id, org_id, ocr_full_text, ocr_language, ocr_avg_confidence,
          ocr_total_regions, ocr_pages, stages, processing_ms, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        id, opts.jobId, opts.orgId,
        ocr?.fullText || null,
        ocr?.language || null,
        ocr?.avgConfidence ?? null,
        ocr?.totalRegions || 0,
        JSON.stringify(ocr?.pages || []),
        JSON.stringify(opts.stages),
        opts.processingMs,
      ],
    );
    return id;
  }

  async getByJob(jobId: string): Promise<ResultRecord | null> {
    const { rows } = await this.pool.query('SELECT * FROM document_results WHERE job_id = $1', [jobId]);
    return rows.length > 0 ? this.rowToResult(rows[0]) : null;
  }

  private rowToResult(row: Record<string, unknown>): ResultRecord {
    return {
      id: row.id as string,
      jobId: row.job_id as string,
      orgId: row.org_id as string,
      ocrFullText: row.ocr_full_text as string | null,
      ocrLanguage: row.ocr_language as string | null,
      ocrAvgConfidence: row.ocr_avg_confidence as number | null,
      ocrTotalRegions: row.ocr_total_regions as number,
      ocrPages: row.ocr_pages as unknown[],
      stages: row.stages as unknown[],
      processingMs: row.processing_ms as number,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
