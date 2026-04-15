// ---------------------------------------------------------------------------
// Postgres-backed Security Findings Store
// ---------------------------------------------------------------------------
// Stores individual findings from all scan types, supports suppression, and
// provides org-scoped severity/category aggregation.
// ---------------------------------------------------------------------------

import pg from 'pg';
import crypto from 'node:crypto';

export interface FindingRecord {
  id: string;
  scanId: string;
  orgId: string;
  ruleId: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  filePath: string | null;
  lineNumber: number | null;
  matchedText: string | null;
  remediation: string;
  cweId: string | null;
  owaspRef: string | null;
  suppressed: boolean;
  suppressedBy: string | null;
  suppressedAt: string | null;
  createdAt: string;
}

export class PgFindingStore {
  constructor(private readonly pool: pg.Pool) {}

  async bulkInsert(scanId: string, orgId: string, findings: Array<{
    ruleId: string;
    category: string;
    severity: string;
    title: string;
    description?: string;
    filePath?: string;
    lineNumber?: number;
    matchedText?: string;
    remediation?: string;
    cweId?: string;
    owaspRef?: string;
  }>): Promise<number> {
    if (findings.length === 0) return 0;

    // Batch insert via unnest for performance
    const ids: string[] = [];
    const scanIds: string[] = [];
    const orgIds: string[] = [];
    const ruleIds: string[] = [];
    const categories: string[] = [];
    const severities: string[] = [];
    const titles: string[] = [];
    const descriptions: string[] = [];
    const filePaths: (string | null)[] = [];
    const lineNumbers: (number | null)[] = [];
    const matchedTexts: (string | null)[] = [];
    const remediations: string[] = [];
    const cweIds: (string | null)[] = [];
    const owaspRefs: (string | null)[] = [];

    for (const f of findings) {
      ids.push(crypto.randomUUID());
      scanIds.push(scanId);
      orgIds.push(orgId);
      ruleIds.push(f.ruleId);
      categories.push(f.category);
      severities.push(f.severity);
      titles.push(f.title);
      descriptions.push(f.description || '');
      filePaths.push(f.filePath || null);
      lineNumbers.push(f.lineNumber ?? null);
      matchedTexts.push(f.matchedText || null);
      remediations.push(f.remediation || '');
      cweIds.push(f.cweId || null);
      owaspRefs.push(f.owaspRef || null);
    }

    await this.pool.query(
      `INSERT INTO security_findings
         (id, scan_id, org_id, rule_id, category, severity, title, description,
          file_path, line_number, matched_text, remediation, cwe_id, owasp_ref)
       SELECT * FROM UNNEST(
         $1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::text[], $6::text[],
         $7::text[], $8::text[], $9::text[], $10::int[], $11::text[], $12::text[],
         $13::text[], $14::text[]
       )`,
      [ids, scanIds, orgIds, ruleIds, categories, severities, titles, descriptions,
       filePaths, lineNumbers, matchedTexts, remediations, cweIds, owaspRefs],
    );

    return findings.length;
  }

  async listByScan(scanId: string): Promise<FindingRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM security_findings WHERE scan_id = $1 ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
        created_at DESC`,
      [scanId],
    );
    return rows.map(this.rowToFinding);
  }

  async listByOrg(orgId: string, severity?: string, limit = 100, offset = 0): Promise<FindingRecord[]> {
    let query = 'SELECT * FROM security_findings WHERE org_id = $1 AND suppressed = FALSE';
    const params: unknown[] = [orgId];

    if (severity) {
      params.push(severity);
      query += ` AND severity = $${params.length}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await this.pool.query(query, params);
    return rows.map(this.rowToFinding);
  }

  async getSeverityCounts(orgId: string): Promise<Record<string, number>> {
    const { rows } = await this.pool.query(
      `SELECT severity, COUNT(*)::int AS count FROM security_findings
       WHERE org_id = $1 AND suppressed = FALSE GROUP BY severity`,
      [orgId],
    );
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
    for (const row of rows) counts[row.severity] = row.count;
    return counts;
  }

  async getCategoryCounts(orgId: string): Promise<Record<string, number>> {
    const { rows } = await this.pool.query(
      `SELECT category, COUNT(*)::int AS count FROM security_findings
       WHERE org_id = $1 AND suppressed = FALSE GROUP BY category ORDER BY count DESC`,
      [orgId],
    );
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.category] = row.count;
    return counts;
  }

  async suppress(findingId: string, suppressedBy: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE security_findings SET suppressed = TRUE, suppressed_by = $2, suppressed_at = NOW() WHERE id = $1`,
      [findingId, suppressedBy],
    );
    return (rowCount ?? 0) > 0;
  }

  async unsuppress(findingId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE security_findings SET suppressed = FALSE, suppressed_by = NULL, suppressed_at = NULL WHERE id = $1`,
      [findingId],
    );
    return (rowCount ?? 0) > 0;
  }

  private rowToFinding(row: Record<string, unknown>): FindingRecord {
    return {
      id: row.id as string,
      scanId: row.scan_id as string,
      orgId: row.org_id as string,
      ruleId: row.rule_id as string,
      category: row.category as string,
      severity: row.severity as string,
      title: row.title as string,
      description: row.description as string,
      filePath: row.file_path as string | null,
      lineNumber: row.line_number as number | null,
      matchedText: row.matched_text as string | null,
      remediation: row.remediation as string,
      cweId: row.cwe_id as string | null,
      owaspRef: row.owasp_ref as string | null,
      suppressed: row.suppressed as boolean,
      suppressedBy: row.suppressed_by as string | null,
      suppressedAt: row.suppressed_at ? (row.suppressed_at as Date).toISOString() : null,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
