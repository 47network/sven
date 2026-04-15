import type { Pool } from 'pg';
import type { QuantumJob, JobStatus } from '@sven/quantum-sim/hardware';

// ─── Row ↔ Domain Mapping ────────────────────────────────────────────────────

interface JobRow {
  id: string;
  backend_id: string;
  status: string;
  circuit_json: unknown;
  shots: number;
  result_json: unknown | null;
  measurements: unknown | null;
  estimated_cost: unknown | null;
  error: string | null;
  org_id: string;
  submitted_at: string;
  started_at: string | null;
  completed_at: string | null;
}

function rowToDomain(row: JobRow): QuantumJob {
  return {
    id: row.id,
    backendId: row.backend_id,
    status: row.status as JobStatus,
    circuit: row.circuit_json as QuantumJob['circuit'],
    shots: row.shots,
    result: (row.result_json as QuantumJob['result']) ?? null,
    measurements: (row.measurements as QuantumJob['measurements']) ?? [],
    submittedAt: new Date(row.submitted_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    estimatedCost: (row.estimated_cost as QuantumJob['estimatedCost']) ?? null,
    error: row.error,
  };
}

// ─── Store ───────────────────────────────────────────────────────────────────

export class PgJobStore {
  constructor(private pool: Pool) {}

  async insert(job: QuantumJob, orgId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO quantum_jobs
         (id, backend_id, status, circuit_json, shots, estimated_cost, org_id, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        job.id,
        job.backendId,
        job.status,
        JSON.stringify(job.circuit),
        job.shots,
        job.estimatedCost ? JSON.stringify(job.estimatedCost) : null,
        orgId,
        job.submittedAt.toISOString(),
      ],
    );
  }

  async updateStatus(jobId: string, status: JobStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (status === 'running') extras.started_at = new Date().toISOString();
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      extras.completed_at = new Date().toISOString();
    }

    const sets = ['status = $2'];
    const params: unknown[] = [jobId, status];
    let idx = 3;
    for (const [col, val] of Object.entries(extras)) {
      sets.push(`${col} = $${idx}`);
      params.push(val);
      idx++;
    }
    await this.pool.query(`UPDATE quantum_jobs SET ${sets.join(', ')} WHERE id = $1`, params);
  }

  async setResult(jobId: string, result: unknown, measurements: unknown[]): Promise<void> {
    await this.pool.query(
      `UPDATE quantum_jobs
         SET result_json = $2, measurements = $3, status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [jobId, JSON.stringify(result), JSON.stringify(measurements)],
    );
  }

  async setError(jobId: string, error: string): Promise<void> {
    await this.pool.query(
      `UPDATE quantum_jobs SET error = $2, status = 'failed', completed_at = NOW() WHERE id = $1`,
      [jobId, error],
    );
  }

  async getById(jobId: string): Promise<QuantumJob | undefined> {
    const { rows } = await this.pool.query<JobRow>('SELECT * FROM quantum_jobs WHERE id = $1', [jobId]);
    return rows[0] ? rowToDomain(rows[0]) : undefined;
  }

  async list(orgId: string, status?: string, limit = 50, offset = 0): Promise<QuantumJob[]> {
    let sql = 'SELECT * FROM quantum_jobs WHERE org_id = $1';
    const params: unknown[] = [orgId];
    if (status) {
      sql += ' AND status = $2';
      params.push(status);
    }
    sql += ` ORDER BY submitted_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const { rows } = await this.pool.query<JobRow>(sql, params);
    return rows.map(rowToDomain);
  }

  async cancel(jobId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE quantum_jobs SET status = 'cancelled', completed_at = NOW()
       WHERE id = $1 AND status IN ('queued', 'running')`,
      [jobId],
    );
    return (rowCount ?? 0) > 0;
  }

  async stats(orgId: string): Promise<Record<string, number>> {
    const { rows } = await this.pool.query<{ status: string; count: string }>(
      'SELECT status, COUNT(*)::text AS count FROM quantum_jobs WHERE org_id = $1 GROUP BY status',
      [orgId],
    );
    const result: Record<string, number> = {};
    for (const r of rows) result[r.status] = Number(r.count);
    return result;
  }
}
