// ---------------------------------------------------------------------------
// Postgres-backed Security Scan Store
// ---------------------------------------------------------------------------
// Persists scan records from all scan types (SAST, dependency audit, secret
// scan, infra audit, pentest) with org-scoped querying and severity tracking.
// ---------------------------------------------------------------------------

import pg from 'pg';
import crypto from 'node:crypto';

export type ScanType = 'sast' | 'dependency-audit' | 'secret-scan' | 'infra-audit' | 'pentest' | 'posture';
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ScanRecord {
  id: string;
  orgId: string;
  userId?: string;
  scanType: ScanType;
  target: string;
  status: ScanStatus;
  findingsCount: number;
  severitySummary: Record<string, number>;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
}

export class PgScanStore {
  constructor(private readonly pool: pg.Pool) {}

  async createScan(opts: {
    orgId: string;
    userId?: string;
    scanType: ScanType;
    target: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO security_scans (id, org_id, user_id, scan_type, target, status, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, 'running', $6, NOW())`,
      [id, opts.orgId, opts.userId || null, opts.scanType, opts.target, JSON.stringify(opts.metadata || {})],
    );
    return id;
  }

  async completeScan(scanId: string, findingsCount: number, severitySummary: Record<string, number>): Promise<void> {
    await this.pool.query(
      `UPDATE security_scans SET status = 'completed', findings_count = $2, severity_summary = $3, completed_at = NOW() WHERE id = $1`,
      [scanId, findingsCount, JSON.stringify(severitySummary)],
    );
  }

  async failScan(scanId: string, error: string): Promise<void> {
    await this.pool.query(
      `UPDATE security_scans SET status = 'failed', metadata = metadata || $2, completed_at = NOW() WHERE id = $1`,
      [scanId, JSON.stringify({ error })],
    );
  }

  async getScan(scanId: string): Promise<ScanRecord | null> {
    const { rows } = await this.pool.query('SELECT * FROM security_scans WHERE id = $1', [scanId]);
    return rows.length > 0 ? this.rowToScan(rows[0]) : null;
  }

  async listScans(orgId: string, limit = 50, offset = 0): Promise<ScanRecord[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM security_scans WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [orgId, limit, offset],
    );
    return rows.map(this.rowToScan);
  }

  async listByType(orgId: string, scanType: ScanType, limit = 50): Promise<ScanRecord[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM security_scans WHERE org_id = $1 AND scan_type = $2 ORDER BY created_at DESC LIMIT $3',
      [orgId, scanType, limit],
    );
    return rows.map(this.rowToScan);
  }

  async getStats(orgId: string): Promise<{
    totalScans: number;
    byType: Record<string, number>;
    lastScanAt: string | null;
  }> {
    const { rows } = await this.pool.query(
      `SELECT scan_type, COUNT(*)::int AS count, MAX(created_at) AS last_at
       FROM security_scans WHERE org_id = $1 GROUP BY scan_type`,
      [orgId],
    );
    const byType: Record<string, number> = {};
    let totalScans = 0;
    let lastScanAt: string | null = null;
    for (const row of rows) {
      byType[row.scan_type] = row.count;
      totalScans += row.count;
      if (!lastScanAt || row.last_at > lastScanAt) lastScanAt = row.last_at;
    }
    return { totalScans, byType, lastScanAt };
  }

  private rowToScan(row: Record<string, unknown>): ScanRecord {
    return {
      id: row.id as string,
      orgId: row.org_id as string,
      userId: row.user_id as string | undefined,
      scanType: row.scan_type as ScanType,
      target: row.target as string,
      status: row.status as ScanStatus,
      findingsCount: row.findings_count as number,
      severitySummary: row.severity_summary as Record<string, number>,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: (row.created_at as Date).toISOString(),
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
    };
  }
}
