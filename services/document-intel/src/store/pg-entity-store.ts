// ---------------------------------------------------------------------------
// Postgres-backed Document Entity Store
// ---------------------------------------------------------------------------

import pg from 'pg';
import crypto from 'node:crypto';
import type { Entity } from '@sven/document-intel/entities';

export interface EntityRecord {
  id: string;
  jobId: string;
  orgId: string;
  category: string;
  subcategory: string;
  value: string;
  normalised: string;
  confidence: number;
  isPii: boolean;
  redacted: boolean;
  sourceText: string | null;
  position: unknown | null;
  createdAt: string;
}

export class PgEntityStore {
  constructor(private readonly pool: pg.Pool) {}

  async bulkInsert(jobId: string, orgId: string, entities: Entity[], redacted: boolean): Promise<number> {
    if (entities.length === 0) return 0;

    const ids: string[] = [];
    const jobIds: string[] = [];
    const orgIds: string[] = [];
    const categories: string[] = [];
    const subcategories: string[] = [];
    const values: string[] = [];
    const normaliseds: string[] = [];
    const confidences: number[] = [];
    const isPiis: boolean[] = [];
    const redacteds: boolean[] = [];
    const sourceTexts: (string | null)[] = [];
    const positions: (string | null)[] = [];

    for (const e of entities) {
      ids.push(crypto.randomUUID());
      jobIds.push(jobId);
      orgIds.push(orgId);
      categories.push(e.category);
      subcategories.push(e.subcategory);
      values.push(e.value);
      normaliseds.push(e.normalised);
      confidences.push(e.confidence);
      isPiis.push(e.isPii);
      redacteds.push(redacted);
      sourceTexts.push(e.sourceText || null);
      positions.push(e.position ? JSON.stringify(e.position) : null);
    }

    await this.pool.query(
      `INSERT INTO document_entities
         (id, job_id, org_id, category, subcategory, value, normalised, confidence, is_pii, redacted, source_text, position)
       SELECT * FROM UNNEST(
         $1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::text[], $6::text[],
         $7::text[], $8::numeric[], $9::boolean[], $10::boolean[], $11::text[], $12::jsonb[]
       )`,
      [ids, jobIds, orgIds, categories, subcategories, values, normaliseds, confidences, isPiis, redacteds, sourceTexts, positions],
    );

    return entities.length;
  }

  async listByJob(jobId: string): Promise<EntityRecord[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM document_entities WHERE job_id = $1 ORDER BY created_at',
      [jobId],
    );
    return rows.map(this.rowToEntity);
  }

  async listPiiByOrg(orgId: string, limit = 100): Promise<EntityRecord[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM document_entities WHERE org_id = $1 AND is_pii = TRUE ORDER BY created_at DESC LIMIT $2',
      [orgId, limit],
    );
    return rows.map(this.rowToEntity);
  }

  async getCategoryCounts(orgId: string): Promise<Record<string, number>> {
    const { rows } = await this.pool.query(
      'SELECT category, COUNT(*)::int AS count FROM document_entities WHERE org_id = $1 GROUP BY category ORDER BY count DESC',
      [orgId],
    );
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.category as string] = r.count as number;
    return counts;
  }

  private rowToEntity(row: Record<string, unknown>): EntityRecord {
    return {
      id: row.id as string,
      jobId: row.job_id as string,
      orgId: row.org_id as string,
      category: row.category as string,
      subcategory: row.subcategory as string,
      value: row.value as string,
      normalised: row.normalised as string,
      confidence: row.confidence as number,
      isPii: row.is_pii as boolean,
      redacted: row.redacted as boolean,
      sourceText: row.source_text as string | null,
      position: row.position,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
