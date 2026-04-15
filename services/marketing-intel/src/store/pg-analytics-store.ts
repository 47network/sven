import pg from 'pg';
import type { MarketingMetrics, MarketingReport, ContentRanking } from '@sven/marketing-intel/analytics';

export interface AnalyticsRow {
  id: string;
  org_id: string;
  period: string;
  start_date: string;
  end_date: string;
  channels: MarketingMetrics['channels'];
  totals: MarketingMetrics['totals'];
  trends: MarketingMetrics['trends'];
  top_content: ContentRanking[];
  recommendations: string[];
  report_md: string | null;
  created_at: string;
}

export class PgAnalyticsStore {
  constructor(private readonly pool: pg.Pool) {}

  async saveReport(orgId: string, report: MarketingReport): Promise<void> {
    await this.pool.query(
      `INSERT INTO marketing_analytics (id, org_id, period, start_date, end_date, channels, totals, trends, top_content, recommendations, report_md)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [report.id, orgId, report.period, report.metrics.startDate, report.metrics.endDate, JSON.stringify(report.metrics.channels), JSON.stringify(report.metrics.totals), JSON.stringify(report.metrics.trends), JSON.stringify(report.topContent), JSON.stringify(report.recommendations), report.markdown],
    );
  }

  async listByOrg(orgId: string, limit = 20): Promise<AnalyticsRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_analytics WHERE org_id = $1 ORDER BY start_date DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows;
  }

  async getLatest(orgId: string, period: string): Promise<AnalyticsRow | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_analytics WHERE org_id = $1 AND period = $2 ORDER BY start_date DESC LIMIT 1`,
      [orgId, period],
    );
    return rows[0] ?? null;
  }

  async getTrendData(orgId: string, period: string, count = 6): Promise<AnalyticsRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_analytics WHERE org_id = $1 AND period = $2 ORDER BY start_date DESC LIMIT $3`,
      [orgId, period, count],
    );
    return rows.reverse();
  }
}
