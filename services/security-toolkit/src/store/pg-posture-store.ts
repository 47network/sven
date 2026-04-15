// ---------------------------------------------------------------------------
// Postgres-backed Security Posture Store
// ---------------------------------------------------------------------------
// Stores point-in-time security posture snapshots for trend tracking
// and compliance reporting.
// ---------------------------------------------------------------------------

import pg from 'pg';
import crypto from 'node:crypto';
import type { SecurityPosture } from '@sven/security-toolkit/report';

export interface PostureRecord {
  id: string;
  orgId: string;
  overallScore: number;
  grade: string;
  scores: Record<string, number | null>;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalFindings: number;
  secretsClean: boolean;
  topRisks: string[];
  recommendations: string[];
  complianceNotes: unknown[];
  scanIds: string[];
  createdAt: string;
}

export class PgPostureStore {
  constructor(private readonly pool: pg.Pool) {}

  async record(orgId: string, posture: SecurityPosture, scanIds: string[] = []): Promise<string> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO security_postures
         (id, org_id, overall_score, grade, scores, critical_count, high_count,
          medium_count, low_count, total_findings, secrets_clean, top_risks,
          recommendations, compliance_notes, scan_ids, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
      [
        id, orgId, posture.overallScore, posture.grade,
        JSON.stringify(posture.scores),
        posture.criticalFindings, posture.highFindings,
        posture.mediumFindings, posture.lowFindings,
        posture.totalFindings, posture.secretsClean,
        JSON.stringify(posture.topRisks),
        JSON.stringify(posture.recommendations),
        JSON.stringify(posture.complianceNotes),
        scanIds,
      ],
    );
    return id;
  }

  async getLatest(orgId: string): Promise<PostureRecord | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM security_postures WHERE org_id = $1 ORDER BY created_at DESC LIMIT 1',
      [orgId],
    );
    return rows.length > 0 ? this.rowToPosture(rows[0]) : null;
  }

  async getHistory(orgId: string, limit = 30): Promise<PostureRecord[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM security_postures WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2',
      [orgId, limit],
    );
    return rows.map(this.rowToPosture);
  }

  async getTrend(orgId: string): Promise<{
    current: PostureRecord | null;
    previous: PostureRecord | null;
    trend: 'improving' | 'stable' | 'degrading';
    scoreDelta: number;
  }> {
    const { rows } = await this.pool.query(
      'SELECT * FROM security_postures WHERE org_id = $1 ORDER BY created_at DESC LIMIT 2',
      [orgId],
    );
    const current = rows.length > 0 ? this.rowToPosture(rows[0]) : null;
    const previous = rows.length > 1 ? this.rowToPosture(rows[1]) : null;

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    let scoreDelta = 0;
    if (current && previous) {
      scoreDelta = current.overallScore - previous.overallScore;
      if (scoreDelta > 2) trend = 'improving';
      else if (scoreDelta < -2) trend = 'degrading';
    }

    return { current, previous, trend, scoreDelta };
  }

  private rowToPosture(row: Record<string, unknown>): PostureRecord {
    return {
      id: row.id as string,
      orgId: row.org_id as string,
      overallScore: row.overall_score as number,
      grade: row.grade as string,
      scores: row.scores as Record<string, number | null>,
      criticalCount: row.critical_count as number,
      highCount: row.high_count as number,
      mediumCount: row.medium_count as number,
      lowCount: row.low_count as number,
      totalFindings: row.total_findings as number,
      secretsClean: row.secrets_clean as boolean,
      topRisks: row.top_risks as string[],
      recommendations: row.recommendations as string[],
      complianceNotes: row.compliance_notes as unknown[],
      scanIds: row.scan_ids as string[],
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
