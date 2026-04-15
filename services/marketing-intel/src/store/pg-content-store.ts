import pg from 'pg';
import type { ContentPiece, ContentBrief, ContentPerformance } from '@sven/marketing-intel/content-generator';

export interface ContentRow {
  id: string;
  org_id: string;
  brief_id: string | null;
  content_type: string;
  channel: string;
  title: string;
  status: string;
  body: string | null;
  brief: ContentBrief | null;
  brand_score: number | null;
  performance: ContentPerformance | null;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
}

export class PgContentStore {
  constructor(private readonly pool: pg.Pool) {}

  async save(orgId: string, piece: ContentPiece): Promise<void> {
    await this.pool.query(
      `INSERT INTO marketing_content (id, org_id, brief_id, content_type, channel, title, status, body, brief, brand_score, scheduled_for, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [piece.id, orgId, piece.briefId, piece.contentType, piece.channel, piece.title, piece.status, piece.body, JSON.stringify(piece.brief), piece.brandCheckScore, piece.scheduledFor, piece.publishedAt],
    );
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const updates: string[] = [`status = $2`];
    const values: unknown[] = [id, status];
    if (status === 'published') {
      updates.push(`published_at = NOW()`);
    }
    await this.pool.query(`UPDATE marketing_content SET ${updates.join(', ')} WHERE id = $1`, values);
  }

  async updateBrandScore(id: string, score: number): Promise<void> {
    await this.pool.query(`UPDATE marketing_content SET brand_score = $2 WHERE id = $1`, [id, score]);
  }

  async listByOrg(orgId: string, limit = 50): Promise<ContentRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_content WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows;
  }

  async getById(id: string): Promise<ContentRow | null> {
    const { rows } = await this.pool.query(`SELECT * FROM marketing_content WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async listByChannel(orgId: string, channel: string, limit = 50): Promise<ContentRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_content WHERE org_id = $1 AND channel = $2 ORDER BY created_at DESC LIMIT $3`,
      [orgId, channel, limit],
    );
    return rows;
  }
}
