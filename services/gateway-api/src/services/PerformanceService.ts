import { getPool } from '../db/pool.js';

/**
 * Queue Monitor Service
 * Tracks queue depths, metrics, and triggers backpressure when needed
 */

const pool = getPool();

interface QueueMetrics {
  queueType: string;
  queueName: string;
  depth: number;
  capacity?: number;
  depthPercent?: number;
  processingTimeMs: number;
  throughputPerMinute: number;
  stalledQueueCount: number;
}

const DEFAULT_BACKPRESSURE_TTL_MS = 5000;
const MIN_BACKPRESSURE_TTL_MS = 1000;
const MAX_BACKPRESSURE_TTL_MS = 300000;

/**
 * Record queue metrics sample
 */
export async function recordQueueMetrics(
  queueType: string,
  queueName: string,
  depth: number,
  capacity?: number,
  avgProcessingMs?: number,
  p95ProcessingMs?: number,
  throughputPerMinute?: number,
  errorRate?: number
): Promise<void> {
  try {
    const depthPercent = capacity ? (depth / capacity) * 100 : null;

    await pool.query(
      `INSERT INTO queue_metrics (
        queue_type, queue_name, sampled_at, queue_depth, queue_capacity,
        depth_percentage, avg_processing_time_ms, p95_processing_time_ms, throughput_per_minute, error_rate
      ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9)`,
      [queueType, queueName, depth, capacity, depthPercent, avgProcessingMs, p95ProcessingMs, throughputPerMinute, errorRate]
    );
  } catch (error) {
    console.error('Failed to record queue metrics:', error);
  }
}

function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function shouldTriggerBackpressureForMetric(
  policy: {
    queue_depth_threshold?: number | null;
    queue_depth_percent_threshold?: number | null;
    error_rate_threshold?: number | null;
    p95_latency_threshold_ms?: number | null;
  },
  metric: {
    queue_type?: string;
    queue_depth?: number | null;
    depth_percentage?: number | null;
    error_rate?: number | null;
    p95_processing_time_ms?: number | null;
  },
): { triggered: boolean; reason?: string } {
  const queueDepthThreshold = asFiniteNumber(policy.queue_depth_threshold);
  const queueDepthPercentThreshold = asFiniteNumber(policy.queue_depth_percent_threshold);
  const errorRateThreshold = asFiniteNumber(policy.error_rate_threshold);
  const p95LatencyThreshold = asFiniteNumber(policy.p95_latency_threshold_ms);
  const queueDepth = asFiniteNumber(metric.queue_depth);
  const depthPercent = asFiniteNumber(metric.depth_percentage);
  const errorRate = asFiniteNumber(metric.error_rate);
  const p95Latency = asFiniteNumber(metric.p95_processing_time_ms);

  if (queueDepthThreshold !== null && queueDepth !== null && queueDepth > queueDepthThreshold) {
    return { triggered: true, reason: `queue depth ${queueDepth} > threshold ${queueDepthThreshold}` };
  }

  if (queueDepthPercentThreshold !== null && depthPercent !== null && depthPercent > queueDepthPercentThreshold) {
    return { triggered: true, reason: `depth ${depthPercent}% > threshold ${queueDepthPercentThreshold}%` };
  }

  if (errorRateThreshold !== null && errorRate !== null && errorRate > errorRateThreshold) {
    return { triggered: true, reason: `error rate ${errorRate}% > threshold ${errorRateThreshold}%` };
  }

  if (p95LatencyThreshold !== null) {
    if (p95Latency === null) {
      return {
        triggered: true,
        reason: `p95 latency missing for queue ${String(metric.queue_type || 'unknown')} with active p95 threshold ${p95LatencyThreshold}`,
      };
    }
    if (p95Latency > p95LatencyThreshold) {
      return { triggered: true, reason: `P95 latency ${p95Latency}ms > threshold ${p95LatencyThreshold}ms` };
    }
  }

  return { triggered: false };
}

export function normalizeBackpressureTtlMs(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_BACKPRESSURE_TTL_MS;
  }
  const normalized = Math.floor(parsed);
  return Math.max(MIN_BACKPRESSURE_TTL_MS, Math.min(MAX_BACKPRESSURE_TTL_MS, normalized));
}

/**
 * Get current queue status summary
 */
export async function getQueueStatus(): Promise<{
  queues: QueueMetrics[];
  backpressureActive: boolean;
  recommendations: string[];
}> {
  try {
    // Get latest metrics for each queue type
    const result = await pool.query(
      `SELECT DISTINCT ON (queue_type) queue_type, queue_name, queue_depth, queue_capacity,
              depth_percentage, avg_processing_time_ms, throughput_per_minute, sampled_at
       FROM queue_metrics
       ORDER BY queue_type, sampled_at DESC
       LIMIT 10`
    );

    const queues: QueueMetrics[] = result.rows.map((r) => ({
      queueType: r.queue_type,
      queueName: r.queue_name,
      depth: r.queue_depth,
      capacity: r.queue_capacity,
      depthPercent: r.depth_percentage,
      processingTimeMs: r.avg_processing_time_ms,
      throughputPerMinute: r.throughput_per_minute,
      stalledQueueCount: r.queue_depth > 500 ? 1 : 0,
    }));

    // Check if backpressure is active
    const backpressureResult = await pool.query(
      `SELECT is_active FROM backpressure_state ORDER BY updated_at DESC LIMIT 1`
    );
    const backpressureActive = backpressureResult.rows.length > 0 ? backpressureResult.rows[0].is_active : false;

    // Generate recommendations
    const recommendations: string[] = [];
    queues.forEach((q) => {
      if (q.depthPercent && q.depthPercent > 80) {
        recommendations.push(`${q.queueType}: Queue depth ${q.depthPercent.toFixed(1)}% full - consider activating backpressure`);
      }
      if (q.processingTimeMs && q.processingTimeMs > 1000) {
        recommendations.push(
          `${q.queueType}: High latency (${q.processingTimeMs}ms) - may need performance profiling`
        );
      }
    });

    return {
      queues,
      backpressureActive,
      recommendations,
    };
  } catch (error) {
    console.error('Failed to get queue status:', error);
    return { queues: [], backpressureActive: false, recommendations: [] };
  }
}

/**
 * Check if backpressure should be triggered
 */
export async function checkBackpressureTriggers(): Promise<boolean> {
  try {
    // Get active backpressure policy
    const policyResult = await pool.query(
      `SELECT id, queue_depth_threshold, queue_depth_percent_threshold,
              error_rate_threshold, p95_latency_threshold_ms
       FROM backpressure_policies
       WHERE is_active = TRUE
       LIMIT 1`
    );

    if (policyResult.rows.length === 0) {
      return false;
    }

    const policy = policyResult.rows[0];

    // Get latest queue metrics
    const metricsResult = await pool.query(
      `SELECT queue_type, queue_depth, depth_percentage, error_rate, p95_processing_time_ms
       FROM queue_metrics
       WHERE sampled_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'
       ORDER BY sampled_at DESC`
    );

    // Check triggers
    for (const metric of metricsResult.rows) {
      const decision = shouldTriggerBackpressureForMetric(policy, metric);
      if (decision.triggered) {
        console.warn(`[BACKPRESSURE] Trigger: ${decision.reason}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Failed to check backpressure triggers:', error);
    return false;
  }
}

/**
 * Activate backpressure with configured policies
 */
export async function activateBackpressure(reason: string): Promise<void> {
  try {
    const policyResult = await pool.query(
      `SELECT id, pause_order, rate_limit_ttl_ms FROM backpressure_policies WHERE is_active = TRUE LIMIT 1`
    );

    if (policyResult.rows.length === 0) {
      console.warn('No active backpressure policy found');
      return;
    }

    const policy = policyResult.rows[0];
    const ttlMs = normalizeBackpressureTtlMs(policy.rate_limit_ttl_ms);

    // Insert backpressure state
    await pool.query(
      `INSERT INTO backpressure_state (
        policy_id, is_active, paused_queues, triggered_at,
        triggered_by_condition, scheduled_deactivation_at
      ) VALUES ($1, TRUE, $2, CURRENT_TIMESTAMP, $3, CURRENT_TIMESTAMP + (($4::text || ' milliseconds')::interval))
       ON CONFLICT DO NOTHING`,
      [policy.id, JSON.stringify(policy.pause_order), reason, String(ttlMs)]
    );

    console.log(`[BACKPRESSURE] Activated: ${reason}`);
    console.log(`[BACKPRESSURE] Pause order: ${policy.pause_order.join(' → ')}`);
  } catch (error) {
    console.error('Failed to activate backpressure:', error);
  }
}

/**
 * Deactivate backpressure
 */
export async function deactivateBackpressure(): Promise<void> {
  try {
    await pool.query(
      `UPDATE backpressure_state SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE is_active = TRUE`
    );

    console.log('[BACKPRESSURE] Deactivated');
  } catch (error) {
    console.error('Failed to deactivate backpressure:', error);
  }
}

/**
 * Get backpressure status
 */
export async function getBackpressureStatus(): Promise<{
  active: boolean;
  pausedQueues: string[];
  triggeredReason?: string;
  triggeredAt?: string;
  scheduledDeactivationAt?: string;
}> {
  try {
    const result = await pool.query(
      `SELECT is_active, paused_queues, triggered_by_condition, triggered_at, scheduled_deactivation_at
       FROM backpressure_state
       ORDER BY updated_at DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return { active: false, pausedQueues: [] };
    }

    const state = result.rows[0];
    return {
      active: state.is_active,
      pausedQueues: state.paused_queues || [],
      triggeredReason: state.triggered_by_condition,
      triggeredAt: state.triggered_at?.toISOString(),
      scheduledDeactivationAt: state.scheduled_deactivation_at?.toISOString(),
    };
  } catch (error) {
    console.error('Failed to get backpressure status:', error);
    return { active: false, pausedQueues: [] };
  }
}

/**
 * Auto-deactivate backpressure if scheduled time reached
 */
export async function checkScheduledDeactivation(): Promise<void> {
  try {
    const result = await pool.query(
      `UPDATE backpressure_state
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE is_active = TRUE
       AND scheduled_deactivation_at < CURRENT_TIMESTAMP
       RETURNING id`
    );

    if (result.rows.length > 0) {
      console.log(`[BACKPRESSURE] Auto-deactivated (${result.rows.length} state(s))`);
    }
  } catch (error) {
    console.error('Failed to check scheduled deactivation:', error);
  }
}

/**
 * Periodic health check (run every 30 seconds)
 */
export async function performHealthCheck(): Promise<void> {
  try {
    // Check if backpressure should be triggered
    const shouldTriggerBackpressure = await checkBackpressureTriggers();

    if (shouldTriggerBackpressure) {
      await activateBackpressure('automatic_trigger');
    } else {
      // Try to deactivate if conditions improve
      await checkScheduledDeactivation();
    }
  } catch (error) {
    console.error('Health check failed:', error);
  }
}
