import pg from 'pg';
import type { BrandCheckResult } from '@sven/marketing-intel/brand-voice';

export interface BrandCheckRow {
  id: string;
  org_id: string;
  content_snippet: string;
  score: number;
  grade: string;
  violations: BrandCheckResult['violations'];
  suggestions: string[];
  tone_analysis: BrandCheckResult['toneAnalysis'];
  key_msg_hits: BrandCheckResult['keyMessageCoverage'];
  profile_name: string;
  created_at: string;
}

export class PgBrandCheckStore {
  constructor(private readonly pool: pg.Pool) {}

  async save(orgId: string, contentSnippet: string, result: BrandCheckResult, profileName = '47Network'): Promise<string> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO marketing_brand_checks (id, org_id, content_snippet, score, grade, violations, suggestions, tone_analysis, key_msg_hits, profile_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, orgId, contentSnippet.slice(0, 500), result.score, result.grade, JSON.stringify(result.violations), JSON.stringify(result.suggestions), JSON.stringify(result.toneAnalysis), JSON.stringify(result.keyMessageCoverage), profileName],
    );
    return id;
  }

  async listByOrg(orgId: string, limit = 50): Promise<BrandCheckRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_brand_checks WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows;
  }

  async getAvgScore(orgId: string): Promise<number> {
    const { rows } = await this.pool.query(
      `SELECT COALESCE(AVG(score), 0) AS avg_score FROM marketing_brand_checks WHERE org_id = $1`,
      [orgId],
    );
    return parseFloat(rows[0].avg_score);
  }
}
