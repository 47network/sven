// ---------------------------------------------------------------------------
// Postgres-Backed Benchmark Storage
// ---------------------------------------------------------------------------
// Persists benchmark runs, results, and comparisons.
// ---------------------------------------------------------------------------

import pg from 'pg';

export interface BenchmarkRunRecord {
  id: string;
  suiteId: string;
  modelId: string;
  orgId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  taskResults: unknown[];
  aggregateMetrics: unknown | null;
  metadata: Record<string, unknown>;
}

export class PgBenchmarkStore {
  constructor(private pool: pg.Pool) {}

  async createRun(run: {
    id: string;
    suiteId: string;
    modelId: string;
    orgId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO benchmark_runs (id, suite_id, model_id, org_id, status, metadata)
       VALUES ($1, $2, $3, $4, 'running', $5)`,
      [run.id, run.suiteId, run.modelId, run.orgId, JSON.stringify(run.metadata ?? {})],
    );
  }

  async recordTaskResult(
    runId: string,
    taskResult: unknown,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE benchmark_runs
       SET task_results = task_results || $2::jsonb
       WHERE id = $1`,
      [runId, JSON.stringify([taskResult])],
    );
  }

  async completeRun(
    runId: string,
    aggregateMetrics: unknown,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE benchmark_runs
       SET status = 'completed', completed_at = now(), aggregate_metrics = $2
       WHERE id = $1`,
      [runId, JSON.stringify(aggregateMetrics)],
    );
  }

  async failRun(runId: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE benchmark_runs
       SET status = 'failed', completed_at = now(),
           metadata = metadata || jsonb_build_object('failureReason', $2::text)
       WHERE id = $1`,
      [runId, reason],
    );
  }

  async getRun(runId: string): Promise<BenchmarkRunRecord | null> {
    const res = await this.pool.query(
      `SELECT * FROM benchmark_runs WHERE id = $1`,
      [runId],
    );
    return res.rows[0] ? this.rowToRecord(res.rows[0]) : null;
  }

  async listRuns(orgId: string, limit = 50): Promise<BenchmarkRunRecord[]> {
    const res = await this.pool.query(
      `SELECT * FROM benchmark_runs WHERE org_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return res.rows.map((r) => this.rowToRecord(r));
  }

  async listRunsByModel(modelId: string, limit = 50): Promise<BenchmarkRunRecord[]> {
    const res = await this.pool.query(
      `SELECT * FROM benchmark_runs WHERE model_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [modelId, limit],
    );
    return res.rows.map((r) => this.rowToRecord(r));
  }

  private rowToRecord(row: Record<string, unknown>): BenchmarkRunRecord {
    return {
      id: row.id as string,
      suiteId: row.suite_id as string,
      modelId: row.model_id as string,
      orgId: row.org_id as string,
      status: row.status as string,
      startedAt: (row.started_at as Date).toISOString(),
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
      taskResults: (row.task_results as unknown[]) || [],
      aggregateMetrics: row.aggregate_metrics ?? null,
      metadata: (row.metadata as Record<string, unknown>) || {},
    };
  }
}
