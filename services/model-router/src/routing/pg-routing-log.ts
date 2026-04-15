// ---------------------------------------------------------------------------
// Postgres-Backed Routing Decision Log
// ---------------------------------------------------------------------------
// Records every routing decision for auditability and analytics.
// ---------------------------------------------------------------------------

import pg from 'pg';

export interface RoutingDecisionRecord {
  id: number;
  requestId: string;
  orgId: string;
  task: string;
  priority: string;
  modelId: string;
  modelName: string;
  score: number;
  reason: string;
  fallbackChain: string[];
  latencyMs: number | null;
  decidedAt: string;
}

export class PgRoutingLog {
  constructor(private pool: pg.Pool) {}

  async record(decision: {
    requestId: string;
    orgId: string;
    task: string;
    priority: string;
    modelId: string;
    modelName: string;
    score: number;
    reason: string;
    fallbackChain: string[];
    latencyMs?: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO routing_decisions
        (request_id, org_id, task, priority, model_id, model_name, score, reason, fallback_chain, latency_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        decision.requestId, decision.orgId, decision.task, decision.priority,
        decision.modelId, decision.modelName, decision.score, decision.reason,
        decision.fallbackChain, decision.latencyMs ?? null,
      ],
    );
  }

  async listByOrg(
    orgId: string,
    limit = 100,
    offset = 0,
  ): Promise<RoutingDecisionRecord[]> {
    const res = await this.pool.query(
      `SELECT * FROM routing_decisions WHERE org_id = $1 ORDER BY decided_at DESC LIMIT $2 OFFSET $3`,
      [orgId, limit, offset],
    );
    return res.rows.map((r) => this.rowToRecord(r));
  }

  async listByModel(
    modelId: string,
    limit = 100,
  ): Promise<RoutingDecisionRecord[]> {
    const res = await this.pool.query(
      `SELECT * FROM routing_decisions WHERE model_id = $1 ORDER BY decided_at DESC LIMIT $2`,
      [modelId, limit],
    );
    return res.rows.map((r) => this.rowToRecord(r));
  }

  async getStats(orgId: string, days = 7): Promise<{
    totalDecisions: number;
    modelBreakdown: Array<{ modelId: string; count: number; avgScore: number }>;
    taskBreakdown: Array<{ task: string; count: number }>;
  }> {
    const cutoff = `now() - interval '${days} days'`;

    const totalRes = await this.pool.query(
      `SELECT COUNT(*)::integer AS total FROM routing_decisions WHERE org_id = $1 AND decided_at > now() - make_interval(days => $2)`,
      [orgId, days],
    );

    const modelRes = await this.pool.query(
      `SELECT model_id, COUNT(*)::integer AS count, AVG(score)::real AS avg_score
       FROM routing_decisions WHERE org_id = $1 AND decided_at > now() - make_interval(days => $2)
       GROUP BY model_id ORDER BY count DESC`,
      [orgId, days],
    );

    const taskRes = await this.pool.query(
      `SELECT task, COUNT(*)::integer AS count
       FROM routing_decisions WHERE org_id = $1 AND decided_at > now() - make_interval(days => $2)
       GROUP BY task ORDER BY count DESC`,
      [orgId, days],
    );

    return {
      totalDecisions: totalRes.rows[0]?.total ?? 0,
      modelBreakdown: modelRes.rows.map((r) => ({
        modelId: r.model_id as string,
        count: r.count as number,
        avgScore: r.avg_score as number,
      })),
      taskBreakdown: taskRes.rows.map((r) => ({
        task: r.task as string,
        count: r.count as number,
      })),
    };
  }

  private rowToRecord(row: Record<string, unknown>): RoutingDecisionRecord {
    return {
      id: row.id as number,
      requestId: row.request_id as string,
      orgId: row.org_id as string,
      task: row.task as string,
      priority: row.priority as string,
      modelId: row.model_id as string,
      modelName: row.model_name as string,
      score: row.score as number,
      reason: row.reason as string,
      fallbackChain: (row.fallback_chain as string[]) || [],
      latencyMs: (row.latency_ms as number) || null,
      decidedAt: (row.decided_at as Date).toISOString(),
    };
  }
}
