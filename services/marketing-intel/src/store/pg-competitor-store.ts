import pg from 'pg';
import type { CompetitorProfile, CompetitorSignal, CompetitiveReport, CompetitiveFinding } from '@sven/marketing-intel/competitive-intel';

export interface CompetitorRow {
  id: string;
  org_id: string;
  name: string;
  website: string | null;
  linkedin_url: string | null;
  github_org: string | null;
  industry: string | null;
  description: string | null;
  is_active: boolean;
  profile: CompetitorProfile;
  tracked_since: string;
  created_at: string;
}

export interface SignalRow {
  id: string;
  org_id: string;
  competitor_id: string;
  signal_type: string;
  title: string;
  content: string | null;
  source_url: string | null;
  analysis: string | null;
  impact_level: number;
  raw_data: Record<string, unknown> | null;
  detected_at: string;
}

export interface ReportRow {
  id: string;
  org_id: string;
  report_type: string;
  title: string;
  content_md: string;
  competitor_ids: string[];
  key_findings: CompetitiveFinding[];
  created_at: string;
}

export class PgCompetitorStore {
  constructor(private readonly pool: pg.Pool) {}

  async createCompetitor(orgId: string, profile: CompetitorProfile): Promise<void> {
    await this.pool.query(
      `INSERT INTO marketing_competitors (id, org_id, name, website, linkedin_url, github_org, industry, description, is_active, profile, tracked_since)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [profile.id, orgId, profile.name, profile.website, profile.linkedinUrl, profile.githubOrg, profile.industry, profile.description, profile.isActive, JSON.stringify(profile), profile.trackedSince],
    );
  }

  async listByOrg(orgId: string, limit = 50): Promise<CompetitorRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_competitors WHERE org_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows;
  }

  async getById(id: string): Promise<CompetitorRow | null> {
    const { rows } = await this.pool.query(`SELECT * FROM marketing_competitors WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async deactivate(id: string): Promise<void> {
    await this.pool.query(`UPDATE marketing_competitors SET is_active = FALSE WHERE id = $1`, [id]);
  }

  async saveSignal(orgId: string, signal: CompetitorSignal): Promise<void> {
    await this.pool.query(
      `INSERT INTO marketing_signals (id, org_id, competitor_id, signal_type, title, content, source_url, analysis, impact_level, raw_data, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [signal.id, orgId, signal.competitorId, signal.signalType, signal.title, signal.content, signal.sourceUrl, signal.analysis, signal.impactLevel, signal.raw ? JSON.stringify(signal.raw) : null, signal.detectedAt],
    );
  }

  async listSignals(competitorId: string, limit = 100): Promise<SignalRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_signals WHERE competitor_id = $1 ORDER BY detected_at DESC LIMIT $2`,
      [competitorId, limit],
    );
    return rows;
  }

  async listSignalsByOrg(orgId: string, limit = 100): Promise<SignalRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_signals WHERE org_id = $1 ORDER BY detected_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows;
  }

  async saveReport(orgId: string, report: CompetitiveReport): Promise<void> {
    await this.pool.query(
      `INSERT INTO marketing_reports (id, org_id, report_type, title, content_md, competitor_ids, key_findings, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [report.id, orgId, report.reportType, report.title, report.content, report.competitorIds, JSON.stringify(report.keyFindings), report.createdAt],
    );
  }

  async listReports(orgId: string, limit = 20): Promise<ReportRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_reports WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows;
  }
}
