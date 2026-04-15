import pg from 'pg';
import type { Campaign, CampaignPerformance } from '@sven/marketing-intel/campaign-planner';

export interface CampaignRow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: string;
  goals: Campaign['goals'];
  budget: Campaign['budget'];
  channels: string[];
  target_audience: string | null;
  score: number | null;
  performance: CampaignPerformance | null;
  content_ids: string[];
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export class PgCampaignStore {
  constructor(private readonly pool: pg.Pool) {}

  async save(orgId: string, campaign: Campaign, score: number | null = null): Promise<void> {
    await this.pool.query(
      `INSERT INTO marketing_campaigns (id, org_id, name, description, status, goals, budget, channels, target_audience, score, performance, content_ids, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [campaign.id, orgId, campaign.name, campaign.description, campaign.status, JSON.stringify(campaign.goals), campaign.budget ? JSON.stringify(campaign.budget) : null, campaign.channels, campaign.targetAudience, score, campaign.performance ? JSON.stringify(campaign.performance) : null, campaign.contentIds, campaign.startDate, campaign.endDate],
    );
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.pool.query(`UPDATE marketing_campaigns SET status = $2 WHERE id = $1`, [id, status]);
  }

  async updateScore(id: string, score: number): Promise<void> {
    await this.pool.query(`UPDATE marketing_campaigns SET score = $2 WHERE id = $1`, [id, score]);
  }

  async updatePerformance(id: string, perf: CampaignPerformance): Promise<void> {
    await this.pool.query(`UPDATE marketing_campaigns SET performance = $2 WHERE id = $1`, [id, JSON.stringify(perf)]);
  }

  async listByOrg(orgId: string, limit = 50): Promise<CampaignRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_campaigns WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows;
  }

  async getById(id: string): Promise<CampaignRow | null> {
    const { rows } = await this.pool.query(`SELECT * FROM marketing_campaigns WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async listActive(orgId: string): Promise<CampaignRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_campaigns WHERE org_id = $1 AND status IN ('planning', 'active') ORDER BY created_at DESC`,
      [orgId],
    );
    return rows;
  }
}
