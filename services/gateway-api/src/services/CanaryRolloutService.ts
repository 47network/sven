import { getPool } from '../db/pool.js';
import { nanoid } from 'nanoid';

const pool = getPool();

/**
 * Canary Rollout Service
 * Monitors model metrics and automatically triggers rollbacks if thresholds are exceeded
 */

interface RolloutConfig {
  rollout_id: string;
  source_model_id: string;
  target_model_id: string;
  error_threshold_percentage: number;
  latency_threshold_ms: number;
  cost_threshold_increase_percentage: number;
}

interface ModelMetrics {
  error_rate: number;
  avg_latency_ms: number;
  avg_cost: number;
  total_requests: number;
}

export class CanaryRolloutService {
  // Check if a rollout should be auto-rolled back based on metrics
  static async evaluateRollout(rolloutId: string): Promise<boolean> {
    try {
      // Get rollout config
      const rolloutRes = await pool.query(
        'SELECT * FROM model_canary_rollouts WHERE id = $1 AND rollout_status = $2',
        [rolloutId, 'in_progress']
      );

      if (rolloutRes.rows.length === 0) {
        return false; // Rollout not active
      }

      const rollout = rolloutRes.rows[0];

      // Get metrics for target model (last 1 hour)
      const metricsRes = await pool.query(
        `SELECT metric_type, value, unit FROM model_metrics 
         WHERE model_id = $1 AND recorded_at > NOW() - INTERVAL '1 hour'
         ORDER BY recorded_at DESC`,
        [rollout.target_model_id]
      );

      const metrics = this.aggregateMetrics(metricsRes.rows);

      // Evaluate thresholds
      if (this.shouldRollback(metrics, rollout)) {
        await this.triggerRollback(rolloutId, `Automatic rollback: error_rate=${metrics.error_rate.toFixed(2)}%, latency=${metrics.avg_latency_ms}ms`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error evaluating rollout:', error);
      return false;
    }
  }

  // Check all in-progress rollouts
  static async evaluateAllRollouts(): Promise<string[]> {
    try {
      const rollouts = await pool.query(
        'SELECT id FROM model_canary_rollouts WHERE rollout_status = $1',
        ['in_progress']
      );

      const rolledBackIds: string[] = [];
      for (const rollout of rollouts.rows) {
        const wasRolledBack = await this.evaluateRollout(rollout.id);
        if (wasRolledBack) {
          rolledBackIds.push(rollout.id);
        }
      }

      return rolledBackIds;
    } catch (error) {
      console.error('Error evaluating all rollouts:', error);
      return [];
    }
  }

  // Aggregate metrics from raw data
  private static aggregateMetrics(metricRows: any[]): ModelMetrics {
    const metrics: any = {
      error_rate: 0,
      avg_latency_ms: 0,
      avg_cost: 0,
      total_requests: 0,
    };

    let latencySum = 0;
    let costSum = 0;
    let latencyCount = 0;
    let costCount = 0;

    for (const row of metricRows) {
      if (row.metric_type === 'error_rate') {
        metrics.error_rate = parseFloat(row.value);
      } else if (row.metric_type === 'latency') {
        latencySum += parseFloat(row.value);
        latencyCount++;
      } else if (row.metric_type === 'cost') {
        costSum += parseFloat(row.value);
        costCount++;
      }
    }

    metrics.avg_latency_ms = latencyCount > 0 ? latencySum / latencyCount : 0;
    metrics.avg_cost = costCount > 0 ? costSum / costCount : 0;

    return metrics;
  }

  // Determine if rollout should be rolled back
  private static shouldRollback(metrics: ModelMetrics, rollout: RolloutConfig): boolean {
    // Check error rate threshold
    if (rollout.error_threshold_percentage && metrics.error_rate > rollout.error_threshold_percentage) {
      console.warn(`[Canary] Error rate ${metrics.error_rate}% exceeds threshold ${rollout.error_threshold_percentage}%`);
      return true;
    }

    // Check latency threshold
    if (rollout.latency_threshold_ms && metrics.avg_latency_ms > rollout.latency_threshold_ms) {
      console.warn(`[Canary] Latency ${metrics.avg_latency_ms}ms exceeds threshold ${rollout.latency_threshold_ms}ms`);
      return true;
    }

    return false;
  }

  // Trigger automatic rollback
  private static async triggerRollback(rolloutId: string, reason: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE model_canary_rollouts 
         SET rollout_status = $1, rolled_back_at = CURRENT_TIMESTAMP, rollback_reason = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        ['rolled_back', reason, rolloutId]
      );

      // Audit log
      await pool.query(
        `INSERT INTO model_governance_audit (id, action, rollout_id, actor_id, details) 
         VALUES ($1, $2, $3, $4, $5)`,
        [nanoid(), 'rollback', rolloutId, 'system', { reason, automatic: true }]
      );

      console.log(`[Canary] Rolled back ${rolloutId}: ${reason}`);
    } catch (error) {
      console.error('Failed to trigger rollback:', error);
    }
  }

  // Start evaluation loop (call once at service startup)
  static startEvaluationLoop(intervalMs: number = 60000): NodeJS.Timer {
    console.log(`[Canary] Starting rollout evaluation loop (${intervalMs}ms interval)`);

    return setInterval(async () => {
      try {
        const rolledBackIds = await this.evaluateAllRollouts();
        if (rolledBackIds.length > 0) {
          console.log(`[Canary] Auto-rolled back ${rolledBackIds.length} rollout(s):`, rolledBackIds);
        }
      } catch (error) {
        console.error('[Canary] Evaluation loop error:', error);
      }
    }, intervalMs);
  }

  // Record metrics for a model execution
  static async recordMetrics(modelId: string, metrics: {
    latency_ms: number;
    error?: boolean;
    cost?: number;
    output_quality_score?: number;
  }): Promise<void> {
    try {
      const promises = [];

      // Record latency
      promises.push(pool.query(
        `INSERT INTO model_metrics (id, model_id, metric_type, value, unit) VALUES ($1, $2, $3, $4, $5)`,
        [nanoid(), modelId, 'latency', metrics.latency_ms, 'ms']
      ));

      // Record error if present
      if (metrics.error) {
        promises.push(pool.query(
          `INSERT INTO model_metrics (id, model_id, metric_type, value, unit) VALUES ($1, $2, $3, $4, $5)`,
          [nanoid(), modelId, 'error_rate', 1, '%']
        ));
      }

      // Record cost if present
      if (metrics.cost) {
        promises.push(pool.query(
          `INSERT INTO model_metrics (id, model_id, metric_type, value, unit) VALUES ($1, $2, $3, $4, $5)`,
          [nanoid(), modelId, 'cost', metrics.cost, 'usd']
        ));
      }

      // Record quality score if present
      if (metrics.output_quality_score !== undefined) {
        promises.push(pool.query(
          `INSERT INTO model_metrics (id, model_id, metric_type, value, unit) VALUES ($1, $2, $3, $4, $5)`,
          [nanoid(), modelId, 'output_quality', metrics.output_quality_score, 'score']
        ));
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to record metrics:', error);
    }
  }

  // Get aggregated metrics for a model with optional cohort filtering
  static async getAggregatedMetrics(modelId: string, cohortId?: string, hoursBack: number = 1): Promise<ModelMetrics> {
    try {
      let query = `
        SELECT metric_type, value FROM model_metrics 
        WHERE model_id = $1 
        AND recorded_at > NOW() - INTERVAL '${hoursBack} hours'
      `;
      const params: any[] = [modelId];

      if (cohortId) {
        query += ` AND cohort_id = $${params.length + 1}`;
        params.push(cohortId);
      }

      const res = await pool.query(query, params);
      return this.aggregateMetrics(res.rows);
    } catch (error) {
      console.error('Failed to get aggregated metrics:', error);
      return {
        error_rate: 0,
        avg_latency_ms: 0,
        avg_cost: 0,
        total_requests: 0,
      };
    }
  }

  // Check if budget is exceeded for a policy
  static async isBudgetExceeded(policyId: string): Promise<boolean> {
    try {
      const policyRes = await pool.query(
        'SELECT primary_model_id, usage_budget_daily FROM model_policies WHERE id = $1',
        [policyId]
      );

      if (policyRes.rows.length === 0) {
        return false;
      }

      const policy = policyRes.rows[0];
      if (!policy.usage_budget_daily) {
        return false;
      }

      // Check today's spending
      const costRes = await pool.query(
        `SELECT SUM(total_cost) as total_spent FROM model_usage_logs
         WHERE model_id = $1 AND created_at > NOW()::date
         GROUP BY DATE(created_at)`,
        [policy.primary_model_id]
      );

      if (costRes.rows.length === 0) {
        return false;
      }

      const totalSpent = parseFloat(costRes.rows[0].total_spent) || 0;
      return totalSpent >= policy.usage_budget_daily;
    } catch (error) {
      console.error('Failed to check budget:', error);
      return false;
    }
  }
}
